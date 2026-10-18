"use client";
// /home (the old Today and Insights pages, made simple). From top to bottom:
//   1 a greeting and ONE summary sentence
//   2 "Do this now": at most 3 cards, one plain sentence and one button each
//   3 four status tiles, each a link to the filtered Applications list
//   4 "What we've learned so far": at most 3 plain sentences
//   5 "How InterVous works": the three steps, and Add a job
// Every sentence and number comes from lib/core/home.mjs (buildHome). This file renders and wires
// the buttons to lib/data writes (each with Undo). "Not now" lives in localStorage (dismissed.ts).
import { CheckCircle2, FileText, Hourglass, Lightbulb, ListChecks, MessageSquareReply, Plus, RotateCw, Send, Target, X, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { addDays, appPath, buildHome, buildToday, formatDay, type ConfirmQuestion, type HomeAction, type StatusGroupId } from "../../../lib/core";
import { updateApplication } from "../../../lib/data";
import {
  ActionCard,
  Button,
  Callout,
  GlassCard,
  IconButton,
  Section,
  Skeleton,
  SkeletonRow,
  StatTile,
  Steps,
  openNewApplication,
  phaseVars,
  useToast,
} from "@/ui";
import { SentDialog, UpdateDialog, type DialogTarget } from "@/features/applications/UpdateDialog";
import { useUpdates } from "@/features/applications/updates";
import { copyText, followUpLine } from "./actions";
import { ConfirmFlow } from "./ConfirmFlow";
import { FOREVER, snoozeUntil, SNOOZE_DAYS, useDismissed } from "./dismissed";
import { useCoreInput } from "./useCoreInput";
import { useDeferred } from "./useDeferred";
import { useLogos } from "./useLogos";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="iv-page pb-12">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-12 pt-8 sm:pt-12">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Loading Home" className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <div className="mt-10 flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </Frame>
  );
}

function greeting(name: string | null) {
  const h = new Date().getHours();
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

/** "alberto.barnabo@…" -> "Alberto"; the profile's name when there is one. */
function firstName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string | null {
  const meta = user?.user_metadata ?? {};
  const full = [meta.full_name, meta.name, meta.first_name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  const raw = full?.trim().split(/\s+/)[0] ?? user?.email?.split("@")[0]?.split(/[._+-]/)[0] ?? "";
  if (!/^[\p{L}]{2,}$/u.test(raw)) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

const GROUP_ICON: Partial<Record<HomeAction["type"], LucideIcon>> = {
  confirm_facts: ListChecks,
  no_reply: Hourglass,
  fix_base_cv: FileText,
};

/** The colour dot of each tile: the status it mostly holds. */
const TILE_PHASE: Record<StatusGroupId, string> = { waiting: "applied", interviews: "interviewing", not_sent: "draft", closed: "no_reply" };

const LEARNED_ICON: Record<string, LucideIcon> = {
  replies: MessageSquareReply,
  gap: Target,
  likely_closed: Hourglass,
  reply_time: Lightbulb,
  sent_within: Send,
};

export function HomeView() {
  const core = useCoreInput();
  const logos = useLogos();
  const { user } = useAuth();
  const today = core.raw?.today ?? null;
  const { dismissed, set } = useDismissed(today);
  const deferred = useDeferred();
  const updates = useUpdates();
  const toast = useToast();
  // The question keys of the confirm batch being answered; the questions themselves are read live,
  // so an answered one drops out once it is saved.
  const [confirmKeys, setConfirmKeys] = useState<ReadonlySet<string> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateFor, setUpdateFor] = useState<{ target: DialogTarget; title?: string } | null>(null);
  const [sentFor, setSentFor] = useState<DialogTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const home = useMemo(() => (core.input ? buildHome(core.input, { dismissed }) : null), [core.input, dismissed]);
  const allQuestions = useMemo<ConfirmQuestion[]>(() => {
    if (!core.input) return [];
    const item = buildToday(core.input).items.find((it) => it.type === "confirm_facts");
    return item && item.type === "confirm_facts" ? item.questions : [];
  }, [core.input]);
  const confirmQuestions = useMemo(() => (confirmKeys ? allQuestions.filter((q) => confirmKeys.has(q.key)) : []), [allQuestions, confirmKeys]);

  if (core.error && !core.input) {
    return (
      <Frame>
        <Callout
          tone="danger"
          title="Home could not load"
          action={
            <Button size="sm" icon={RotateCw} onClick={() => void core.refetch()}>
              Try again
            </Button>
          }
        >
          {core.error.message}
        </Callout>
      </Frame>
    );
  }
  if (!home || !today || !core.raw) return <Loading />;

  const apps = core.raw.apps;
  const target = (a: { appId: number; company: string; role: string; phase: string }): DialogTarget => ({
    id: a.appId,
    company: a.company,
    role: a.role,
    phase: a.phase as DialogTarget["phase"],
    logoUrl: logos.get(a.appId) ?? null,
  });

  // A confirm batch whose answers are all waiting for their Undo window is done for now.
  const actions = home.actions.filter((a) => !(a.questions?.length && a.questions.every((q) => deferred.hidden.has(q.key))));

  const run = async (key: string, write: () => Promise<void>) => {
    setBusy(key);
    try {
      await write();
    } catch (e) {
      toast.show({ kind: "error", text: `Not saved: ${e instanceof Error ? e.message : "try again."}` });
    } finally {
      setBusy(null);
    }
  };

  const notNow = (a: HomeAction) => {
    set(a.key, snoozeUntil(today));
    toast.show({
      kind: "info",
      text: `Hidden for now. It comes back on ${formatDay(addDays(today, SNOOZE_DAYS))}.`,
      action: { label: "Undo", run: () => set(a.key, null) },
    });
  };

  const press = (a: HomeAction) => {
    const app = a.app;
    switch (a.button.id) {
      case "update":
        if (app) setUpdateFor({ target: target(app), title: a.type === "outcome_missing" ? `How did the ${app.company} interview go?` : undefined });
        return;
      case "mark_sent":
        if (app) setSentFor(target(app));
        return;
      case "confirm":
        setConfirmKeys(new Set((a.questions ?? []).map((q) => q.key)));
        setConfirmOpen(true);
        return;
      case "copy_follow_up": {
        if (!app) return;
        const row = apps.find((x) => Number(x.id) === app.appId);
        // No name in the greeting: a contact on file is not always the person to write to
        // (colleagues, notes such as "his team lead"). He adds the name when he pastes it.
        const line = followUpLine({ contactName: null, role: app.role, appliedOn: row?.applied_on ?? null, today });
        void copyText(line).then((ok) =>
          toast.show({
            kind: ok ? "success" : "info",
            text: ok
              ? `Copied. Paste it into an email to your contact: “${line}”`
              : `Copy this line into an email: “${line}”`,
            duration: 12000,
            action: { label: "I sent it", run: () => void run(a.key, () => updates.followedUp(target(app), today)) },
          }),
        );
        return;
      }
      case "mark_no_reply":
        void run(a.key, () => updates.markNoReply(a.apps.map(target), today));
        return;
      case "drop":
        if (app) void run(a.key, () => updates.notApplying(target(app), today));
        return;
      case "done": {
        if (!app) return;
        const row = apps.find((x) => Number(x.id) === app.appId);
        const before = { next_action: row?.next_action ?? null, next_action_due: row?.next_action_due ?? null };
        void run(a.key, async () => {
          await updateApplication(app.appId, { next_action: null, next_action_due: null });
          toast.show({
            kind: "success",
            text: `Done: ${app.company}.`,
            action: { label: "Undo", run: () => void updateApplication(app.appId, before).catch(() => undefined) },
          });
        });
        return;
      }
      case "checklist_done":
        set(a.key, FOREVER);
        toast.show({ kind: "success", text: "Main CV updated. Nice.", action: { label: "Undo", run: () => set(a.key, null) } });
        return;
      default:
        return;
    }
  };

  const name = firstName(user as Parameters<typeof firstName>[0]);

  return (
    <Frame>
      {/* 1 Greeting */}
      <header>
        <h1 className="text-h1-sm text-ink sm:text-h1">{greeting(name)}</h1>
        <p className="mt-3 max-w-2xl text-[18px] leading-[1.5] text-ink-2">{home.summary}</p>
      </header>

      {/* 2 Do this now */}
      <Section
        id="do-this-now"
        title="Do this now"
        description={actions.length ? "The most useful things to do today, most important first." : undefined}
      >
        {actions.length === 0 ? (
          <GlassCard padding="md" className="flex items-center gap-4">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CheckCircle2 size={22} strokeWidth={2} />
            </span>
            <div>
              <p className="text-body font-medium text-ink">{home.emptyLine}</p>
              <p className="text-small text-ink-2">When something needs you, it shows up here.</p>
            </div>
          </GlassCard>
        ) : (
          <ul className="flex flex-col gap-3">
            {actions.map((a) => (
              <li key={a.key} className="group/card relative">
                <ActionCard
                  className="pr-12 sm:pr-14"
                  text={a.text}
                  detail={detailOf(a)}
                  company={a.app ? { name: a.app.company, logoUrl: logos.get(a.app.appId) ?? null } : undefined}
                  icon={a.app ? undefined : GROUP_ICON[a.type] ?? ListChecks}
                  action={
                    a.button.id === "open" && a.app
                      ? { label: a.button.label, href: appPath({ id: a.app.appId, slug: a.app.slug }) }
                      : { label: a.button.label, onClick: () => press(a), loading: busy === a.key }
                  }
                />
                <IconButton
                  label={`Not now: hide this for ${SNOOZE_DAYS} days`}
                  icon={X}
                  size="sm"
                  variant="quiet"
                  onClick={() => notNow(a)}
                  className="absolute top-2 right-2 text-ink-3"
                />
              </li>
            ))}
          </ul>
        )}
        {home.more > 0 || home.hiddenKeys.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-small text-ink-2">
            {home.more > 0 ? <span>{home.more === 1 ? "1 more thing comes up after these." : `${home.more} more things come up after these.`}</span> : null}
            {home.hiddenKeys.length > 0 ? (
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  for (const k of home.hiddenKeys) set(k, null);
                }}
              >
                Show {home.hiddenKeys.length} hidden
              </Button>
            ) : null}
          </p>
        ) : null}
      </Section>

      {/* 3 Status tiles */}
      <Section id="where-things-stand" title="Where things stand">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {home.tiles.map((t) => (
            <StatTile
              key={t.id}
              value={t.count}
              label={t.label}
              href={`/applications?show=${t.id}`}
              color={phaseVars(TILE_PHASE[t.id]).fg}
            />
          ))}
        </div>
      </Section>

      {/* 4 What we've learned */}
      <Section id="learned" title="What we've learned so far">
        <GlassCard padding="md">
          {home.learned.length ? (
            <ul className="flex flex-col gap-4">
              {home.learned.map((l) => {
                const Icon = LEARNED_ICON[l.id] ?? Lightbulb;
                return (
                  <li key={l.id} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <p className="text-body text-ink">{l.text}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body text-ink-2">Nothing to learn yet. Once a few applications have been out for 3 weeks, this fills in.</p>
          )}
        </GlassCard>
      </Section>

      {/* 5 How it works */}
      <Section id="how-it-works" title="How InterVous works">
        <GlassCard padding="md" className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Steps
            aria-label="How InterVous works"
            items={["Add a job (paste the link)", "Mark it as sent", "Tell InterVous what happened"]}
          />
          <Button icon={Plus} onClick={openNewApplication} className="self-start md:self-auto">
            Add a job
          </Button>
        </GlassCard>
      </Section>

      <ConfirmFlow
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        questions={confirmQuestions}
        apps={apps}
        logos={logos}
        today={today}
        deferred={deferred}
      />
      <UpdateDialog target={updateFor?.target ?? null} title={updateFor?.title} today={today} onClose={() => setUpdateFor(null)} />
      <SentDialog target={sentFor} today={today} onClose={() => setSentFor(null)} />
    </Frame>
  );
}

/** The quiet second line of a card: which job it is, or which companies a group covers. */
function detailOf(a: HomeAction): ReactNode {
  const link = a.link ? (
    <a href={a.link.href} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
      {a.link.label}
    </a>
  ) : null;
  if (a.app) {
    return (
      <>
        {a.app.role}
        {link ? <> · {link}</> : null}
      </>
    );
  }
  if (a.type === "confirm_facts" && a.apps.length > 1) {
    const names = [...new Set(a.apps.map((x) => x.company))];
    return names.length <= 5 ? names.join(", ") : `${names.slice(0, 4).join(", ")} and ${names.length - 4} more`;
  }
  return link;
}

"use client";

import { ChevronRight, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../../../../contexts/AuthContext";
import { formatAgo, formatShort } from "../../../../../lib/core";
import { FIXTURE_MODE, updateSettings, useApplications, useSettings, useToday, type Application, type UserSettings } from "../../../../../lib/data";
import { getProfile } from "../../../../../lib/backend/profiles";
import type { KeysStatus } from "../../../../../lib/keyService";
import { AvatarPicker } from "@/components/AvatarUploadModal";
import { KeysForm } from "@/components/KeysPanel";
import { Button, Combobox, CompanyMark, DateInput, Field, Select, Skeleton, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { keysStatus as loadKeysStatus } from "@/app/(app)/companies/_lib/companies";
import { dossierPath } from "@/app/(app)/companies/_lib/match";
import { Section, glassClass } from "@/features/dossier/glass";
import { eventLine } from "@/features/dossier/status";
import {
  SCRAPE_MODELS,
  effectiveScrapeModel,
  scrapeModelInfo,
  writeScrapeModel,
  type ScrapeModel,
} from "@/features/new-application/model";

const SECTIONS = [
  { id: "avatar", label: "Profile picture" },
  { id: "api-keys", label: "API keys" },
  { id: "ai-model", label: "Reading job links" },
  { id: "reminders", label: "Reminders" },
  { id: "command-line", label: "Command line" },
] as const;

export default function SettingsView() {
  const [keys, setKeys] = useState<KeysStatus | null>(null);
  const [keysLoaded, setKeysLoaded] = useState(false);

  const reloadKeys = () =>
    loadKeysStatus()
      .then(setKeys)
      .catch(() => setKeys(null))
      .finally(() => setKeysLoaded(true));

  useEffect(() => {
    void reloadKeys();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-8 pb-24 sm:px-6 md:pt-10">
      <header>
        <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] text-ink sm:text-[34px]">Settings</h1>
        <p className="mt-2 text-[16px] text-ink-2">Your picture, your API keys, reminders and the command line.</p>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className={cx(glassClass, "sticky top-24 flex flex-col gap-0.5 p-2")}>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex h-10 cursor-pointer items-center rounded-full px-3.5 text-[15px] text-ink-2 transition-colors hover:bg-white/70 hover:text-ink"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="avatar" title="Profile picture">
            <AvatarSection />
          </Section>

          <Section id="api-keys" title="API keys" description="Keys stay on the server. This page only learns whether each one is saved.">
            {keysLoaded ? <KeysForm keysStatus={keys} onSaved={() => void reloadKeys()} /> : <Skeleton lines={4} />}
          </Section>

          <Section
            id="ai-model"
            title="Reading job links"
            description="When you add a job from its link, this AI model reads the post and fills in the company, role and place. Remembered in this browser."
          >
            <ModelSection keys={keys} />
          </Section>

          <Section id="reminders" title="Reminders" description="When InterVous suggests a follow-up, and when it treats an application as closed.">
            <RemindersSection />
          </Section>

          <Section id="command-line" title="Command line">
            <CommandLineSection />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ── profile picture ─────────────────────────────────────────────────────────

function AvatarSection() {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(FIXTURE_MODE);
  useEffect(() => {
    if (FIXTURE_MODE || !user) return;
    let live = true;
    getProfile(user.id)
      .then((p) => live && setUrl(p?.avatar_url ?? null))
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [user]);
  if (!loaded) return <Skeleton className="h-24 rounded-[16px]" />;
  return <AvatarPicker currentUrl={url} onSaved={setUrl} />;
}

// ── reading job links ───────────────────────────────────────────────────────

function ModelSection({ keys }: { keys: KeysStatus | null }) {
  const { show } = useToast();
  const [model, setModel] = useState<ScrapeModel | null>(null);
  useEffect(() => setModel(effectiveScrapeModel(keys)), [keys]);
  if (!model) return <Skeleton className="h-11 w-64" />;
  const info = scrapeModelInfo(model);
  const missing = keys ? !keys[info.key] : false;
  return (
    <div className="flex flex-col gap-3">
      <Field label="AI model">
        <Select<ScrapeModel>
          value={model}
          onChange={(m) => {
            setModel(m);
            writeScrapeModel(m);
            show({ text: `Job links are now read by ${scrapeModelInfo(m).label}.` });
          }}
          options={SCRAPE_MODELS.map((m) => ({
            value: m.value,
            label: m.label,
            description: keys ? (keys[m.key] ? `${m.provider} key saved` : `Needs a ${m.provider} key`) : undefined,
          }))}
          className="max-w-xs"
        />
      </Field>
      {missing ? (
        <p className="rounded-[14px] bg-[color-mix(in_srgb,var(--caution-fg)_10%,white)] px-4 py-3 text-[15px] text-ink">
          {info.label} needs a {info.provider} key. Add it under{" "}
          <a href="#api-keys" className="cursor-pointer font-medium underline underline-offset-4">
            API keys
          </a>
          , or pick a model whose key is saved.
        </p>
      ) : null}
    </div>
  );
}

// ── reminders ───────────────────────────────────────────────────────────────

type Editable = Omit<UserSettings, "user_id" | "updated_at">;

const NUMBERS: Array<{ key: keyof Editable; label: string; unit: string; hint: string }> = [
  { key: "follow_up_after_days", label: "Suggest a follow-up after", unit: "days", hint: "Days without a reply before Home suggests a short follow-up." },
  { key: "no_reply_after_days", label: "Treat as closed after", unit: "days", hint: "After this many days without a reply, an application is probably closed." },
  { key: "draft_stale_after_days", label: "Remind me about unsent CVs after", unit: "days", hint: "Home reminds you to send it or drop it." },
  { key: "mature_after_days", label: "Count replies after", unit: "days", hint: "What InterVous learns only counts applications at least this old." },
  { key: "weekly_target", label: "Weekly goal", unit: "sent", hint: "How many applications you want to send each week." },
];

let zonesCache: string[] | null = null;
function timeZones(): string[] {
  if (zonesCache) return zonesCache;
  try {
    zonesCache = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zonesCache = [];
  }
  if (!zonesCache.length) zonesCache = ["Europe/Berlin", "Europe/London", "Europe/Rome", "UTC"];
  return zonesCache;
}

function pick(s: UserSettings): Editable {
  const { follow_up_after_days, no_reply_after_days, mature_after_days, draft_stale_after_days, weekly_target, timezone, campaign_start } = s;
  return { follow_up_after_days, no_reply_after_days, mature_after_days, draft_stale_after_days, weekly_target, timezone, campaign_start };
}

function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0">{children}</li>;
}

function RemindersSection() {
  const { show } = useToast();
  const settings = useSettings();
  const [draft, setDraft] = useState<Editable | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data && !draft) setDraft(pick(settings.data));
  }, [settings.data, draft]);

  const base = settings.data ? pick(settings.data) : null;
  const dirty = !!draft && !!base && (Object.keys(draft) as Array<keyof Editable>).some((k) => String(draft[k]) !== String(base[k]));
  const invalid = !!draft && NUMBERS.some((n) => !Number.isInteger(Number(draft[n.key])) || Number(draft[n.key]) < 1 || Number(draft[n.key]) > 365);

  if (!draft) return settings.error ? <p className="text-[15px] text-danger">{settings.error.message}</p> : <Skeleton lines={5} />;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch = { ...draft } as Editable;
      for (const n of NUMBERS) (patch as Record<string, unknown>)[n.key] = Number(draft[n.key]);
      const saved = await updateSettings(patch);
      setDraft(pick(saved));
      show({ text: "Reminders saved." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "They were not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !invalid) void save();
      }}
    >
      <ul className="flex flex-col divide-y divide-[rgba(15,23,42,0.08)]">
        {NUMBERS.map((n) => {
          const id = `th-${n.key}`;
          return (
            <Row key={n.key}>
              <div className="min-w-0 flex-1 basis-64">
                <label htmlFor={id} className="text-[16px] font-medium text-ink">
                  {n.label}
                </label>
                <p id={`${id}-hint`} className="text-[14px] text-ink-2">
                  {n.hint}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  step={1}
                  value={String(draft[n.key])}
                  aria-describedby={`${id}-hint`}
                  onChange={(e) => setDraft((d) => (d ? { ...d, [n.key]: e.target.value as unknown as number } : d))}
                  className={cx(controlClass, "h-11 w-20 text-right text-[16px] tabular-nums")}
                />
                <span className="w-10 text-[15px] text-ink-2">{n.unit}</span>
              </span>
            </Row>
          );
        })}
        <Row>
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="th-campaign" className="text-[16px] font-medium text-ink">
              This job search started on
            </label>
            <p className="text-[14px] text-ink-2">Older applications are kept apart in what InterVous learns.</p>
          </div>
          <span className="w-44">
            <DateInput id="th-campaign" value={draft.campaign_start} onChange={(e) => setDraft((d) => (d ? { ...d, campaign_start: e.target.value } : d))} />
          </span>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[16px] font-medium text-ink">Time zone</p>
            <p className="text-[14px] text-ink-2">What &ldquo;today&rdquo; means for every count of days.</p>
          </div>
          <Combobox<string>
            aria-label="Time zone"
            items={timeZones()}
            value={draft.timezone}
            onChange={(v) => v && setDraft((d) => (d ? { ...d, timezone: v } : d))}
            getLabel={(z) => z.replace(/_/g, " ")}
            getKey={(z) => z}
            className="w-64 max-w-full"
          />
        </Row>
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {invalid ? <p className="mr-auto text-[15px] text-danger">Use whole numbers from 1 to 365.</p> : null}
        <Button variant="quiet" disabled={!dirty || saving} onClick={() => base && setDraft(base)}>
          Undo changes
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty || invalid}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ── command line ────────────────────────────────────────────────────────────

type CliEvent = Application["events"][number] & { app: Application };

function CommandLineSection() {
  const apps = useApplications();
  const today = useToday();

  const { lastWrite, recent } = useMemo(() => {
    const rows = apps.data ?? [];
    const events: CliEvent[] = rows.flatMap((a) => a.events.filter((e) => e.source === "cli").map((e) => ({ ...e, app: a })));
    events.sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
    const stamps = [
      ...rows.filter((a) => a.source === "cli" && a.updated_at).map((a) => String(a.updated_at)),
      ...events.map((e) => String(e.created_at)),
    ].sort();
    return { lastWrite: stamps[stamps.length - 1] ?? null, recent: events.slice(0, 5) };
  }, [apps.data]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <TerminalSquare aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
        <p className="text-[16px] leading-6 text-ink">
          Run <code className="rounded-[6px] bg-white/80 px-1.5 py-0.5 text-[15px]">intervous login</code> once in Terminal. The command line then
          works as you, with the same access.
        </p>
      </div>

      <dl className="flex flex-wrap items-baseline justify-between gap-2 rounded-[14px] bg-white/60 px-4 py-3">
        <dt className="text-[15px] text-ink-2">Last change from the command line</dt>
        <dd className="text-[15px] text-ink">
          {apps.loading && !apps.data ? (
            <Skeleton className="w-32" />
          ) : lastWrite ? (
            <>
              {formatAgo(lastWrite)}
              <span className="ml-2 text-ink-2 tabular-nums">{formatShort(lastWrite.slice(0, 10), { today })}</span>
            </>
          ) : (
            <span className="text-ink-2">None yet</span>
          )}
        </dd>
      </dl>

      <div>
        <h3 className="text-[16px] font-semibold text-ink">Recent changes from the command line</h3>
        {recent.length === 0 ? (
          <p className="mt-1 text-[15px] text-ink-2">
            {apps.loading && !apps.data ? "Loading…" : "Nothing yet. The next CV you build from a job link shows up here."}
          </p>
        ) : (
          <ul className="-mx-2 mt-2 flex flex-col">
            {recent.map((e) => (
              <li key={e.id}>
                <Link
                  href={dossierPath(e.app)}
                  className="group flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/70"
                >
                  <CompanyMark name={e.app.company_name ?? "?"} logoUrl={e.app.company_logo_url} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-ink">{eventLine(e).label}</span>
                    <span className="block truncate text-[14px] text-ink-2">
                      {e.app.company_name} · {e.app.role}
                    </span>
                  </span>
                  <span className="hidden text-[14px] text-ink-2 sm:block">{formatAgo(String(e.created_at))}</span>
                  <ChevronRight aria-hidden size={18} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

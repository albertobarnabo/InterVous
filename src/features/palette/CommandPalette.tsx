"use client";

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ArrowLeft, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { appPath, formatShort } from "../../../lib/core";
import { logEvent, updateApplication, useApplications, type Application, type EventKind } from "../../../lib/data";
import { Button, CompanyMark, DateInput, Field, Input, Kbd, StatusPill, cx, useToast } from "@/ui";
import { OPEN_PALETTE, onShellEvent, openShortcuts } from "@/ui/events";
import { listCompanies } from "@/app/(app)/companies/_lib/companies";
import { openNewApplicationWith } from "@/features/new-application/events";
import { grouped, search, type PaletteCommand, type PaletteItem } from "./items";
import { useToday } from "./useToday";

type Step = { type: "sent"; app: Application } | { type: "reply"; app: Application } | null;

/**
 * ⌘K: a Headless UI Combobox in a glass Dialog. Searches applications, companies, pages and
 * actions. "Mark … as sent" and "Log a reply for …" ask one short question in place, then write.
 */
export function CommandPalette() {
  const router = useRouter();
  const { signOut } = useAuth();
  const apps = useApplications();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>(null);
  const [remote, setRemote] = useState<Array<{ name: string; logoUrl: string | null }>>([]);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(
    () =>
      onShellEvent(OPEN_PALETTE, () => {
        if (openRef.current) {
          setOpen(false);
          return;
        }
        setQuery("");
        setStep(null);
        setOpen(true);
      }),
    [],
  );

  // companies from the companies table (debounced); application company names are searched locally
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || /^https?:/i.test(q)) {
      setRemote([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      listCompanies({ page: 1, pageSize: 5, query: q })
        .then((r) => live && setRemote(r.data.map((c) => ({ name: c.name, logoUrl: c.logo_url }))))
        .catch(() => live && setRemote([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const items = useMemo(() => search(query, apps.data ?? [], remote), [query, apps.data, remote]);
  const groups = useMemo(() => grouped(items), [items]);

  const close = () => setOpen(false);

  const run = (c: PaletteCommand) => {
    switch (c.type) {
      case "go":
        close();
        router.push(c.href);
        return;
      case "app":
        close();
        router.push(appPath({ id: Number(c.app.id), slug: c.app.slug }));
        return;
      case "company":
        close();
        router.push(`/companies?company=${encodeURIComponent(c.name)}`);
        return;
      case "sent":
      case "reply":
        setStep({ type: c.type, app: c.app });
        return;
      case "new":
        close();
        openNewApplicationWith({ url: c.url, company: c.company, mode: c.url ? "link" : undefined });
        return;
      case "add-company":
        close();
        router.push("/companies?add=1");
        return;
      case "shortcuts":
        close();
        openShortcuts();
        return;
      case "sign-out":
        close();
        void signOut()
          .catch(() => {})
          .finally(() => router.replace("/login"));
        return;
    }
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop transition className="iv-scrim fixed inset-0 transition-opacity duration-[160ms] ease-out data-closed:opacity-0" />
      <div className="fixed inset-0 flex w-screen items-start justify-center overflow-y-auto p-4 pt-[min(12vh,96px)]">
        <DialogPanel
          transition
          className="iv-glass-thick w-full max-w-xl overflow-hidden rounded-xl shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_60px_rgba(15,23,42,0.22)] transition duration-[160ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100"
        >
          <DialogTitle className="sr-only">Search or jump to</DialogTitle>
          {step ? (
            <StepForm step={step} onBack={() => setStep(null)} onDone={close} />
          ) : (
            <Combobox<PaletteItem | null>
              value={null}
              onChange={(it) => it && run(it.command)}
              immediate
            >
              <div className="flex items-center gap-3 border-b border-ink/[0.06] px-5">
                <Search aria-hidden size={18} className="shrink-0 text-ink-3" />
                <ComboboxInput
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  // Esc closes the palette at once (spec 2.8). Left to the Combobox, a first Esc only
                  // blanked the input while the results of the old query stayed on screen.
                  onKeyDown={(e) => {
                    if (e.key !== "Escape") return;
                    e.preventDefault();
                    e.stopPropagation();
                    close();
                  }}
                  placeholder="Search or jump to…"
                  aria-label="Search applications, companies and actions"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-14 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <span className="hidden sm:flex">
                  <Kbd>Esc</Kbd>
                </span>
              </div>
              <ComboboxOptions static className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain p-2 empty:hidden">
                {groups.map((g) => (
                  <div key={g.group} role="presentation" className="pb-1 [&+&]:border-t [&+&]:border-ink/[0.06] [&+&]:pt-1">
                    <p role="presentation" className="px-3 pb-1 pt-2 text-caption text-ink-2">
                      {g.group}
                    </p>
                    {g.items.map((it) => (
                      <ComboboxOption
                        key={it.id}
                        value={it}
                        className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 py-1.5 select-none data-focus:bg-white/80 data-focus:shadow-[0_0_0_0.5px_rgba(15,23,42,0.08)]"
                      >
                        <ItemIcon item={it} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-ink">{it.label}</span>
                          {it.sub ? <span className="block truncate text-small text-ink-2">{it.sub}</span> : null}
                        </span>
                        {it.phase ? (
                          <span className="hidden sm:block">
                            <StatusPill status={it.phase as Application["phase"] & string} size="sm" />
                          </span>
                        ) : null}
                        {it.hint ? <span className="hidden text-caption text-ink-3 sm:inline">{it.hint}</span> : null}
                        <CornerDownLeft aria-hidden size={14} className="invisible shrink-0 text-ink-3 group-data-focus:visible" />
                      </ComboboxOption>
                    ))}
                  </div>
                ))}
              </ComboboxOptions>
              {query.trim() && !items.length ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-small text-ink-2">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => run({ type: "new", company: query.trim() })}
                  >
                    Add a job at {query.trim()}
                  </Button>
                </div>
              ) : null}
              <div className="hidden items-center gap-4 border-t border-ink/[0.06] px-5 py-2.5 text-caption text-ink-2 sm:flex">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> move
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd> open
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <Kbd>?</Kbd> all shortcuts
                </span>
              </div>
            </Combobox>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function ItemIcon({ item }: { item: PaletteItem }) {
  if (item.mark) return <CompanyMark name={item.mark.name} logoUrl={item.mark.logoUrl} size={28} />;
  const Icon = item.icon;
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
      {Icon ? <Icon size={16} strokeWidth={1.75} /> : null}
    </span>
  );
}

const REPLY_KINDS: Array<{ kind: EventKind; label: string }> = [
  { kind: "reply", label: "They replied" },
  { kind: "interview_scheduled", label: "Interview booked" },
  { kind: "assessment", label: "A test or task" },
  { kind: "rejection", label: "Rejected" },
  { kind: "auto_ack", label: "Automatic email only" },
];

/** The one question an action needs (a date, a kind of reply), asked inside the palette. */
function StepForm({ step, onBack, onDone }: { step: NonNullable<Step>; onBack: () => void; onDone: () => void }) {
  const router = useRouter();
  const { show } = useToast();
  const today = useToday();
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<EventKind>("reply");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const app = step.app;
  const path = appPath({ id: Number(app.id), slug: app.slug });

  useEffect(() => setDate(today), [today]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (step.type === "sent") {
        await logEvent(Number(app.id), { kind: "applied", occurred_on: date });
        const uncertain = (app.uncertain ?? []) as string[];
        const left = uncertain.filter((f) => f !== "phase" && f !== "applied_on");
        if (left.length !== uncertain.length) await updateApplication(Number(app.id), { uncertain: left });
        show({ text: `${app.company_name} marked as sent on ${formatShort(date, { today })}.`, action: { label: "Open", run: () => router.push(path) } });
      } else {
        await logEvent(Number(app.id), { kind, occurred_on: date, title: note.trim() || null });
        show({ text: `Logged for ${app.company_name}.`, action: { label: "Open", run: () => router.push(path) } });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-3 border-b border-ink/[0.06] px-3 py-3">
        <Button size="sm" variant="quiet" icon={ArrowLeft} onClick={onBack}>
          Back
        </Button>
        <span className="min-w-0 flex-1 truncate text-small text-ink-2">
          {app.company_name} · {app.role}
        </span>
      </div>
      <div className="flex flex-col gap-4 px-4 py-5">
        <p className="text-h3 text-ink">{step.type === "sent" ? "When did you send it?" : "What came back?"}</p>
        {step.type === "reply" ? (
          <div role="radiogroup" aria-label="Kind of reply" className="flex flex-wrap gap-1.5">
            {REPLY_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={kind === k.kind}
                onClick={() => setKind(k.kind)}
                className={cx(
                  "h-9 cursor-pointer rounded-full px-4 text-small font-medium transition-[background-color,box-shadow] duration-150 pointer-coarse:h-11",
                  kind === k.kind
                    ? "bg-accent-soft text-ink shadow-[0_0_0_1.5px_var(--accent)]"
                    : "bg-white/70 text-ink-2 shadow-[0_0_0_0.5px_rgba(15,23,42,0.14)] hover:bg-white hover:text-ink",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start gap-3">
          <Field label={step.type === "sent" ? "Date sent" : "Date"}>
            <DateInput value={date} max={today} onChange={(e) => setDate(e.target.value)} required autoFocus={step.type === "sent"} />
          </Field>
          {step.type === "reply" ? (
            <Field label="Note" hint="Optional" className="min-w-48 flex-1">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recruiter call next week" />
            </Field>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-ink/[0.06] px-4 py-3">
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {step.type === "sent" ? "Mark as sent" : "Log it"}
        </Button>
      </div>
    </form>
  );
}

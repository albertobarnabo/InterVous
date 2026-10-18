"use client";

import { ChevronRight, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../../../../contexts/AuthContext";
import { eventTitle, formatAgo, formatShort } from "../../../../../lib/core";
import { FIXTURE_MODE, updateSettings, useApplications, useSettings, type Application, type UserSettings } from "../../../../../lib/data";
import { getProfile } from "../../../../../lib/backend/profiles";
import type { KeysStatus } from "../../../../../lib/keyService";
import { AvatarPicker } from "@/components/AvatarUploadModal";
import { KeysForm } from "@/components/KeysPanel";
import { Button, Callout, Combobox, CompanyMark, DateInput, Field, Select, Skeleton, Tag, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { keysStatus as loadKeysStatus } from "@/app/(app)/companies/_lib/companies";
import { dossierPath } from "@/app/(app)/companies/_lib/match";
import { useToday } from "@/features/palette/useToday";
import {
  SCRAPE_MODELS,
  effectiveScrapeModel,
  scrapeModelInfo,
  writeScrapeModel,
  type ScrapeModel,
} from "@/features/new-application/model";

const SECTIONS = [
  { id: "api-keys", label: "API keys" },
  { id: "avatar", label: "Avatar" },
  { id: "ai-model", label: "AI model" },
  { id: "thresholds", label: "Thresholds" },
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
    <div className="iv-page pb-8 pt-8 md:pt-10">
      <header>
        <h1 className="text-h1-sm text-ink sm:text-h1">Settings</h1>
        <p className="mt-1 text-body text-ink-2">Keys, thresholds and the command line</p>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[180px_minmax(0,720px)] lg:gap-12">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-20 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex h-9 items-center rounded-sm px-2.5 text-small text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="api-keys" title="API keys" lead="Keys stay on the server. This page only learns whether each one is saved.">
            {keysLoaded ? <KeysForm keysStatus={keys} onSaved={() => void reloadKeys()} /> : <Skeleton lines={4} />}
          </Section>

          <Section id="avatar" title="Avatar" lead={null}>
            <AvatarSection />
          </Section>

          <Section id="ai-model" title={<>AI model for &ldquo;From link&rdquo;</>} lead="Reads a job posting and fills in company, role and location. Remembered in this browser.">
            <ModelSection keys={keys} />
          </Section>

          <Section id="thresholds" title="Thresholds" lead="When Today suggests a follow-up, and when Insights counts an application as old enough to judge.">
            <ThresholdsSection />
          </Section>

          <Section id="command-line" title="Command line" lead={null}>
            <CommandLineSection />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: ReactNode; lead: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-md bg-surface p-5 shadow-1 md:p-6">
      <h2 id={`${id}-title`} className="text-h3 text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-1 text-small text-ink-2">{lead}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ── avatar ──────────────────────────────────────────────────────────────────

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
  if (!loaded) return <Skeleton className="h-24 rounded-md" />;
  return <AvatarPicker currentUrl={url} onSaved={setUrl} />;
}

// ── AI model ────────────────────────────────────────────────────────────────

function ModelSection({ keys }: { keys: KeysStatus | null }) {
  const { show } = useToast();
  const [model, setModel] = useState<ScrapeModel | null>(null);
  useEffect(() => setModel(effectiveScrapeModel(keys)), [keys]);
  if (!model) return <Skeleton className="h-9 w-64" />;
  const info = scrapeModelInfo(model);
  const missing = keys ? !keys[info.key] : false;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Model">
        <Select<ScrapeModel>
          value={model}
          onChange={(m) => {
            setModel(m);
            writeScrapeModel(m);
            show({ text: `“From link” now uses ${scrapeModelInfo(m).label}` });
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
        <Callout tone="caution">
          {info.label} needs a {info.provider} key. Add it under{" "}
          <a href="#api-keys" className="underline underline-offset-4">
            API keys
          </a>
          , or pick a model whose key is saved.
        </Callout>
      ) : null}
    </div>
  );
}

// ── thresholds ──────────────────────────────────────────────────────────────

type Editable = Omit<UserSettings, "user_id" | "updated_at">;

const NUMBERS: Array<{ key: keyof Editable; label: string; unit: string; hint: string }> = [
  { key: "follow_up_after_days", label: "Suggest a follow-up after", unit: "days", hint: "Days without a reply before Today suggests writing to a contact." },
  { key: "mature_after_days", label: "Old enough to judge after", unit: "days", hint: "Insights only count replies for applications at least this old." },
  { key: "no_reply_after_days", label: "Treat as no reply after", unit: "days", hint: "After this, a silent application is likely closed." },
  { key: "draft_stale_after_days", label: "A CV not sent is stale after", unit: "days", hint: "Today reminds you to send or drop it." },
  { key: "weekly_target", label: "Weekly target", unit: "sent", hint: "How many applications you want to send each week." },
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

function ThresholdsSection() {
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

  if (!draft) return settings.error ? <p className="text-small text-danger">{settings.error.message}</p> : <Skeleton lines={5} />;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch = { ...draft } as Editable;
      for (const n of NUMBERS) (patch as Record<string, unknown>)[n.key] = Number(draft[n.key]);
      const saved = await updateSettings(patch);
      setDraft(pick(saved));
      show({ text: "Thresholds saved. Today and Insights use them now." });
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
      <ul className="flex flex-col divide-y divide-line">
        {NUMBERS.map((n) => {
          const id = `th-${n.key}`;
          return (
            <li key={n.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 first:pt-0">
              <div className="min-w-0 flex-1 basis-64">
                <label htmlFor={id} className="text-small font-medium text-ink">
                  {n.label}
                </label>
                <p id={`${id}-hint`} className="text-caption font-normal text-ink-3">
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
                  className={cx(controlClass, "iv-num h-9 w-20 text-right pointer-coarse:h-11")}
                />
                <span className="w-10 text-small text-ink-2">{n.unit}</span>
              </span>
            </li>
          );
        })}
        <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="th-campaign" className="text-small font-medium text-ink">
              This search started on
            </label>
            <p className="text-caption font-normal text-ink-3">Insights compare applications from this date on. Older ones are kept apart.</p>
          </div>
          <span className="w-44">
            <DateInput id="th-campaign" value={draft.campaign_start} onChange={(e) => setDraft((d) => (d ? { ...d, campaign_start: e.target.value } : d))} />
          </span>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 last:pb-0">
          <div className="min-w-0 flex-1 basis-64">
            <p id="th-tz-label" className="text-small font-medium text-ink">
              Time zone
            </p>
            <p className="text-caption font-normal text-ink-3">What &ldquo;today&rdquo; means for every count.</p>
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
        </li>
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {invalid ? <p className="mr-auto text-small text-danger">Use whole numbers from 1 to 365.</p> : null}
        <Button variant="quiet" disabled={!dirty || saving} onClick={() => base && setDraft(base)}>
          Undo changes
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty || invalid}>
          Save thresholds
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
        <p className="text-body text-ink">
          Run <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-small">intervous login</code> once in Terminal. The CLI acts as
          you, under the same access rules.
        </p>
      </div>

      <dl className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-surface-2 px-4 py-3">
        <dt className="text-small text-ink-2">Last CLI write</dt>
        <dd className="text-small text-ink">
          {apps.loading && !apps.data ? (
            <Skeleton className="w-32" />
          ) : lastWrite ? (
            <>
              {formatAgo(lastWrite)}
              <span className="iv-num ml-2 text-ink-3">{formatShort(lastWrite.slice(0, 10), { today })}</span>
            </>
          ) : (
            <span className="text-ink-3">None yet</span>
          )}
        </dd>
      </dl>

      <div>
        <h3 className="text-small font-medium text-ink">Last 5 CLI events</h3>
        {recent.length === 0 ? (
          <p className="mt-1 text-small text-ink-3">
            {apps.loading && !apps.data ? "Loading…" : "Nothing from the command line yet. The next CV built from a job link shows up here."}
          </p>
        ) : (
          <ul className="-mx-2 mt-2 flex flex-col">
            {recent.map((e) => (
              <li key={e.id}>
                <Link
                  href={dossierPath(e.app)}
                  className="group flex min-h-14 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <CompanyMark name={e.app.company_name ?? "?"} logoUrl={e.app.company_logo_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium text-ink">{eventTitle(e)}</span>
                    <span className="block truncate text-caption font-normal text-ink-2">
                      {e.app.company_name} · {e.app.role}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <Tag>{formatAgo(String(e.created_at))}</Tag>
                  </span>
                  <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

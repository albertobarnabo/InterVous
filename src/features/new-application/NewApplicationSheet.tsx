"use client";

import { ArrowLeft, ClipboardPaste, Link2, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { appPath, normalizeUrl } from "../../../lib/core";
import { apiJson } from "../../../lib/api";
import { FIXTURE_MODE, useApplications, type Application } from "../../../lib/data";
import { supabase } from "../../../lib/supbaseClient";
import type { KeysStatus } from "../../../lib/keyService";
import { Button, ButtonLink, Callout, DateInput, Field, Input, SegmentedControl, Sheet, Textarea, cx, useToast } from "@/ui";
import { OPEN_NEW_APPLICATION } from "@/ui/events";
import { keysStatus as loadKeysStatus } from "@/app/(app)/companies/_lib/companies";
import { useToday } from "@/features/palette/useToday";
import { createApplication } from "./create";
import { prefillOf, type NewApplicationMode, type NewApplicationPrefill } from "./events";
import { SCRAPE_MODEL_CHANGED, effectiveScrapeModel, scrapeModelInfo, type ScrapeModel } from "./model";

const MODE_KEY = "iv.newApplication.mode";

function readMode(): NewApplicationMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "paste" || v === "manual" ? v : "link";
  } catch {
    return "link";
  }
}

type Draft = { company: string; role: string; location: string; url: string; sent: boolean; sentOn: string; jd: string };
const empty = (today: string): Draft => ({ company: "", role: "", location: "", url: "", sent: false, sentOn: today, jd: "" });

type Scraped = { fullJobEntry: { company_name?: string; role?: string; location?: string; url?: string } };

/**
 * The New-application sheet (spec 2.9), opened by `n`, the palette, or any page through
 * OPEN_NEW_APPLICATION (optionally with a prefill: see ./events). Three modes:
 * From link (reads the posting with the AI model chosen in Settings, then lets you check it),
 * Paste JD (keeps the text as the posting snapshot), Manual.
 */
export function NewApplicationSheet() {
  const router = useRouter();
  const { show } = useToast();
  const today = useToday();
  const apps = useApplications();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NewApplicationMode>("link");
  const [d, setD] = useState<Draft>(() => empty(today));
  const [linkStep, setLinkStep] = useState<"link" | "review">("link");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const [keys, setKeys] = useState<KeysStatus | null>(null);
  const [model, setModel] = useState<ScrapeModel>("gpt-3.5-turbo");
  const [focusRole, setFocusRole] = useState(false);

  const start = (prefill: NewApplicationPrefill) => {
    const m = prefill.mode ?? (prefill.url ? "link" : prefill.company ? "manual" : readMode());
    setMode(m);
    setFocusRole(!!prefill.company);
    setD({ ...empty(today), company: prefill.company ?? "", url: prefill.url ?? "" });
    setLinkStep("link");
    setError(null);
    setReading(false);
    setSaving(false);
    setOpen(true);
    loadKeysStatus()
      .then((k) => {
        setKeys(k);
        setModel(effectiveScrapeModel(k));
      })
      .catch(() => setModel(effectiveScrapeModel(null)));
  };

  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    const onOpen = (e: Event) => startRef.current(prefillOf(e));
    const onModel = () => setModel(effectiveScrapeModel(null));
    window.addEventListener(OPEN_NEW_APPLICATION, onOpen);
    window.addEventListener(SCRAPE_MODEL_CHANGED, onModel);
    return () => {
      window.removeEventListener(OPEN_NEW_APPLICATION, onOpen);
      window.removeEventListener(SCRAPE_MODEL_CHANGED, onModel);
    };
  }, []);

  const changeMode = (m: NewApplicationMode) => {
    setMode(m);
    setError(null);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const duplicate = useMemo<Application | null>(() => {
    const u = normalizeUrl(d.url);
    if (!u || !/^https?:\/\//i.test(u)) return null;
    return apps.data?.find((a) => a.url && normalizeUrl(a.url) === u) ?? null;
  }, [d.url, apps.data]);

  const knownCompany = useMemo(() => {
    const c = d.company.trim().toLowerCase();
    if (!c) return null;
    return apps.data?.find((a) => String(a.company_name ?? "").trim().toLowerCase() === c)?.company_name ?? null;
  }, [d.company, apps.data]);

  const info = scrapeModelInfo(model);
  const modelKeyMissing = keys ? !keys[info.key] : false;

  const read = async () => {
    setError(null);
    const url = d.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setError("Paste the full link, starting with https://");
      return;
    }
    setReading(true);
    try {
      if (FIXTURE_MODE) throw new Error("Reading a posting calls the AI model with your key, so it is off in fixture mode. Use Manual or Paste JD.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("You are signed out. Sign in again, then try the link.");
      const res = await apiJson<Scraped>("scrape-job", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ url, applied: false, model }),
      });
      const j = res.fullJobEntry ?? {};
      setD((x) => ({
        ...x,
        company: j.company_name?.trim() || x.company,
        role: j.role?.trim() || x.role,
        location: j.location?.trim() || x.location,
        url: j.url?.trim() || url,
      }));
      setLinkStep("review");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The posting could not be read.";
      setError(
        /key/i.test(msg) ? (
          <>
            {msg}{" "}
            <Link href="/settings#api-keys" onClick={() => setOpen(false)} className="underline underline-offset-4">
              Open Settings
            </Link>
          </>
        ) : (
          msg
        ),
      );
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!d.company.trim() || !d.role.trim()) {
      setError("Add the company and the role.");
      return;
    }
    if (mode === "paste" && !d.jd.trim()) {
      setError("Paste the job description first, or switch to Manual.");
      return;
    }
    setSaving(true);
    try {
      const created = await createApplication(
        {
          company: d.company,
          role: d.role,
          location: d.location,
          url: d.url,
          sentOn: d.sent ? d.sentOn || today : null,
          jd: mode === "paste" ? d.jd : null,
        },
        (apps.data ?? []).map((a) => a.slug).filter((s): s is string => !!s),
      );
      setOpen(false);
      const path = appPath({ id: created.id, slug: created.slug });
      show({
        text: `Added ${created.company} · ${created.role}${d.sent ? ", sent" : ", not sent yet"}`,
        action: { label: "Open", run: () => router.push(path) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The application was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const onPasteJd = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    const target = e.currentTarget;
    const { default: TurndownService } = await import("turndown");
    const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
    td.remove(["script", "style", "noscript", "iframe", "img"]);
    const md = td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
    const start = target.selectionStart ?? d.jd.length;
    const end = target.selectionEnd ?? d.jd.length;
    set("jd", d.jd.slice(0, start) + md + d.jd.slice(end));
  };

  const reviewing = mode !== "link" || linkStep === "review";

  const footer =
    mode === "link" && linkStep === "link" ? (
      <>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" form="new-app-form" variant="primary" icon={Sparkles} loading={reading} disabled={!d.url.trim()}>
          {reading ? "Reading the posting…" : "Read the posting"}
        </Button>
      </>
    ) : (
      <>
        {mode === "link" ? (
          <Button variant="quiet" icon={ArrowLeft} onClick={() => setLinkStep("link")} className="mr-auto">
            Change link
          </Button>
        ) : (
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        <Button type="submit" form="new-app-form" variant="primary" loading={saving}>
          Add application
        </Button>
      </>
    );

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="New application" width="md" footer={footer}>
      <SegmentedControl<NewApplicationMode>
        aria-label="How to add it"
        value={mode}
        onChange={changeMode}
        className="w-full [&>button]:flex-1"
        options={[
          { value: "link", label: <ModeLabel icon={<Link2 aria-hidden size={15} />}>From link</ModeLabel> },
          { value: "paste", label: <ModeLabel icon={<ClipboardPaste aria-hidden size={15} />}>Paste JD</ModeLabel> },
          { value: "manual", label: <ModeLabel icon={<PenLine aria-hidden size={15} />}>Manual</ModeLabel> },
        ]}
      />

      <form
        id="new-app-form"
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "link" && linkStep === "link") void read();
          else void save();
        }}
      >
        {mode === "link" && linkStep === "link" ? (
          <>
            <Field label="Link to the posting" hint={`Read by ${info.label}. The AI model is chosen in Settings.`}>
              <Input
                type="url"
                inputMode="url"
                value={d.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://jobs.ashbyhq.com/…"
                autoFocus
                data-autofocus
                autoComplete="off"
              />
            </Field>
            {modelKeyMissing ? (
              <Callout tone="caution">
                {info.label} needs a {info.provider} key.{" "}
                <Link href="/settings#api-keys" onClick={() => setOpen(false)} className="underline underline-offset-4">
                  Add it in Settings
                </Link>
                , or use Paste JD.
              </Callout>
            ) : null}
            <p className="text-small text-ink-2">You check what it found before anything is saved.</p>
          </>
        ) : null}

        {mode === "paste" ? (
          <Field label="Job description" hint={d.jd ? `${d.jd.length.toLocaleString("en")} characters. Kept as the posting snapshot.` : "Paste the whole posting. Headings and lists are kept."}>
            <Textarea
              value={d.jd}
              onChange={(e) => set("jd", e.target.value)}
              onPaste={onPasteJd}
              rows={9}
              autoFocus
              data-autofocus
              placeholder="Paste the job description"
              className="font-serif text-body leading-7"
            />
          </Field>
        ) : null}

        {reviewing ? (
          <>
            {mode === "link" ? (
              <Callout tone="info" title="Check what was read">
                <span className="break-all">{d.url}</span>
              </Callout>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Company"
                hint={d.company.trim() ? (knownCompany ? (knownCompany === d.company.trim() ? "Already in your companies." : `Matches ${knownCompany} in your companies.`) : "A new company is added too.") : undefined}
              >
                <Input value={d.company} onChange={(e) => set("company", e.target.value)} autoComplete="off" data-autofocus={(mode === "manual" && !focusRole) || undefined} required />
              </Field>
              <Field label="Role">
                <Input value={d.role} onChange={(e) => set("role", e.target.value)} autoComplete="off" data-autofocus={(mode === "manual" && focusRole) || undefined} required />
              </Field>
              <Field label="Location">
                <Input value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="City, country" autoComplete="off" />
              </Field>
              {mode !== "link" ? (
                <Field label="Link" hint="Optional">
                  <Input type="url" inputMode="url" value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" autoComplete="off" />
                </Field>
              ) : null}
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1.5 text-small font-medium text-ink">Status</legend>
              <SegmentedControl<"no" | "yes">
                aria-label="Status"
                className="self-start"
                value={d.sent ? "yes" : "no"}
                onChange={(v) => set("sent", v === "yes")}
                options={[
                  { value: "no", label: "Not sent yet" },
                  { value: "yes", label: "Already sent" },
                ]}
              />
              {d.sent ? (
                <Field label="Sent on">
                  <DateInput value={d.sentOn} max={today} onChange={(e) => set("sentOn", e.target.value)} className="max-w-44" />
                </Field>
              ) : null}
            </fieldset>
          </>
        ) : null}

        {duplicate ? (
          <Callout
            tone="caution"
            title="You already track this link"
            action={
              <ButtonLink size="sm" href={appPath({ id: Number(duplicate.id), slug: duplicate.slug })} onClick={() => setOpen(false)}>
                Open {duplicate.company_name}
              </ButtonLink>
            }
          >
            {duplicate.company_name} · {duplicate.role}. Adding it again makes a second application.
          </Callout>
        ) : null}

        {error ? (
          <p role="alert" className={cx("rounded-sm bg-danger-soft px-3 py-2 text-small text-danger")}>
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

function ModeLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center justify-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

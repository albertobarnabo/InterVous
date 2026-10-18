"use client";

import { ArrowUpRight, ChevronRight, Pencil, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatShort } from "../../../../../lib/core";
import type { Application } from "../../../../../lib/data";
import { Button, Callout, CompanyMark, Field, Input, PhaseDot, PhasePill, Sheet, Skeleton, Tag, Textarea, cx, useToast } from "@/ui";
import { openNewApplicationWith } from "@/features/new-application/events";
import {
  domainOf,
  getCompanyInfo,
  researchCompany,
  saveCompanyInfo,
  type CompanyInfo,
  type CompanyWithTags,
} from "../_lib/companies";
import { appDate, appDateUnsure, dossierPath, nowOf, summaryLine } from "../_lib/match";

type Props = {
  /** The company to show; null closes the sheet (the last company stays drawn while it slides out). */
  company: CompanyWithTags | null;
  apps: Application[];
  appsLoading: boolean;
  today: string;
  tavily: boolean;
  onClose: () => void;
  onEdit: (c: CompanyWithTags) => void;
};

type Draft = { description: string; industry: string; headquarters: string; founded: string; employee_count: string };
const FACTS: Array<[keyof Draft, string]> = [
  ["industry", "Industry"],
  ["headquarters", "Headquarters"],
  ["founded", "Founded"],
  ["employee_count", "Employees"],
];

const toDraft = (i: Partial<CompanyInfo> | null): Draft => ({
  description: i?.description ?? "",
  industry: i?.industry ?? "",
  headquarters: i?.headquarters ?? "",
  founded: i?.founded ?? "",
  employee_count: i?.employee_count ?? "",
});

/** The slide-over for one company: its applications first, then what it is (About, with Auto-fill). */
export function CompanyPanel({ company, apps, appsLoading, today, tavily, onClose, onEdit }: Props) {
  const [last, setLast] = useState<CompanyWithTags | null>(company);
  useEffect(() => {
    if (company) setLast(company);
  }, [company]);
  const c = company ?? last;

  return (
    <Sheet
      open={!!company}
      onClose={onClose}
      title={c?.name ?? ""}
      description={summaryLine(apps)}
      footer={
        c ? (
          <>
            <Button icon={Pencil} onClick={() => onEdit(c)}>
              Edit company
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                onClose();
                openNewApplicationWith({ company: c.name });
              }}
            >
              New application here
            </Button>
          </>
        ) : null
      }
    >
      {c ? <PanelBody company={c} apps={apps} appsLoading={appsLoading} today={today} tavily={tavily} /> : null}
    </Sheet>
  );
}

function PanelBody({ company, apps, appsLoading, today, tavily }: Omit<Props, "company" | "onClose" | "onEdit"> & { company: CompanyWithTags }) {
  const domain = domainOf(company.website);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-3">
        <CompanyMark name={company.name} logoUrl={company.logo_url} size={48} />
        <div className="min-w-0 flex-1">
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex max-w-full items-center gap-1 text-small text-accent underline-offset-4 hover:underline"
            >
              <span className="truncate">{domain}</span>
              <ArrowUpRight aria-hidden size={14} className="shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="text-small text-ink-3">No website saved</p>
          )}
          {company.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {company.tags.map((t) => (
                <Tag key={t.id}>{t.name}</Tag>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="your-apps">
        <h3 id="your-apps" className="text-body font-semibold text-ink">
          Your applications here
        </h3>
        {appsLoading && !apps.length ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </div>
        ) : apps.length === 0 ? (
          <p className="mt-2 text-small text-ink-2">
            None yet. Applications match a company by its record, or by the same name when they have none.
          </p>
        ) : (
          <ul className="-mx-2 mt-2 flex flex-col">
            {apps.map((a) => (
              <li key={a.id}>
                <Link
                  href={dossierPath(a)}
                  className="group flex min-h-16 items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <PhaseDot phase={a.phase} label="" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium text-ink">{a.role || "Role not recorded"}</span>
                    <span className="block truncate text-caption font-normal text-ink-2">
                      {nowOf(a, today)}
                    </span>
                  </span>
                  <span className="hidden flex-col items-end gap-1 sm:flex">
                    <PhasePill phase={a.phase} size="sm" />
                    {appDate(a) ? (
                      <span
                        title={appDateUnsure(a) ? "Sent date not confirmed" : undefined}
                        className={cx("iv-num text-caption font-normal text-ink-3", appDateUnsure(a) && "underline decoration-dotted underline-offset-4")}
                      >
                        {formatShort(appDate(a), { today })}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-3 transition-transform duration-[120ms] group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <About company={company} tavily={tavily} />
    </div>
  );
}

function About({ company, tavily }: { company: CompanyWithTags; tavily: boolean }) {
  const { show } = useToast();
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fromWeb, setFromWeb] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [researching, setResearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setEditing(false);
    setError(null);
    getCompanyInfo(company.id)
      .then((i) => live && setInfo(i))
      .catch(() => live && setInfo(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [company.id]);

  const hasInfo = useMemo(() => !!info && Object.values(toDraft(info)).some(Boolean), [info]);

  const research = async () => {
    setResearching(true);
    setError(null);
    try {
      const r = await researchCompany(company);
      setDraft(toDraft(r));
      setFromWeb(true);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-fill found nothing. Try again or fill it in yourself.");
    } finally {
      setResearching(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const t = (s: string) => s.trim() || null;
      const saved = await saveCompanyInfo({
        company_id: company.id,
        description: t(draft.description),
        industry: t(draft.industry),
        headquarters: t(draft.headquarters),
        founded: t(draft.founded),
        employee_count: t(draft.employee_count),
      });
      setInfo(saved);
      setEditing(false);
      setFromWeb(false);
      show({ text: "About saved" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="about-company">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="about-company" className="text-body font-semibold text-ink">
          About
        </h3>
        {!editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              icon={Sparkles}
              loading={researching}
              disabled={!tavily}
              title={tavily ? "Search the web and fill this in for you to check" : undefined}
              onClick={research}
            >
              {researching ? "Searching the web…" : "Auto-fill"}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              icon={Pencil}
              onClick={() => {
                setDraft(toDraft(info));
                setFromWeb(false);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          </div>
        ) : null}
      </div>
      {!tavily && !editing ? (
        <p className="mt-1 text-caption font-normal text-ink-3">
          Auto-fill needs a Tavily key.{" "}
          <Link href="/settings#api-keys" className="text-accent underline underline-offset-4">
            Add it in Settings
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-small text-danger">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {fromWeb ? (
            <Callout tone="info" title="Found on the web">
              Check it before you save. Nothing is stored until you do.
            </Callout>
          ) : null}
          <Field label="What they do">
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={4}
              placeholder="One or two sentences"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {FACTS.map(([k, label]) => (
              <Field key={k} label={label}>
                <Input value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="quiet"
              onClick={() => {
                setEditing(false);
                setFromWeb(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      ) : loading ? (
        <Skeleton lines={3} className="mt-3" />
      ) : hasInfo && info ? (
        <div className="mt-2 flex flex-col gap-4">
          {info.description ? <p className="text-small text-ink-2">{info.description}</p> : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {FACTS.filter(([k]) => info[k]).map(([k, label]) => (
              <div key={k}>
                <dt className="text-caption font-normal text-ink-3">{label}</dt>
                <dd className="text-small text-ink">{info[k]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-small text-ink-2">Nothing saved yet. Auto-fill searches the web; Edit lets you write it yourself.</p>
      )}
    </section>
  );
}

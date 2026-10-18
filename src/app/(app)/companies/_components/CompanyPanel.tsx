"use client";

import { ArrowUpRight, ChevronRight, ImagePlus, Link2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatShort } from "../../../../../lib/core";
import type { Application } from "../../../../../lib/data";
import { Button, CompanyMark, ConfirmDialog, Field, Input, Sheet, Skeleton, Textarea, useToast } from "@/ui";
import { StatusPill } from "@/features/dossier/glass";
import { openNewApplicationWith } from "@/features/new-application/events";
import {
  deleteCompany,
  domainOf,
  getCompanyInfo,
  researchCompany,
  saveCompanyInfo,
  type CompanyInfo,
  type CompanyWithTags,
} from "../_lib/companies";
import { dossierPath, summaryLine } from "../_lib/match";

type Props = {
  /** The company to show; null closes the sheet (the last company stays drawn while it slides out). */
  company: CompanyWithTags | null;
  apps: Application[];
  appsLoading: boolean;
  today: string;
  tavily: boolean;
  onClose: () => void;
  onEdit: (c: CompanyWithTags) => void;
  onLogo: (c: CompanyWithTags) => void;
  onLinkApp: (c: CompanyWithTags) => void;
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

/** The slide-over for one company: logo, its applications (and Link an application), then About. */
export function CompanyPanel({ company, apps, appsLoading, today, tavily, onClose, onEdit, onLogo, onLinkApp }: Props) {
  const { show } = useToast();
  const [last, setLast] = useState<CompanyWithTags | null>(company);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (company) setLast(company);
  }, [company]);
  const c = company ?? last;

  return (
    <>
      <Sheet
        open={!!company}
        onClose={onClose}
        title={c?.name ?? ""}
        description={summaryLine(apps)}
        footer={
          c ? (
            <>
              <Button variant="quiet" icon={Trash2} onClick={() => setConfirm(true)} className="mr-auto text-ink-2 hover:text-danger">
                Delete
              </Button>
              <Button icon={Pencil} onClick={() => onEdit(c)}>
                Edit
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {
                  onClose();
                  openNewApplicationWith({ company: c.name });
                }}
              >
                Add a job here
              </Button>
            </>
          ) : null
        }
      >
        {c ? (
          <PanelBody company={c} apps={apps} appsLoading={appsLoading} today={today} tavily={tavily} onLogo={onLogo} onLinkApp={onLinkApp} />
        ) : null}
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={c ? `Delete ${c.name}?` : "Delete this company?"}
        body={
          apps.length
            ? `Its ${apps.length === 1 ? "application stays" : `${apps.length} applications stay`}, just without a company link. This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Delete company"
        loading={deleting}
        onConfirm={async () => {
          if (!c) return;
          setDeleting(true);
          try {
            await deleteCompany(c.id);
            show({ text: `${c.name} deleted.` });
            setConfirm(false);
            onClose();
          } catch (e) {
            show({ kind: "error", text: e instanceof Error ? e.message : "It was not deleted. Try again." });
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}

function PanelBody({
  company,
  apps,
  appsLoading,
  today,
  tavily,
  onLogo,
  onLinkApp,
}: Omit<Props, "company" | "onClose" | "onEdit"> & { company: CompanyWithTags }) {
  const domain = domainOf(company.website);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <CompanyMark key={company.logo_url ?? "none"} name={company.name} logoUrl={company.logo_url} size={64} className="rounded-[16px]" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full cursor-pointer items-center gap-1 text-[15px] font-medium text-accent underline-offset-4 hover:underline"
            >
              <span className="truncate">{domain}</span>
              <ArrowUpRight aria-hidden size={15} className="shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="text-[15px] text-ink-2">No website saved</p>
          )}
          {company.tags.length ? <p className="text-[14px] text-ink-2">{company.tags.map((t) => t.name).join(" · ")}</p> : null}
          <Button size="sm" variant="secondary" icon={ImagePlus} onClick={() => onLogo(company)}>
            {company.logo_url ? "Change logo" : "Add logo"}
          </Button>
        </div>
      </div>

      <section aria-labelledby="company-apps">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="company-apps" className="text-[18px] font-semibold text-ink">
            Applications
          </h3>
          <Button size="sm" variant="secondary" icon={Link2} onClick={() => onLinkApp(company)}>
            Link an application
          </Button>
        </div>
        {appsLoading && !apps.length ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-14 rounded-[14px]" />
            <Skeleton className="h-14 rounded-[14px]" />
          </div>
        ) : apps.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-2">None yet. Add a job here, or link one of your applications.</p>
        ) : (
          <ul className="-mx-2 mt-2 flex flex-col">
            {apps.map((a) => {
              const date = a.phase === "draft" ? a.cv_built_on : a.applied_on;
              return (
                <li key={a.id}>
                  <Link
                    href={dossierPath(a)}
                    className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-white/70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium text-ink">{a.role || "Role not recorded"}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill phase={a.phase} />
                        {date ? (
                          <span className="text-[14px] text-ink-2">
                            {a.phase === "draft" ? "CV made" : "Sent"} {formatShort(date, { today })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight aria-hidden size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
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
      show({ text: "Saved." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="about-company">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="about-company" className="text-[18px] font-semibold text-ink">
          About
        </h3>
        {!editing ? (
          <div className="flex gap-2">
            <Button size="sm" icon={Sparkles} loading={researching} disabled={!tavily} onClick={research}>
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
        <p className="mt-1 text-[14px] text-ink-2">
          Auto-fill needs a Tavily key.{" "}
          <Link href="/settings#api-keys" className="cursor-pointer font-medium text-accent underline underline-offset-4">
            Add it in Settings
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[15px] text-danger">
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
            <p className="rounded-[14px] bg-white/70 px-3 py-2 text-[15px] text-ink">
              Found on the web. Check it before you save: nothing is stored until you do.
            </p>
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
          {info.description ? <p className="text-[16px] leading-[1.6] text-ink">{info.description}</p> : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {FACTS.filter(([k]) => info[k]).map(([k, label]) => (
              <div key={k}>
                <dt className="text-[14px] text-ink-2">{label}</dt>
                <dd className="text-[16px] text-ink">{info[k]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-[15px] text-ink-2">Nothing saved yet. Auto-fill searches the web for you; Edit lets you write it yourself.</p>
      )}
    </section>
  );
}

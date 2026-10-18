"use client";
// /applications/[ref]: one application on one page, no tabs.
//   top      logo, company (linked company, Change company / Link a company), role, place, status,
//            the next-step sentence and "What happened?"
//   then     CV you sent · Job description · Your answers · History · Notes
import { ArrowLeft, ArrowUpRight, ImagePlus, Lightbulb, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteApplication, useApplication, useSettings, wasDeleted } from "../../../lib/data";
import { Button, ButtonLink, CompanyMark, ConfirmDialog, Skeleton, cx, useToast } from "@/ui";
import { CompanyPicker } from "@/app/(app)/companies/_components/CompanyPicker";
import { LogoDialog } from "@/app/(app)/companies/_components/LogoDialog";
import { Answers } from "./Answers";
import { CvSection } from "./CvSection";
import { shortDate } from "./format";
import { Card, StatusPill, glassClass } from "./glass";
import { History } from "./History";
import { JobDescription } from "./JobDescription";
import { useDossierModel, type DossierModel } from "./model";
import { Notes } from "./Notes";
import { nextStep, waitingLabel } from "./status";
import { WhatHappened } from "./WhatHappened";

function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-4 pt-6 pb-24 sm:px-6 lg:pt-10">{children}</div>;
}

function BackLink() {
  return (
    <Link
      href="/applications"
      className="-ml-1 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-[15px] font-medium text-ink-2 transition-colors hover:bg-white/60 hover:text-ink"
    >
      <ArrowLeft aria-hidden size={16} strokeWidth={2} />
      Applications
    </Link>
  );
}

function Loading() {
  return (
    <Card className="flex flex-col gap-4 p-6" aria-busy="true" aria-label="Loading the application">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-[14px]" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="w-1/2" />
      <Skeleton className="mt-4 h-16 w-full rounded-[14px]" />
    </Card>
  );
}

const TEXT_ACTION =
  "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full text-[14px] font-medium text-accent underline-offset-4 hover:underline pointer-coarse:min-h-10";

function companyHref(name: string) {
  return `/companies?company=${encodeURIComponent(name)}`;
}

/** The top card: who, what, where it stands, what to do next, and "What happened?". */
function Summary({ model }: { model: DossierModel }) {
  const { app, job, derived: d, today, dossier } = model;
  const company = dossier.company;
  const name = company?.name ?? app.company_name ?? "Company not recorded";
  const [picker, setPicker] = useState(false);
  const [logo, setLogo] = useState(false);
  const waiting = waitingLabel(d);
  const step = nextStep(d, model.settings, today);
  const facts = [
    app.location?.trim() || null,
    d.appliedOn ? `Sent ${shortDate(d.appliedOn, today)}` : d.phase === "draft" && d.cvBuiltOn ? `CV made ${shortDate(d.cvBuiltOn, today)}` : null,
  ].filter((x): x is string => !!x);
  const postUrl = app.url?.trim() || null;

  return (
    <Card as="header" className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <CompanyMark key={company?.logo_url ?? "none"} name={name} logoUrl={company?.logo_url ?? null} size={52} className="rounded-[14px]" />
          <div className="flex min-w-0 flex-1 flex-col items-start">
            {company ? (
              <Link href={companyHref(company.name)} className="max-w-full cursor-pointer truncate text-[17px] font-semibold text-ink underline-offset-4 hover:underline">
                {name}
              </Link>
            ) : (
              <span className="max-w-full truncate text-[17px] font-semibold text-ink">{name}</span>
            )}
            <span className="flex flex-wrap items-center gap-x-4">
              <button type="button" onClick={() => setPicker(true)} className={TEXT_ACTION}>
                {company ? "Change company" : "Link a company"}
              </button>
              {company && !company.logo_url ? (
                <button type="button" onClick={() => setLogo(true)} className={TEXT_ACTION}>
                  <ImagePlus aria-hidden size={15} strokeWidth={1.75} />
                  Add logo
                </button>
              ) : null}
            </span>
          </div>
        </div>
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.01em] text-ink [text-wrap:balance] sm:text-[30px]">
          {app.role || "Role not recorded"}
        </h1>
        {facts.length || postUrl ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
            {facts.map((f, i) => (
              <span key={f} className="inline-flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden className="text-ink-3">
                    ·
                  </span>
                ) : null}
                {f}
              </span>
            ))}
            {postUrl ? (
              <>
                {facts.length ? (
                  <span aria-hidden className="text-ink-3">
                    ·
                  </span>
                ) : null}
                <a href={postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-0.5 font-medium text-accent underline-offset-4 hover:underline">
                  Job post
                  <ArrowUpRight aria-hidden size={15} />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusPill phase={d.phase} />
        {waiting ? <span className="text-[15px] text-ink-2">{waiting}</span> : null}
      </div>

      {step ? (
        <div className="flex items-start gap-3 rounded-[16px] bg-[color-mix(in_srgb,var(--accent)_9%,white)] px-4 py-3.5">
          <Lightbulb aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[16px] leading-6 text-ink">
            <span className="font-semibold">Next step: </span>
            {step}
          </p>
        </div>
      ) : null}

      <WhatHappened model={model} />

      <CompanyPicker
        open={picker}
        onClose={() => setPicker(false)}
        job={{ id: app.id, company_name: name, role: app.role, company_id: job.company_id ?? null }}
      />
      <LogoDialog open={logo} onClose={() => setLogo(false)} company={company ? { ...company, website: company.website } : null} />
    </Card>
  );
}

function DeleteApplication({ model }: { model: DossierModel }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex justify-center pt-2">
      <Button variant="quiet" icon={Trash2} onClick={() => setOpen(true)} className="text-ink-2 hover:text-danger">
        Delete this application
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this application?"
        body={`${model.app.company_name} · ${model.app.role}. Its history, CV and notes are deleted too. This cannot be undone.`}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteApplication(model.app.id);
            toast.show({ text: "Application deleted." });
            setOpen(false);
            router.replace("/applications");
          } catch (e) {
            toast.show({ kind: "error", text: e instanceof Error ? e.message : "It was not deleted. Try again." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** /applications/[ref]: one application, one page. */
export function ApplicationPage({ appRef }: { appRef: string }) {
  const { data, error, loading, refetch } = useApplication(appRef);
  const settings = useSettings();
  const model = useDossierModel(data, settings.data);
  const params = useSearchParams();
  const [openJd, setOpenJd] = useState(0);
  // After a delete the refetch returns nothing: say "Deleted" (not "not found") until the redirect lands.
  const shownId = useRef<number | null>(null);
  if (model) shownId.current = model.app.id;

  // Old links (?tab=cv|posting|answers) scroll to the matching section.
  const tab = params.get("tab");
  const ready = !!model;
  useEffect(() => {
    if (!ready || !tab) return;
    const id = tab === "cv" ? "cv" : tab === "posting" || tab === "fit" ? "job-description" : tab === "answers" ? "answers" : null;
    if (!id) return;
    if (id === "job-description") setOpenJd((n) => n + 1);
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(t);
  }, [ready, tab]);

  // The browser tab names the application.
  const company = model?.dossier.company?.name ?? model?.app.company_name ?? null;
  const role = model?.app.role ?? null;
  useEffect(() => {
    if (!company && !role) return;
    const want = `${[company, role].filter(Boolean).join(" · ")} · InterVous`;
    const path = window.location.pathname;
    const apply = () => {
      if (window.location.pathname === path && document.title !== want) document.title = want;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [company, role]);

  if (loading && !data) {
    return (
      <Frame>
        <BackLink />
        <Loading />
      </Frame>
    );
  }
  if (error && !data) {
    return (
      <Frame>
        <BackLink />
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-[18px] font-semibold text-ink">This application could not be loaded</p>
          <p className="text-[15px] text-ink-2">{error.message}</p>
          <Button variant="primary" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      </Frame>
    );
  }
  if (!data && wasDeleted(shownId.current)) {
    return (
      <Frame>
        <p role="status" className="py-10 text-[16px] text-ink-2">
          Deleted. Opening Applications…
        </p>
      </Frame>
    );
  }
  if (!data || !model) {
    return (
      <Frame>
        <BackLink />
        <div className={cx(glassClass, "flex flex-col items-center gap-3 px-6 py-12 text-center")}>
          <SearchX aria-hidden size={28} strokeWidth={1.5} className="text-ink-3" />
          <p className="text-[18px] font-semibold text-ink">This application doesn&apos;t exist</p>
          <p className="max-w-md text-[15px] text-ink-2">It may have been deleted, or the link is out of date.</p>
          <ButtonLink href="/applications" variant="primary" className="mt-2">
            See all applications
          </ButtonLink>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <BackLink />
      <Summary model={model} />
      <CvSection model={model} />
      <JobDescription model={model} openSignal={openJd} />
      <Answers model={model} />
      <History model={model} />
      <Notes jobId={model.app.id} notes={model.job.notes ?? null} />
      <DeleteApplication model={model} />
    </Frame>
  );
}

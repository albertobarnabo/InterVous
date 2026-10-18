"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApplication, useSettings, wasDeleted } from "../../../lib/data";
import { Button, ButtonLink, Callout, EmptyState, Skeleton, TabPanel, Tabs, cx, isTypingTarget } from "@/ui";
import { AnswersTab } from "./AnswersTab";
import { ConfirmFacts } from "./ConfirmFacts";
import { CvTab } from "./CvTab";
import { FitTab } from "./FitTab";
import { Header } from "./Header";
import { InterviewCallout } from "./InterviewCallout";
import { useDossierModel, type DossierModel } from "./model";
import { gridFacts } from "./facts";
import { NextAction, showNextAction } from "./NextAction";
import { Contacts, FactsGrid, OverviewTab } from "./OverviewTab";
import { PostingTab } from "./PostingTab";
import { Stepper } from "./Stepper";

export const TAB_IDS = ["overview", "cv", "posting", "fit", "answers"] as const;
export type TabId = (typeof TAB_IDS)[number];

function isTab(v: string | null): v is TabId {
  return !!v && (TAB_IDS as readonly string[]).includes(v);
}

function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the application">
      <Skeleton className="h-5 w-28" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-10 w-4/5" />
      <Skeleton className="w-1/2" />
      <Skeleton className="mt-6 h-24 w-full rounded-md" />
      <Skeleton className="mt-4 h-11 w-full" />
      <Skeleton lines={4} className="mt-4" />
    </div>
  );
}

function SideColumn({ model }: { model: DossierModel }) {
  return (
    <aside aria-label="Facts" className="hidden lg:block">
      <div className="sticky top-[calc(var(--topbar-h)+24px)] flex flex-col gap-6">
        {showNextAction(model) ? (
          <div className="rounded-md bg-surface p-4 shadow-1">
            <NextAction model={model} />
          </div>
        ) : null}
        {gridFacts(model.app, model.job, model.today).length ? (
          <div className="rounded-md bg-surface p-4 shadow-1">
            <FactsGrid model={model} />
          </div>
        ) : null}
        {model.dossier.contacts.length ? (
          <section className="flex flex-col gap-3 px-1">
            <h2 className="text-small font-semibold text-ink">Contacts</h2>
            <Contacts model={model} />
          </section>
        ) : null}
      </div>
    </aside>
  );
}

/** /applications/[ref]: the dossier of one application (spec 2.3). */
export function DossierPage({ appRef }: { appRef: string }) {
  const { data, error, loading, refetch } = useApplication(appRef);
  const settings = useSettings();
  const model = useDossierModel(data, settings.data);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const [tab, setTabState] = useState<TabId>(isTab(fromUrl) ? fromUrl : "overview");
  const [focusReq, setFocusReq] = useState<string | null>(null);
  // The id of the application last shown here: after a delete the refetch returns nothing, and the
  // page says "Deleted" (not "No application at this address") until the redirect lands.
  const shownId = useRef<number | null>(null);
  if (model) shownId.current = model.app.id;

  // Back/forward and links that change ?tab= keep the panel in step.
  useEffect(() => {
    setTabState(isTab(fromUrl) ? fromUrl : "overview");
  }, [fromUrl]);

  const setTab = useCallback(
    (next: TabId) => {
      setTabState(next);
      const q = new URLSearchParams(window.location.search);
      if (next === "overview") q.delete("tab");
      else q.set("tab", next);
      const s = q.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    },
    [pathname, router],
  );

  // Keys 1–5 switch tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog][aria-modal=true]")) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > TAB_IDS.length) return;
      e.preventDefault();
      setTab(TAB_IDS[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);

  // The tab title names the application. Next re-applies the route metadata ("InterVous") on every
  // ?tab= change, so the title is re-asserted whenever <head> changes while this dossier is the page.
  const company = model?.app.company_name ?? null;
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

  let content: ReactNode;
  if (loading && !data) content = <Loading />;
  else if (error && !data) {
    content = (
      <Callout
        tone="danger"
        title="This application could not be loaded"
        action={
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      >
        {error.message}
      </Callout>
    );
  } else if (!data && wasDeleted(shownId.current)) {
    content = (
      <p role="status" className="py-10 text-small text-ink-2">
        Deleted. Opening Applications…
      </p>
    );
  } else if (!data || !model) {
    content = (
      <EmptyState
        icon={SearchX}
        title="No application at this address"
        body={
          <>
            Nothing matches <span className="font-mono">{decodeURIComponent(appRef)}</span>. It may have been deleted or renamed.
          </>
        }
        action={<ButtonLink href="/applications">All applications</ButtonLink>}
      />
    );
  } else {
    const fitCount = model.dossier.requirements.length;
    const answerCount = model.dossier.answers.length;
    const tabs = [
      { id: "overview" as const, label: "Overview" },
      { id: "cv" as const, label: "CV" },
      { id: "posting" as const, label: "Posting" },
      { id: "fit" as const, label: "Fit", count: fitCount || undefined },
      { id: "answers" as const, label: "Answers", count: answerCount || undefined },
    ];
    const overview = tab === "overview";
    content = (
      <div className={cx("grid grid-cols-1 gap-10", overview && "lg:grid-cols-[minmax(0,720px)_280px] lg:justify-between lg:gap-12")}>
        <div className="flex min-w-0 max-w-[720px] flex-col gap-6">
          <Header model={model} nextActionClassName={overview ? "lg:hidden" : undefined} />
          <ConfirmFacts model={model} />
          <div className="rounded-md bg-surface px-2 pt-3 pb-4 shadow-1 sm:px-4">
            <Stepper model={model} />
          </div>
          <InterviewCallout model={model} />
          <div className="flex flex-col gap-6">
            <Tabs idBase="dossier" aria-label="Dossier sections" tabs={tabs} value={tab} onChange={setTab} className="-mx-1" />
            <TabPanel tabId={tab} idBase="dossier">
              {tab === "overview" ? <OverviewTab model={model} /> : null}
              {tab === "cv" ? <CvTab model={model} /> : null}
              {tab === "posting" ? <PostingTab model={model} focusReq={focusReq} onFocusDone={() => setFocusReq(null)} /> : null}
              {tab === "fit" ? (
                <FitTab
                  model={model}
                  onShowInPosting={(id) => {
                    setFocusReq(id);
                    setTab("posting");
                  }}
                />
              ) : null}
              {tab === "answers" ? <AnswersTab model={model} /> : null}
            </TabPanel>
          </div>
        </div>
        {overview ? <SideColumn model={model} /> : null}
      </div>
    );
  }

  return <div className="iv-page pt-6 pb-16 lg:pt-8">{content}</div>;
}

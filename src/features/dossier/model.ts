"use client";
// Everything the dossier derives from one application: the lib/core input, the now sentence,
// the stepper, the "before the interview, check" callout and the confirm questions.
// No rule is re-implemented here; it all comes from lib/core.
import { useEffect, useMemo, useState } from "react";
import {
  beforeInterviewChecks,
  buildContext,
  buildStepper,
  confirmQuestions,
  isOpen,
  nowSentence,
  type ConfirmQuestion,
  type CoreInput,
  type Derived,
  type InterviewChecks,
  type JobOverviewRow,
  type Stepper,
} from "../../../lib/core";
import { FIXTURE_MODE, todayIn, type Dossier, type JobRow, type UserSettings } from "../../../lib/data";

/** Today in the settings time zone, or the fixture's pinned date in fixture mode. */
export function useToday(settings: UserSettings | undefined): string {
  const tz = settings?.timezone ?? "Europe/Berlin";
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => {
    if (!FIXTURE_MODE) return;
    let live = true;
    void import("../../../lib/data/fixture").then(async (m) => {
      const f = await m.loadFixture();
      if (live) setPinned(m.fixtureToday(f));
    });
    return () => {
      live = false;
    };
  }, []);
  return pinned ?? todayIn(tz);
}

export type DossierModel = {
  /** The job_overview row with the jobs columns merged in. */
  app: JobOverviewRow;
  /** The raw jobs row (status_evidence, seniority, cv_variant, notes...). */
  job: JobRow;
  dossier: Dossier;
  derived: Derived;
  input: CoreInput;
  today: string;
  now: string;
  stepper: Stepper;
  checks: InterviewChecks;
  /** Checks exist but the callout rule (interviewing or interview within 7 days) is not met. */
  checksLater: boolean;
  questions: ConfirmQuestion[];
  uncertain: Set<string>;
};

/** The job_overview row with the jobs columns merged in (salary, work mode, notes...). */
function appRow(d: Dossier): JobOverviewRow {
  return { ...(d.job as unknown as JobOverviewRow), ...((d.overview ?? {}) as Partial<JobOverviewRow>) } as JobOverviewRow;
}

export function buildModel(d: Dossier, settings: UserSettings | undefined, today: string): DossierModel {
  const app = appRow(d);
  const proofPoints = d.proofPoints.map((p) => p.proof_point).filter((p): p is NonNullable<typeof p> => !!p);
  const input: CoreInput = {
    apps: [app],
    events: d.events as unknown as CoreInput["events"],
    requirements: d.requirements as unknown as CoreInput["requirements"],
    jobProofPoints: d.proofPoints.map((u) => ({
      job_id: u.job_id,
      proof_point_id: u.proof_point_id,
      position: u.position,
      detail: u.detail,
    })) as CoreInput["jobProofPoints"],
    proofPoints: proofPoints as unknown as CoreInput["proofPoints"],
    contacts: d.contacts as unknown as CoreInput["contacts"],
    settings: settings ?? null,
    today,
  };
  const ctx = buildContext(input);
  const derived = ctx.byId.get(app.id) as Derived;
  const nowCtx = { today, events: input.events, settings: input.settings };
  const checks = beforeInterviewChecks(input, app.id);
  const anyChecks = checks.cautions.length + checks.proofPoints.length > 0;
  return {
    app,
    job: d.job,
    dossier: d,
    derived,
    input,
    today,
    now: nowSentence(derived, nowCtx),
    stepper: buildStepper(derived, nowCtx),
    checks,
    checksLater: !checks.show && anyChecks && derived.sent && isOpen(derived.phase),
    questions: confirmQuestions([derived], today, ctx.settings.draft_stale_after_days),
    uncertain: new Set(derived.uncertain),
  };
}

export function useDossierModel(d: Dossier | null | undefined, settings: UserSettings | undefined): DossierModel | null {
  const today = useToday(settings);
  return useMemo(() => (d ? buildModel(d, settings, today) : null), [d, settings, today]);
}

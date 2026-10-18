"use client";
// What the application page derives from one application. No rule is re-implemented here:
// the derived facts (sent, waiting days, next interview...) come from lib/core.
import { useMemo } from "react";
import { buildContext, resolveSettings, type CoreInput, type Derived, type JobOverviewRow } from "../../../lib/core";
import { useToday, type Dossier, type JobRow, type UserSettings } from "../../../lib/data";

export type DossierModel = {
  /** The job_overview row with the jobs columns merged in. */
  app: JobOverviewRow;
  /** The raw jobs row (notes, url...). */
  job: JobRow;
  dossier: Dossier;
  derived: Derived;
  settings: UserSettings;
  today: string;
};

/** The job_overview row with the jobs columns merged in (notes, salary, work mode...). */
function appRow(d: Dossier): JobOverviewRow {
  return { ...(d.job as unknown as JobOverviewRow), ...((d.overview ?? {}) as Partial<JobOverviewRow>) } as JobOverviewRow;
}

export function buildModel(d: Dossier, settings: UserSettings | undefined, today: string): DossierModel {
  const app = appRow(d);
  const input: CoreInput = {
    apps: [app],
    events: d.events as unknown as CoreInput["events"],
    requirements: [],
    jobProofPoints: [],
    proofPoints: [],
    contacts: d.contacts as unknown as CoreInput["contacts"],
    settings: settings ?? null,
    today,
  };
  const ctx = buildContext(input);
  return {
    app,
    job: d.job,
    dossier: d,
    derived: ctx.byId.get(app.id) as Derived,
    settings: resolveSettings(settings ?? null) as unknown as UserSettings,
    today,
  };
}

export function useDossierModel(d: Dossier | null | undefined, settings: UserSettings | undefined): DossierModel | null {
  const today = useToday();
  return useMemo(() => (d ? buildModel(d, settings, today) : null), [d, settings, today]);
}

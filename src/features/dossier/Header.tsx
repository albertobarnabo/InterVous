"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Fragment, useLayoutEffect } from "react";
import { CompanyMark, PhasePill, cx } from "@/ui";
import { viewTransitionNames, viewTransitionTargetReady } from "@/features/applications/viewTransition";
import { factLine } from "./facts";
import type { DossierModel } from "./model";
import { NextAction, showNextAction } from "./NextAction";
import { PhaseActions } from "./PhaseActions";
import { Unsure } from "./Unsure";

/** The always-visible dossier header (spec 2.3). */
export function Header({ model, nextActionClassName }: { model: DossierModel; nextActionClassName?: string }) {
  const { app, job, uncertain, now } = model;
  const logo = model.dossier.company?.logo_url ?? null;
  const facts = factLine(app);
  // The same names the clicked list row carries, so the mark and the title morph into place.
  const vt = viewTransitionNames(app.id);
  // Tells a pending list → dossier transition that the named mark and title are in the DOM.
  useLayoutEffect(() => viewTransitionTargetReady(app.id), [app.id]);

  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/applications"
        className="-ml-1 inline-flex w-fit items-center gap-1.5 rounded-sm px-1 py-1 text-small text-ink-2 hover:text-ink pointer-coarse:min-h-11"
      >
        <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
        Applications
      </Link>

      <div className="flex items-center gap-3">
        <CompanyMark name={app.company_name} logoUrl={logo} size={48} viewTransitionName={vt.mark} />
        <p className="min-w-0 text-body font-medium text-ink-2">{app.company_name}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h1
          className="font-serif text-h1-sm text-ink sm:text-h1 [text-wrap:balance]"
          style={{ viewTransitionName: vt.role }}
        >
          {app.role}
        </h1>
        {facts.length ? (
          <p className="text-small text-ink-2">
            {facts.map((f, i) => (
              <Fragment key={f.field}>
                {i > 0 ? <span aria-hidden className="px-1.5 text-ink-3">·</span> : null}
                <Unsure unsure={uncertain.has(f.field)} evidence={job.status_evidence}>
                  <span>{f.text}</span>
                </Unsure>
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Unsure unsure={uncertain.has("phase")} evidence={job.status_evidence}>
          <span className="inline-flex">
            <PhasePill phase={app.phase} />
          </span>
        </Unsure>
        <p className="text-small text-ink">{now}</p>
      </div>

      <div className="flex flex-wrap gap-2 empty:hidden">
        <PhaseActions model={model} />
      </div>

      {showNextAction(model) ? <NextAction model={model} className={cx(nextActionClassName)} /> : null}
    </header>
  );
}

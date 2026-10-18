"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { FIXTURE_MODE, type JobDocument } from "../../../lib/data";
import { Button, cx } from "@/ui";
import { shortDate } from "./format";
import { Section, solidClass } from "./glass";
import { Markdown } from "./Markdown";
import type { DossierModel } from "./model";

/** The newest saved copy of the job post. */
export function jdSnapshot(docs: JobDocument[]): JobDocument | null {
  return docs.find((d) => d.kind === "jd_snapshot" && !!d.content?.trim()) ?? null;
}

function OriginalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex cursor-pointer items-center gap-1 font-medium text-accent underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink aria-hidden size={14} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** "Job description": the saved copy of the job post, collapsed until asked for, on an opaque surface. */
export function JobDescription({ model, openSignal }: { model: DossierModel; openSignal?: number }) {
  const { app, today } = model;
  const doc = jdSnapshot(model.dossier.documents);
  const link = doc?.source_url || app.url || null;
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  // Asked to open from outside (an old ?tab=posting link).
  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  if (!doc) {
    let text: string;
    if (FIXTURE_MODE && app.has_jd) text = "A copy of the job post is saved, but files don't load in preview mode.";
    else if (app.posting_live === false) text = "No copy of the job post was saved, and the post is no longer online.";
    else text = "No copy of the job post was saved.";
    return (
      <Section id="job-description" title="Job description">
        <p className="text-[16px] text-ink-2">
          {text}{" "}
          {link && app.posting_live !== false ? <OriginalLink href={link}>Open the job post</OriginalLink> : null}
        </p>
      </Section>
    );
  }

  const saved = (doc.captured_at ?? doc.created_at)?.slice(0, 10) ?? null;
  return (
    <Section
      id="job-description"
      title="Job description"
      description={
        <>
          {saved ? `Saved ${shortDate(saved, today)}.` : "Saved."}
          {app.posting_live === false ? " The job post is no longer online." : null}{" "}
          {link && app.posting_live !== false ? <OriginalLink href={link}>Open the original</OriginalLink> : null}
        </>
      }
      action={
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronDown}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={cx("[&_svg]:transition-transform", open && "[&_svg]:rotate-180")}
        >
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      {open ? (
        <div id={bodyId} className={cx(solidClass, "px-5 py-5 sm:px-7 sm:py-6")}>
          <Markdown text={doc.content ?? ""} className="max-w-[70ch] text-[16px] leading-[1.65] text-ink" />
        </div>
      ) : null}
    </Section>
  );
}

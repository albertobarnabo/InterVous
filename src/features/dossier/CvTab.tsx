"use client";

import { BadgeCheck, Download, ExternalLink, FileCode2, FileX2, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FIXTURE_MODE, signedUrl, type JobDocument } from "../../../lib/data";
import { Callout, Select, Tag, buttonClass, cx } from "@/ui";
import { fileSize, shortDate } from "./format";
import type { DossierModel } from "./model";
import { PdfViewer, type PdfState } from "./PdfViewer";

/** Signed URLs live 10 minutes; fetch new ones a minute before they expire. */
const REFRESH_MS = 9 * 60 * 1000;

function docDate(d: JobDocument): string | null {
  return (d.captured_at ?? d.created_at)?.slice(0, 10) ?? null;
}

function fileName(d: JobDocument, fallback: string): string {
  const fromPath = d.storage_path?.split("/").pop()?.replace(/^[0-9a-f]{12}-/, "");
  return fromPath && !fromPath.startsWith("data:") ? fromPath : `${fallback}.pdf`;
}

/** Fixture mode only: a document whose storage_path is a data: URL is shown as is (no storage exists). */
function devUrl(d: JobDocument): string | null {
  return FIXTURE_MODE && d.storage_path?.startsWith("data:application/pdf") ? d.storage_path : null;
}

function useSignedUrls(doc: JobDocument | null, name: string) {
  const [urls, setUrls] = useState<{ view: string; download: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const path = doc?.storage_path ?? null;

  useEffect(() => {
    setUrls(null);
    setError(null);
    if (!path) return;
    const dev = doc ? devUrl(doc) : null;
    if (dev) {
      setUrls({ view: dev, download: dev });
      return;
    }
    let live = true;
    Promise.all([signedUrl(path), signedUrl(path, { download: name })])
      .then(([view, download]) => {
        if (!live) return;
        if (view) setUrls({ view, download: download ?? view });
        else setUrls(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not open the file."));
    const t = setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doc identity changes on every refetch; path is the key
  }, [path, name, tick]);

  return { urls, error };
}

function Badge({ doc, model }: { doc: JobDocument; model: DossierModel }) {
  const { app, today } = model;
  const built = docDate(doc);
  if (doc.submitted === true) {
    return (
      <Tag tone="accent">
        <BadgeCheck aria-hidden size={14} /> Exact file you sent
      </Tag>
    );
  }
  if (!model.derived.sent) {
    return <Tag>{built ? `Built ${shortDate(built, today)}. Not sent yet.` : "Not sent yet."}</Tag>;
  }
  if (doc.submitted === false) {
    return (
      <Tag tone="caution">
        <History aria-hidden size={14} /> Not the file you sent
      </Tag>
    );
  }
  const sentOn = app.applied_on ? ` on ${shortDate(app.applied_on, today)}` : "";
  return (
    <Tag tone="caution" className="h-auto min-h-6 whitespace-normal py-0.5">
      <History aria-hidden size={14} className="shrink-0" />
      {built ? `Rebuilt on ${shortDate(built, today)}; the version you sent${sentOn} may differ` : `The version you sent${sentOn} may differ`}
    </Tag>
  );
}

/** The CV tab (spec 2.3): the real PDF, page by page, with version picker, Open full size and Download. */
export function CvTab({ model }: { model: DossierModel }) {
  const { app, today } = model;
  const docs = model.dossier.documents;
  const cvs = useMemo(() => docs.filter((d) => d.kind === "cv_pdf"), [docs]);
  const sources = useMemo(() => docs.filter((d) => d.kind === "cv_source" || d.kind === "cover_letter"), [docs]);
  const preferred = cvs.find((d) => d.submitted === true) ?? cvs[0] ?? null;
  const [pick, setPick] = useState<string | null>(null);
  const doc = cvs.find((d) => d.id === pick) ?? preferred;
  const name = doc ? fileName(doc, app.slug ?? `cv-${app.id}`) : "cv.pdf";
  const { urls, error } = useSignedUrls(doc, name);
  const [pdf, setPdf] = useState<PdfState>({ status: "loading" });

  if (!doc) {
    const portal = app.channel === "portal";
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-line-strong px-5 py-8">
        <p className="flex items-center gap-2 text-body font-medium text-ink">
          <FileX2 aria-hidden size={18} strokeWidth={1.75} className="text-ink-3" /> No CV on file
        </p>
        <p className="max-w-[60ch] text-small text-ink-2">
          {FIXTURE_MODE && app.has_cv
            ? "This application has a CV, but the fixture carries no document rows. The live app shows the PDF here."
            : portal
              ? `It was sent through ${app.channel_detail ? `the ${app.channel_detail}` : "a portal"}, which takes a form instead of a CV file.`
              : "Nothing was uploaded for this application. intervous sent --cv records the exact file you send."}
        </p>
      </div>
    );
  }

  const options = cvs.map((d) => ({
    value: d.id,
    label: `${d.label ?? "CV"} · ${shortDate(docDate(d), today) || "undated"}${d.submitted ? " · sent" : ""}`,
  }));
  const fixtureNoFile = FIXTURE_MODE && !urls && !error && !devUrl(doc);
  const title = `CV for ${app.company_name}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge doc={doc} model={model} />
          {pdf.status === "ready" ? (
            <span className="iv-num text-caption text-ink-3">
              {pdf.pages} {pdf.pages === 1 ? "page" : "pages"}
              {doc.size_bytes ? ` · ${fileSize(doc.size_bytes)}` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cvs.length > 1 ? (
            <Select aria-label="Version" size="sm" value={doc.id} onChange={setPick} options={options} className="w-64 max-w-full" />
          ) : null}
          <a
            href={urls?.view ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!urls}
            className={buttonClass("secondary", "sm")}
          >
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            Open full size
          </a>
          <a href={urls?.download ?? undefined} download={name} aria-disabled={!urls} className={buttonClass("secondary", "sm")}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            Download
          </a>
        </div>
      </div>

      {error ? (
        <Callout tone="danger" title="The file could not be opened">
          {error}
        </Callout>
      ) : fixtureNoFile ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-6 text-center">
          <p className="text-body font-medium text-ink">Fixture mode: files are not loaded</p>
          <p className="max-w-[48ch] text-small text-ink-2">
            The live app draws {doc.label ?? "the CV"} here from a 10-minute signed link. Storage is not reachable in fixture mode.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-surface shadow-1">
          {urls ? <PdfViewer key={doc.id} url={urls.view} title={title} onState={setPdf} /> : <div className="min-h-[480px]" />}
        </div>
      )}

      {pdf.status === "failed" ? (
        <p className="text-caption font-normal text-ink-3">
          Shown by the browser&apos;s own viewer. Some phones show only the first page there: use Open full size.
        </p>
      ) : null}

      {sources.length ? (
        <ul className="flex flex-col gap-1">
          {sources.map((s) => (
            <SourceRow key={s.id} doc={s} model={model} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SourceRow({ doc, model }: { doc: JobDocument; model: DossierModel }) {
  const name = fileName(doc, doc.kind === "cv_source" ? "cv-source" : "cover-letter").replace(/\.pdf$/, doc.kind === "cv_source" ? ".tex" : ".pdf");
  const { urls } = useSignedUrls(doc.storage_path ? doc : null, name);
  const label = doc.label ?? (doc.kind === "cv_source" ? "LaTeX source" : "Cover letter");
  return (
    <li className="flex items-center gap-2 text-small text-ink-2">
      <FileCode2 aria-hidden size={16} strokeWidth={1.75} className="text-ink-3" />
      <span>{label}</span>
      <span className="iv-num text-caption text-ink-3">{shortDate(docDate(doc), model.today)}</span>
      {urls ? (
        <a href={urls.download} download={name} className={cx("text-accent underline-offset-2 hover:underline")}>
          Download
        </a>
      ) : null}
    </li>
  );
}

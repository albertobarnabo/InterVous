"use client";

import { Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FIXTURE_MODE, signedUrl, type JobDocument } from "../../../lib/data";
import { Select, buttonClass, cx } from "@/ui";
import { fileSize, shortDate } from "./format";
import { Section, solidClass } from "./glass";
import type { DossierModel } from "./model";
import { PdfViewer, type PdfState } from "./PdfViewer";

/** Signed URLs live 10 minutes; fetch new ones a minute before they expire. */
const REFRESH_MS = 9 * 60 * 1000;

function docDate(d: JobDocument): string | null {
  return (d.captured_at ?? d.created_at)?.slice(0, 10) ?? null;
}

function fileName(d: JobDocument, fallback: string, ext = ".pdf"): string {
  const fromPath = d.storage_path?.split("/").pop()?.replace(/^[0-9a-f]{12}-/, "");
  return fromPath && !fromPath.startsWith("data:") ? fromPath : `${fallback}${ext}`;
}

/** Fixture mode only: a document whose storage_path is a data: URL is shown as is (no storage exists). */
function devUrl(d: JobDocument): string | null {
  return FIXTURE_MODE && d.storage_path?.startsWith("data:") ? d.storage_path : null;
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
        setUrls(view ? { view, download: download ?? view } : null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "The file could not be opened."));
    const t = setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doc identity changes on every refetch; path is the key
  }, [path, name, tick]);

  return { urls, error };
}

function linkButton(disabled: boolean) {
  return cx(buttonClass("secondary", "sm"), disabled && "pointer-events-none opacity-50");
}

/** "CV you sent": the real PDF, page by page, with Open and Download. */
export function CvSection({ model }: { model: DossierModel }) {
  const { app, today, derived } = model;
  const docs = model.dossier.documents;
  const cvs = useMemo(() => docs.filter((d) => d.kind === "cv_pdf"), [docs]);
  const extras = useMemo(() => docs.filter((d) => d.kind === "cover_letter" || d.kind === "cv_source"), [docs]);
  const preferred = cvs.find((d) => d.submitted === true) ?? cvs[0] ?? null;
  const [pick, setPick] = useState<string | null>(null);
  const doc = cvs.find((d) => d.id === pick) ?? preferred;
  const name = doc ? fileName(doc, app.slug ?? `cv-${app.id}`) : "cv.pdf";
  const { urls, error } = useSignedUrls(doc, name);
  const [pdf, setPdf] = useState<PdfState>({ status: "loading" });
  const title = derived.sent ? "CV you sent" : "Your CV for this job";

  if (!doc) {
    return (
      <Section id="cv" title={title}>
        <p className="flex items-start gap-2 text-[16px] text-ink-2">
          <FileText aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
          {FIXTURE_MODE && app.has_cv
            ? "This application has a CV, but files don't load in preview mode."
            : "No CV is saved for this application. When you build a CV with the InterVous command line, the exact PDF appears here."}
        </p>
      </Section>
    );
  }

  const built = docDate(doc);
  const caption =
    doc.submitted === true
      ? "This is the exact file you sent."
      : derived.sent
        ? `Made ${shortDate(built, today) || "on an unknown date"}. It may differ a little from the file you sent.`
        : `Made ${shortDate(built, today) || "on an unknown date"}.`;
  const pages = pdf.status === "ready" ? `${pdf.pages} ${pdf.pages === 1 ? "page" : "pages"}${doc.size_bytes ? ` · ${fileSize(doc.size_bytes)}` : ""}` : null;

  return (
    <Section
      id="cv"
      title={title}
      description={
        <>
          {caption}
          {pages ? <span className="text-ink-3"> {pages}</span> : null}
        </>
      }
      action={
        <>
          <a href={urls?.view ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!urls} className={linkButton(!urls)}>
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            Open
          </a>
          <a href={urls?.download ?? undefined} download={name} aria-disabled={!urls} className={linkButton(!urls)}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            Download
          </a>
        </>
      }
    >
      {cvs.length > 1 ? (
        <div className="mb-3 max-w-sm">
          <Select
            aria-label="Which version"
            size="sm"
            value={doc.id}
            onChange={setPick}
            options={cvs.map((d) => ({
              value: d.id,
              label: `${d.label ?? "CV"} · ${shortDate(docDate(d), today) || "undated"}${d.submitted ? " · the one you sent" : ""}`,
            }))}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[15px] text-danger">
          The file could not be opened: {error}
        </p>
      ) : FIXTURE_MODE && !urls && !devUrl(doc) ? (
        <p className="text-[16px] text-ink-2">Files don&apos;t load in preview mode.</p>
      ) : (
        <div className={cx(solidClass, "max-h-[72vh] overflow-y-auto overscroll-contain bg-white p-0")}>
          {urls ? <PdfViewer key={doc.id} url={urls.view} title={`CV for ${app.company_name}`} onState={setPdf} /> : <div className="min-h-[420px]" />}
        </div>
      )}

      {pdf.status === "failed" ? (
        <p className="mt-2 text-[14px] text-ink-3">Some phones show only the first page here. Use Open to see all of it.</p>
      ) : null}

      {extras.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {extras.map((x) => (
            <ExtraFile key={x.id} doc={x} model={model} />
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function ExtraFile({ doc, model }: { doc: JobDocument; model: DossierModel }) {
  const source = doc.kind === "cv_source";
  const name = fileName(doc, source ? "cv-source" : "cover-letter", source ? ".tex" : ".pdf");
  const { urls } = useSignedUrls(doc.storage_path ? doc : null, name);
  const label = doc.label ?? (source ? "CV source file" : "Cover letter");
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-2">
      <FileText aria-hidden size={16} strokeWidth={1.75} className="text-ink-3" />
      <span className="text-ink">{label}</span>
      <span className="text-ink-3">{shortDate(docDate(doc), model.today)}</span>
      {urls ? (
        <a href={urls.download} download={name} className="cursor-pointer font-medium text-accent underline-offset-4 hover:underline">
          Download
        </a>
      ) : null}
    </li>
  );
}

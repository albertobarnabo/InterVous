"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/ui";

/** Served from public/ so the path works under basePath (spec 8, WP7). */
const WORKER_SRC = "/intervous/pdf.worker.min.mjs";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return m;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

export type PdfState = { status: "loading" } | { status: "ready"; pages: number } | { status: "failed"; message: string };

/**
 * The real PDF, page by page at the width of its column (pdf.js, canvas per page, drawn at the
 * device pixel ratio). On any pdf.js failure it falls back to an <iframe src="…#view=FitH">;
 * the caller keeps "Open full size" visible because iOS Safari shows only page 1 in an iframe.
 */
export function PdfViewer({ url, title, onState }: { url: string; title: string; onState?: (s: PdfState) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PdfState>({ status: "loading" });
  const [width, setWidth] = useState(0);
  const report = useRef(onState);
  report.current = onState;

  useEffect(() => {
    report.current?.(state);
  }, [state]);

  // Re-render on width changes (rounded to 40px steps so a scrollbar does not trigger a redraw).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width / 40) * 40;
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !width) return;
    let cancelled = false;
    const tasks: Array<{ cancel: () => void }> = [];
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));

    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ url });
        tasks.push({ cancel: () => void task.destroy() });
        const doc = await task.promise;
        if (cancelled) return;
        const cssWidth = el.clientWidth;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = cssWidth / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.className = "block bg-white";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${title}, page ${n} of ${doc.numPages}`);
          const render = page.render({ canvas, viewport });
          tasks.push(render);
          await render.promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        el.replaceChildren(
          ...canvases.map((c, i) => {
            const frame = document.createElement("div");
            frame.className = i > 0 ? "border-t border-line" : "";
            frame.appendChild(c);
            return frame;
          }),
        );
        setState({ status: "ready", pages: doc.numPages });
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        if (name === "RenderingCancelledException") return;
        setState({ status: "failed", message: e instanceof Error ? e.message : "The PDF could not be drawn." });
      }
    })();

    return () => {
      cancelled = true;
      tasks.forEach((t) => {
        try {
          t.cancel();
        } catch {
          /* already finished */
        }
      });
    };
  }, [url, width, title]);

  if (state.status === "failed") {
    return (
      <iframe
        src={`${url}#view=FitH`}
        title={title}
        className="block h-[80vh] min-h-[480px] w-full bg-white"
      />
    );
  }

  return (
    <div className="relative">
      <div ref={host} className={cx("min-h-[480px] w-full", state.status === "loading" && "opacity-0")} />
      {state.status === "loading" ? (
        <div aria-live="polite" className="absolute inset-0 flex items-center justify-center text-small text-ink-3">
          Drawing the PDF…
        </div>
      ) : null}
    </div>
  );
}

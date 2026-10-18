"use client";
// A thumbnail of the real CV (page 1 of the newest cv_pdf), for Today's "Recently added".
// Falls back to a plain paper tile when there is no file, in fixture mode, or when pdf.js fails.
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FIXTURE_MODE, signedUrl } from "../../../lib/data";
import { db } from "../../../lib/data/client";
import { cx } from "@/ui";

const WORKER = "/intervous/pdf.worker.min.mjs";

async function newestCvPath(jobId: number): Promise<string | null> {
  if (FIXTURE_MODE) return null;
  const { data, error } = await db
    .from("job_documents")
    .select("storage_path")
    .eq("job_id", jobId)
    .eq("kind", "cv_pdf")
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as { storage_path: string | null } | null)?.storage_path ?? null;
}

export function CvThumb({ jobId, hasCv, width = 56, className }: { jobId: number; hasCv: boolean; width?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "none">(hasCv ? "idle" : "none");
  const height = Math.round(width * 1.414);

  useEffect(() => {
    if (!hasCv) return;
    let cancelled = false;
    (async () => {
      try {
        const path = await newestCvPath(jobId);
        const url = path ? await signedUrl(path) : null;
        if (!url || cancelled) {
          if (!cancelled) setState("none");
          return;
        }
        const pdfjs = await import("pdfjs-dist");
        if (pdfjs.GlobalWorkerOptions.workerSrc !== WORKER) pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
        const task = pdfjs.getDocument({ url });
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: (width * dpr) / base.width });
        const c = canvas.current;
        if (!c || cancelled) return;
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        await page.render({ canvas: c, viewport }).promise;
        if (!cancelled) setState("ready");
        void task.destroy();
      } catch {
        if (!cancelled) setState("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, hasCv, width]);

  return (
    <span
      aria-hidden
      className={cx("relative block shrink-0 overflow-hidden rounded-sm bg-surface shadow-1", className)}
      style={{ width, height }}
    >
      <canvas ref={canvas} className={cx("absolute inset-0 size-full", state === "ready" ? "opacity-100" : "opacity-0")} />
      {state !== "ready" ? (
        <span className="absolute inset-0 flex flex-col gap-1 p-2">
          {state === "none" && !hasCv ? (
            <FileText size={16} strokeWidth={1.5} className="m-auto text-ink-3" />
          ) : (
            <>
              <span className="h-1 w-3/4 rounded-full bg-line-strong" />
              <span className="h-0.5 w-full rounded-full bg-line" />
              <span className="h-0.5 w-5/6 rounded-full bg-line" />
              <span className="h-0.5 w-full rounded-full bg-line" />
              <span className="mt-1 h-0.5 w-2/3 rounded-full bg-line" />
              <span className="h-0.5 w-full rounded-full bg-line" />
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}

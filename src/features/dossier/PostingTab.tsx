"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { FIXTURE_MODE, type JobDocument, type JobRequirement } from "../../../lib/data";
import { Button, Callout, Tag, cx } from "@/ui";
import { rehypeAnchors, type Anchor } from "./anchors";
import { proofChipsFor, proofPointHref, toneOf, verdictLabel } from "./fit";
import { shortDate } from "./format";
import { Markdown, omitNode } from "./Markdown";
import type { DossierModel } from "./model";

const COLLAPSED_LINES = 14;
const LINE_PX = 30;

/** The newest JD snapshot of the application. */
export function jdSnapshot(docs: JobDocument[]): JobDocument | null {
  return docs.find((d) => d.kind === "jd_snapshot" && !!d.content?.trim()) ?? null;
}

function SourceBanner({ model, doc }: { model: DossierModel; doc: JobDocument | null }) {
  const { app, today } = model;
  const link = doc?.source_url || app.url || null;
  const open = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline">
      open <ExternalLink aria-hidden size={13} />
    </a>
  ) : null;

  let text: ReactNode;
  if (doc) {
    const captured = (doc.captured_at ?? doc.created_at)?.slice(0, 10) ?? null;
    if (app.posting_live === false) text = "The posting is gone. This snapshot is all that's left.";
    else if (captured && app.applied_on && captured > app.applied_on) text = `Captured ${shortDate(captured, today)}, after you applied.`;
    else if (captured) text = `Captured ${shortDate(captured, today)}, while building the CV.`;
    else text = "Snapshot saved, date unknown.";
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
        <FileText aria-hidden size={16} strokeWidth={1.75} className="text-ink-3" />
        <span>{text}</span>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
            Original <ExternalLink aria-hidden size={13} />
          </a>
        ) : null}
      </p>
    );
  }

  if (FIXTURE_MODE && app.has_jd) {
    return (
      <Callout tone="info" title="Fixture mode">
        This application has a saved posting, but the fixture carries no document rows. The live app shows the text here.
      </Callout>
    );
  }
  if (!link) text = <>No snapshot saved, and no link was recorded.</>;
  else if (app.posting_live === false) text = <>No snapshot saved. The posting is gone: {open}</>;
  else if (app.posting_live === true) text = <>No snapshot saved. The posting is still online: {open}</>;
  else text = <>No snapshot saved. The posting may still be online: {open}</>;
  return (
    <div className="rounded-md border border-dashed border-line-strong px-4 py-6 text-small text-ink-2">
      <p>{text}</p>
      <p className="mt-1 text-caption font-normal text-ink-3">
        <code className="font-mono">intervous add</code> saves the posting as Markdown when the CV is built.
      </p>
    </div>
  );
}

type Active = { ids: string[]; top: number; left: number; pinned: boolean };

/** The hover/focus card for one underlined sentence. */
function AnchorCard({ reqs, model }: { reqs: JobRequirement[]; model: DossierModel }) {
  return (
    <div className="flex flex-col gap-3">
      {reqs.map((r) => {
        const chips = proofChipsFor(r, model.dossier.proofPoints);
        return (
          <div key={r.id} className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2">
              <Tag tone={toneOf(r)}>{verdictLabel(r)}</Tag>
              {r.importance === "nice" ? <span className="text-caption text-ink-3">Nice to have</span> : null}
            </p>
            <p className="text-small font-medium text-ink">{r.requirement}</p>
            {r.evidence ? <p className="text-small text-ink-2">{r.evidence}</p> : null}
            {r.note ? <p className="text-caption font-normal text-ink-3">{r.note}</p> : null}
            {chips.length ? (
              <p className="mt-1 flex flex-wrap gap-1.5">
                {chips.map((p) => (
                  <Link key={p.id} href={proofPointHref(p.key)} className="rounded-sm bg-surface-2 px-2 py-0.5 text-caption text-ink-2 hover:text-ink">
                    {p.name}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type MarkCtx = {
  byId: Map<string, JobRequirement>;
  flash: string | null;
  onShow: (el: HTMLElement, pinned?: boolean) => void;
  onHide: () => void;
  onClose: () => void;
  onFocusCollapsed: () => void;
};
const MarkContext = createContext<MarkCtx | null>(null);

/** One underlined JD sentence. Stable component identity, so focus survives re-renders. */
function AnchorMark({ children, ...rest }: ComponentProps<"mark">) {
  const ctx = useContext(MarkContext);
  const ids = String((rest as Record<string, unknown>)["data-req"] ?? "").split(" ").filter(Boolean);
  if (!ctx) return <mark>{children}</mark>;
  const items = ids.map((id) => ctx.byId.get(id)).filter((r): r is JobRequirement => !!r);
  const tone = items.some((r) => toneOf(r) === "caution") ? "caution" : "accent";
  const label = items.map((r) => `${verdictLabel(r)}: ${r.requirement}`).join("; ");
  return (
    <mark
      data-req={ids.join(" ")}
      tabIndex={0}
      className={cx(
        "cursor-help rounded-[3px] bg-transparent text-inherit underline decoration-2 underline-offset-[5px]",
        "transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-offset-1",
        tone === "caution" ? "decoration-caution" : "decoration-accent",
        ctx.flash !== null && ids.includes(ctx.flash) && "bg-accent-soft",
      )}
      onMouseEnter={(e) => ctx.onShow(e.currentTarget)}
      onMouseLeave={ctx.onHide}
      onFocus={(e) => {
        ctx.onFocusCollapsed();
        ctx.onShow(e.currentTarget);
      }}
      onBlur={ctx.onHide}
      onClick={(e) => ctx.onShow(e.currentTarget, true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") ctx.onClose();
      }}
    >
      {children}
      {label ? <span className="sr-only"> ({label})</span> : null}
    </mark>
  );
}

const MARK_COMPONENTS: Components = {
  mark: function MdMark(props) {
    return <AnchorMark {...omitNode(props)} />;
  },
};

/**
 * The JD snapshot in serif at 18px, 68 characters wide (spec 2.3, Posting). A sentence that holds a
 * fit item's anchor_text is underlined (teal: met or partial, amber: gap or claim); hover or focus
 * shows that fit item. Starts at 14 lines with a fade and "Read the full posting".
 */
export function PostingTab({ model, focusReq, onFocusDone }: { model: DossierModel; focusReq?: string | null; onFocusDone?: () => void }) {
  const doc = jdSnapshot(model.dossier.documents);
  const reduce = useReducedMotion();
  const reqs = model.dossier.requirements;
  const byId = useMemo(() => new Map(reqs.map((r) => [r.id, r])), [reqs]);
  const anchors: Anchor[] = useMemo(
    () => reqs.filter((r) => r.anchor_text?.trim()).map((r) => ({ id: r.id, text: r.anchor_text as string })),
    [reqs],
  );
  const plugins = useMemo(() => [rehypeAnchors(anchors)], [anchors]);

  const wrap = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [marked, setMarked] = useState(0);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    setOverflows(el.scrollHeight > COLLAPSED_LINES * LINE_PX + 8);
    const ids = new Set<string>();
    el.querySelectorAll<HTMLElement>("mark[data-req]").forEach((m) => m.dataset.req?.split(" ").forEach((id) => ids.add(id)));
    setMarked(ids.size);
  }, [doc?.content, plugins]);

  const place = useCallback((el: HTMLElement, pinned: boolean) => {
    const host = wrap.current;
    if (!host) return;
    const rects = el.getClientRects();
    const last = rects[rects.length - 1] ?? el.getBoundingClientRect();
    const first = rects[0] ?? last;
    const box = host.getBoundingClientRect();
    const width = Math.min(352, box.width);
    const left = Math.max(0, Math.min(first.left - box.left, box.width - width));
    setActive({ ids: (el.dataset.req ?? "").split(" ").filter(Boolean), top: last.bottom - box.top + 8, left, pinned });
  }, []);

  const show = (el: HTMLElement, pinned = false) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    place(el, pinned);
  };
  const hideSoon = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive((a) => (a?.pinned ? a : null)), 150);
  };

  // "Show in the posting" from the Fit tab: open the text, scroll to the sentence, show its card.
  useEffect(() => {
    if (!focusReq) return;
    setExpanded(true);
    const t = setTimeout(() => {
      const el = body.current?.querySelector<HTMLElement>(`mark[data-req~="${CSS.escape(focusReq)}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        el.focus({ preventScroll: true });
        show(el, true);
        setFlash(focusReq);
        setTimeout(() => setFlash(null), 1200);
      }
      onFocusDone?.();
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [focusReq]);

  useEffect(() => {
    if (!active?.pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setActive(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [active?.pinned]);

  const ctx = useMemo<MarkCtx>(
    () => ({ byId, flash, onShow: show, onHide: hideSoon, onClose: () => setActive(null), onFocusCollapsed: () => setExpanded(true) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- show/hideSoon only use refs and setters
    [byId, flash],
  );

  const activeReqs = active ? active.ids.map((id) => byId.get(id)).filter((r): r is JobRequirement => !!r) : [];
  const collapsed = overflows && !expanded;

  return (
    <div className="flex flex-col gap-5">
      <SourceBanner model={model} doc={doc} />
      {doc ? (
        <>
          {anchors.length ? (
            <p className="text-small text-ink-2">
              <span className="underline decoration-accent decoration-2 underline-offset-[5px]">Teal</span> marks what your CV answers,{" "}
              <span className="underline decoration-caution decoration-2 underline-offset-[5px]">amber</span> what it does not.{" "}
              <span className="iv-num text-ink-3">
                {marked} of {anchors.length}
              </span>{" "}
              <span className="text-ink-3">fit items found in the text.</span>
            </p>
          ) : null}
          <div ref={wrap} className="relative">
            <div
              ref={body}
              className={cx("iv-reading", collapsed && "overflow-hidden")}
              style={
                collapsed
                  ? {
                      maxHeight: COLLAPSED_LINES * LINE_PX,
                      maskImage: "linear-gradient(to bottom, #000 65%, transparent)",
                      WebkitMaskImage: "linear-gradient(to bottom, #000 65%, transparent)",
                    }
                  : undefined
              }
            >
              <MarkContext.Provider value={ctx}>
                <Markdown text={doc.content ?? ""} rehypePlugins={plugins} components={MARK_COMPONENTS} />
              </MarkContext.Provider>
            </div>
            <AnimatePresence>
              {active && activeReqs.length ? (
                <motion.div
                  key={active.ids.join(" ")}
                  role="tooltip"
                  initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onMouseEnter={() => hideTimer.current && clearTimeout(hideTimer.current)}
                  onMouseLeave={hideSoon}
                  className="absolute z-30 w-[min(22rem,100%)] rounded-md bg-surface p-4 shadow-2 ring-1 ring-line"
                  style={{ top: active.top, left: active.left }}
                >
                  <AnchorCard reqs={activeReqs} model={model} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {overflows ? (
            <Button
              variant="secondary"
              icon={ChevronDown}
              onClick={() => setExpanded((v) => !v)}
              className={cx("self-start", expanded && "[&_svg]:rotate-180")}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read the full posting"}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

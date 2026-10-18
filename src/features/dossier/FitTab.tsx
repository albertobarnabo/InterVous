"use client";

import { Check, ChevronDown, CornerDownRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { GAP_STATES, GAP_STATE_LABELS, METRIC_STATUS_LABELS, topicLabel, type GapState } from "../../../lib/core";
import { updateRequirement, type JobRequirement } from "../../../lib/data";
import { Menu, Tag, cx, useToast } from "@/ui";
import { anchorsFound } from "./anchors";
import { proofChipsFor, proofPointHref } from "./fit";
import type { DossierModel } from "./model";
import { jdSnapshot } from "./PostingTab";

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-baseline gap-2 text-h3 text-ink">
          {title}
          <span className="iv-num text-small font-normal text-ink-3">{count}</span>
        </h2>
        {hint ? <p className="mt-0.5 text-small text-ink-2">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ShowInPosting({ id, onShow }: { id: string; onShow: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onShow(id)}
      className="inline-flex items-center gap-1 rounded-sm text-caption text-accent underline-offset-2 hover:underline pointer-coarse:min-h-11"
    >
      <CornerDownRight aria-hidden size={13} /> Show in the posting
    </button>
  );
}

/** Topic (when it says more than the requirement) and note: "Years or seniority · added to CV". */
function meta(r: JobRequirement): string {
  const topic = r.topic && r.topic !== "other" ? topicLabel(r.topic) : null;
  const same = topic && topic.toLowerCase().replace(/[^a-z0-9]/g, "") === r.requirement.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [same ? null : topic, r.note].filter(Boolean).join(" · ");
}

const GAP_TONE: Record<GapState, "caution" | "neutral" | "accent"> = {
  open: "caution",
  worded_around: "neutral",
  not_claimed: "neutral",
  no_longer_true: "accent",
};

function GapChip({ r }: { r: JobRequirement }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const state = (r.gap_state ?? "open") as GapState;
  const tone = GAP_TONE[state];
  const set = async (next: GapState) => {
    if (next === state) return;
    setBusy(true);
    try {
      await updateRequirement(r.id, { gap_state: next });
      toast.show({
        text: `Marked as “${GAP_STATE_LABELS[next]}”.`,
        action: { label: "Undo", run: () => updateRequirement(r.id, { gap_state: state }) },
      });
    } catch (e) {
      toast.show({ kind: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Menu
      anchor="bottom start"
      className="min-w-56"
      trigger={
        <button
          type="button"
          aria-label={`State: ${GAP_STATE_LABELS[state]}. Change it`}
          disabled={busy}
          className={cx(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 text-caption transition-colors duration-[120ms] pointer-coarse:min-h-11",
            tone === "caution" && "border-transparent bg-caution-soft text-caution hover:border-caution",
            tone === "neutral" && "border-transparent bg-surface-2 text-ink-2 hover:border-line-strong",
            tone === "accent" && "border-transparent bg-accent-soft text-accent hover:border-accent",
          )}
        >
          {GAP_STATE_LABELS[state]}
          <ChevronDown aria-hidden size={13} />
        </button>
      }
      items={GAP_STATES.map((g) => ({ label: GAP_STATE_LABELS[g], icon: g === state ? Check : undefined, onSelect: () => void set(g) }))}
    />
  );
}

/**
 * The Fit tab (spec 2.3): what they asked and what you showed, the gaps with an editable state,
 * and the claims to check. Items whose anchor is in the JD link to it ("Show in the posting").
 */
export function FitTab({ model, onShowInPosting }: { model: DossierModel; onShowInPosting: (reqId: string) => void }) {
  const reqs = model.dossier.requirements;
  const used = model.dossier.proofPoints;
  const jd = jdSnapshot(model.dossier.documents);
  const found = useMemo(
    () => anchorsFound(jd?.content, reqs.filter((r) => r.anchor_text).map((r) => ({ id: r.id, text: r.anchor_text as string }))),
    [jd?.content, reqs],
  );
  const shown = reqs.filter((r) => r.verdict === "met" || r.verdict === "partial");
  const gaps = reqs.filter((r) => r.verdict === "gap");
  const claims = reqs.filter((r) => r.verdict === "caution");

  if (!reqs.length && !used.length) {
    return (
      <div className="rounded-md border border-dashed border-line-strong px-5 py-8 text-small text-ink-2">
        No fit notes for this application. <code className="font-mono">intervous add</code> records them from the CV build.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {shown.length ? (
        <Section title="What they asked and what you showed" count={shown.length}>
          <ul className="flex flex-col divide-y divide-line rounded-md bg-surface shadow-1">
            {shown.map((r) => {
              const chips = proofChipsFor(r, used);
              return (
                <li key={r.id} className="flex gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className={cx(
                      "mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                      r.verdict === "met" ? "bg-accent text-accent-ink" : "border-2 border-accent",
                    )}
                  >
                    {r.verdict === "met" ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-small font-medium text-ink">
                      <span>{r.requirement}</span>
                      {r.verdict === "partial" ? <Tag className="font-normal">Partly</Tag> : null}
                      {r.importance === "nice" ? <span className="text-caption font-normal text-ink-3">nice to have</span> : null}
                    </p>
                    {r.evidence ? <p className="mt-0.5 text-small text-ink-2">{r.evidence}</p> : null}
                    {chips.length || found.has(r.id) ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {chips.map((p) => (
                          <Link
                            key={p.id}
                            href={proofPointHref(p.key)}
                            className="inline-flex h-6 items-center rounded-sm bg-surface-2 px-2 text-caption text-ink-2 hover:text-ink pointer-coarse:min-h-11"
                          >
                            {p.name}
                          </Link>
                        ))}
                        {found.has(r.id) ? <ShowInPosting id={r.id} onShow={onShowInPosting} /> : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {gaps.length ? (
        <Section title="Gaps" count={gaps.length} hint="What the posting asks that the CV does not show. Set what you did about each.">
          <ul className="flex flex-col divide-y divide-line rounded-md bg-surface shadow-1">
            {gaps.map((r) => {
              const gone = r.gap_state === "no_longer_true";
              return (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className={cx("text-small font-medium", gone ? "text-ink-3 line-through decoration-ink-3" : "text-ink")}>{r.requirement}</p>
                    {meta(r) ? <p className="mt-0.5 text-caption font-normal text-ink-3">{meta(r)}</p> : null}
                    {found.has(r.id) ? <ShowInPosting id={r.id} onShow={onShowInPosting} /> : null}
                  </div>
                  <GapChip r={r} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {claims.length ? (
        <Section title="Claims to check" count={claims.length} hint="Things this application says that need the correct fact before you repeat them.">
          <ul className="flex flex-col gap-2">
            {claims.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-md bg-caution-soft px-4 py-3">
                <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-caution" />
                <div className="min-w-0">
                  <p className="text-small font-medium text-ink">{r.requirement}</p>
                  {r.evidence ? <p className="mt-0.5 max-w-[68ch] text-small text-ink-2">{r.evidence}</p> : null}
                  {found.has(r.id) ? <ShowInPosting id={r.id} onShow={onShowInPosting} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {used.length ? (
        <Section title="Proof points used" count={used.length} hint="How this application worded each one.">
          <ul className="flex flex-col divide-y divide-line rounded-md bg-surface shadow-1">
            {used.map((u) => {
              const p = u.proof_point;
              if (!p) return null;
              const careful = p.metric_status !== "verified";
              return (
                <li key={u.proof_point_id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <Link href={proofPointHref(p.key)} className="text-small font-medium text-ink underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                    {u.detail ? (
                      <p className="mt-0.5 text-small text-ink-2">
                        Here: <q>{u.detail}</q>
                      </p>
                    ) : null}
                    {careful && p.caveat ? <p className="mt-0.5 text-caption font-normal text-ink-3">{p.caveat}</p> : null}
                  </div>
                  {careful ? <Tag tone="caution">{METRIC_STATUS_LABELS[p.metric_status] ?? p.metric_status}</Tag> : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  METRIC_STATUS_LABELS,
  appPath,
  computeInsights,
  type CoreInput,
  type ExtractedNumber,
  type I7Flag,
  type I7ProofPoint,
  type I7Wording,
  type MetricStatus,
} from "../../../../../lib/core";
import { updateProofPoint, useInsightsInput, type ProofPoint } from "../../../../../lib/data";
import { Button, Callout, EmptyState, PhaseDot, PhasePill, SegmentedControl, Select, Skeleton, SkeletonRow, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";

type Row = {
  pp: ProofPoint;
  uses: number;
  sentUses: number;
  wordings: I7Wording[];
  flags: I7Flag[];
};

type Filter = "all" | "differ" | "unverified" | "unused";

const STATUS_TONE: Record<MetricStatus, string> = {
  verified: "bg-accent-soft text-accent",
  needs_care: "bg-caution-soft text-caution",
  unverified: "bg-danger-soft text-danger",
};

const factLabel = (k: string) => k.replace(/_/g, " ");

export default function ProofPointsView() {
  const input = useInsightsInput();

  const rows = useMemo<Row[] | null>(() => {
    if (!input.data) return null;
    const i7 = computeInsights(input.data as unknown as CoreInput, { window: "all" }).i7;
    const byId = new Map<string, I7ProofPoint>(i7.proofPoints.map((p) => [String(p.id), p]));
    const order = new Map(i7.proofPoints.map((p, i) => [String(p.id), i]));
    return [...input.data.proofPoints]
      .map((pp) => {
        const u = byId.get(String(pp.id));
        return { pp, uses: u?.uses ?? 0, sentUses: u?.sentUses ?? 0, wordings: u?.wordings ?? [], flags: u?.flags ?? [] };
      })
      .sort((a, b) => (order.get(String(a.pp.id)) ?? 1e9) - (order.get(String(b.pp.id)) ?? 1e9) || a.pp.name.localeCompare(b.pp.name));
  }, [input.data]);

  const [filter, setFilter] = useState<Filter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  // /proof-points#key (the dossier's chips) opens and scrolls to that row
  useEffect(() => {
    const go = () => {
      const key = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!key) return;
      setFilter("all");
      setOpenKey(key);
      // after the row has rendered open (and after Next's own scroll on navigation)
      setTimeout(() => document.getElementById(key)?.scrollIntoView({ block: "start", behavior: "smooth" }), 150);
    };
    if (rows) go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [rows]);

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      all: r.length,
      differ: r.filter((x) => x.flags.length).length,
      unverified: r.filter((x) => (x.pp.metric_status ?? "verified") !== "verified").length,
      unused: r.filter((x) => !x.uses).length,
    };
  }, [rows]);

  const shown = (rows ?? []).filter((r) =>
    filter === "differ" ? r.flags.length > 0 : filter === "unverified" ? (r.pp.metric_status ?? "verified") !== "verified" : filter === "unused" ? !r.uses : true,
  );

  const lead = rows
    ? [
        `${counts.all} proof point${counts.all === 1 ? "" : "s"}`,
        counts.differ ? `${counts.differ} told differently to different companies` : "the numbers agree everywhere",
        counts.unverified ? `${counts.unverified} not verified` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : " ";

  return (
    <div className="iv-page pb-8 pt-8 md:pt-10">
      <header>
        <h1 className="text-h1-sm text-ink sm:text-h1">Proof points</h1>
        <p className="mt-1 text-body text-ink-2">{lead}</p>
      </header>

      {rows && rows.length ? (
        <SegmentedControl<Filter>
          aria-label="Show"
          className="mt-6"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${counts.all}` },
            { value: "differ", label: `Numbers differ ${counts.differ}` },
            { value: "unverified", label: `Not verified ${counts.unverified}` },
            { value: "unused", label: `Unused ${counts.unused}` },
          ]}
        />
      ) : null}

      <div className="mt-6">
        {input.error && !rows ? (
          <Callout
            tone="danger"
            title="The proof points did not load"
            action={
              <Button size="sm" onClick={() => void input.refetch()}>
                Try again
              </Button>
            }
          >
            {input.error.message}
          </Callout>
        ) : !rows ? (
          <div className="flex flex-col gap-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No proof points yet"
            body="They arrive with each application the CLI adds: the projects and numbers each CV leans on."
          />
        ) : shown.length === 0 ? (
          <EmptyState title="None here" body="Nothing matches this filter." action={<Button onClick={() => setFilter("all")}>Show all</Button>} />
        ) : (
          <>
            <div
              aria-hidden
              className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_9.5rem_minmax(0,1.2fr)] gap-4 px-4 pb-2 text-caption text-ink-3 lg:grid"
            >
              <span>Proof point</span>
              <span>Metric</span>
              <span>Canonical facts</span>
              <span>Status</span>
              <span>Caveat</span>
            </div>
            <ul className="flex flex-col gap-2">
              {shown.map((r) => (
                <ProofPointRow
                  key={r.pp.id}
                  row={r}
                  open={openKey === r.pp.key}
                  onToggle={() => setOpenKey((k) => (k === r.pp.key ? null : r.pp.key))}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="text-caption font-normal text-ink-3 lg:sr-only">{label}</p>
      {children}
    </div>
  );
}

function ProofPointRow({ row, open, onToggle }: { row: Row; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const { pp } = row;
  const status = (pp.metric_status ?? "verified") as MetricStatus;
  const facts = Object.entries((pp.facts ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null && v !== "");
  const panelId = `pp-panel-${pp.id}`;

  return (
    <li id={pp.key} className={cx("scroll-mt-20 rounded-md bg-surface shadow-1", row.flags.length && "ring-1 ring-[var(--caution-fg)]/40")}>
      <div className="grid gap-x-4 gap-y-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_9.5rem_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <p className="text-body font-medium text-ink">{pp.name}</p>
          {pp.summary ? <p className="mt-0.5 text-small text-ink-2">{pp.summary}</p> : null}
          {row.flags.length ? (
            <p className="mt-1 flex items-center gap-1.5 text-caption text-caution">
              <TriangleAlert aria-hidden size={14} />
              Numbers differ
            </p>
          ) : null}
        </div>
        <Cell label="Metric">
          <InlineText
            label={`Metric of ${pp.name}`}
            value={pp.metric}
            placeholder="Add the headline number"
            onSave={(v) => updateProofPoint(pp.id, { metric: v })}
          />
        </Cell>
        <Cell label="Canonical facts">
          {facts.length ? (
            <dl className="flex flex-wrap gap-x-3 gap-y-1">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-1">
                  <dt className="text-caption font-normal text-ink-3">{factLabel(k)}</dt>
                  <dd className="iv-num text-small text-ink">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-small text-ink-3">None recorded</p>
          )}
        </Cell>
        <Cell label="Status">
          <StatusSelect pp={pp} status={status} />
        </Cell>
        <Cell label="Caveat">
          <InlineText
            label={`Caveat of ${pp.name}`}
            value={pp.caveat}
            placeholder="Add a caveat"
            multiline
            onSave={(v) => updateProofPoint(pp.id, { caveat: v })}
          />
        </Cell>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
        {row.uses ? (
          <>
            <span className="w-full text-caption font-normal text-ink-3 sm:w-auto">
              Used in {row.uses}
              {row.sentUses !== row.uses ? `, ${row.sentUses} sent` : ""}
            </span>
            <ul className="flex min-w-0 flex-1 basis-full flex-wrap gap-1.5 sm:basis-0">
              {row.wordings.map((w) => (
                <li key={w.appId}>
                  <Link
                    href={appPath({ id: w.appId, slug: w.slug })}
                    title={`${w.company} · ${w.role}${w.sent ? "" : " (not sent)"}`}
                    className="inline-flex h-7 max-w-56 items-center gap-1.5 rounded-sm bg-surface-2 px-2 text-caption font-normal text-ink-2 transition-colors duration-[120ms] hover:text-ink pointer-coarse:h-11"
                  >
                    <PhaseDot phase={w.phase} label="" />
                    <span className="truncate">{shortCompany(w.company)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-small font-medium text-accent hover:bg-accent-soft pointer-coarse:h-11"
            >
              What you told each company
              <ChevronDown aria-hidden size={16} className={cx("transition-transform duration-200", open && "rotate-180")} />
            </button>
          </>
        ) : (
          <span className="text-caption font-normal text-ink-3">Not used by any application yet</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && row.uses ? (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Told row={row} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/** "European Central Bank" → "ECB"; long names shortened for chips. */
function shortCompany(name: string) {
  if (/^european central bank$/i.test(name.trim())) return "ECB";
  const m = /\(via ([^)]+)\)/.exec(name);
  if (m) return m[1];
  return name.length > 24 ? `${name.slice(0, 22)}…` : name;
}

function Told({ row }: { row: Row }) {
  const flagged = new Map<number, Set<string>>();
  for (const f of row.flags) {
    if (f.appId != null) {
      const s = flagged.get(f.appId) ?? new Set<string>();
      if (f.value) s.add(f.value);
      flagged.set(f.appId, s);
    }
    for (const v of f.values ?? []) {
      for (const slug of v.apps) {
        const w = row.wordings.find((x) => x.slug === slug || String(x.appId) === slug);
        if (!w) continue;
        const s = flagged.get(w.appId) ?? new Set<string>();
        for (const n of w.numbers) if (n.metric === f.metric) s.add(n.raw);
        flagged.set(w.appId, s);
      }
    }
  }
  return (
    <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
      {row.flags.length ? (
        <Callout tone="caution" title="The numbers differ">
          <ul className="flex flex-col gap-1">
            {row.flags.map((f, i) => (
              <li key={i}>{f.text}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <ul className="flex flex-col divide-y divide-line">
        {row.wordings.map((w) => (
          <li key={w.appId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={appPath({ id: w.appId, slug: w.slug })} className="text-small font-medium text-ink underline-offset-4 hover:underline">
                {w.company} · {w.role}
              </Link>
              <PhasePill phase={w.phase} size="sm" />
            </div>
            {w.detail ? (
              <p className="max-w-[68ch] font-serif text-body text-ink">
                <Highlighted text={w.detail} numbers={w.numbers} flagged={flagged.get(w.appId)} />
              </p>
            ) : (
              <p className="text-small text-ink-3">Used, with no wording saved.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The wording with each number marked: amber when it is one of the differing numbers, teal otherwise. */
function Highlighted({ text, numbers, flagged }: { text: string; numbers: ExtractedNumber[]; flagged?: Set<string> }) {
  if (!numbers.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const n of numbers) {
    const i = text.indexOf(n.raw, at);
    if (i < 0) continue;
    if (i > at) parts.push(text.slice(at, i));
    const bad = flagged?.has(n.raw);
    parts.push(
      <mark
        key={`${i}-${n.raw}`}
        title={bad ? "Differs from the facts or from another application" : n.phrase}
        className={cx("iv-num rounded-sm px-1 text-[0.92em]", bad ? "bg-caution-soft text-caution" : "bg-accent-soft text-accent")}
      >
        {n.raw}
      </mark>,
    );
    at = i + n.raw.length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

function StatusSelect({ pp, status }: { pp: ProofPoint; status: MetricStatus }) {
  const { show } = useToast();
  const [value, setValue] = useState<MetricStatus>(status);
  useEffect(() => setValue(status), [status]);
  return (
    <Select<MetricStatus>
      aria-label={`Status of ${pp.name}`}
      size="sm"
      value={value}
      onChange={async (v) => {
        const prev = value;
        setValue(v);
        try {
          await updateProofPoint(pp.id, { metric_status: v });
          show({ text: `${pp.name}: ${METRIC_STATUS_LABELS[v].toLowerCase()}` });
        } catch (e) {
          setValue(prev);
          show({ kind: "error", text: e instanceof Error ? e.message : "The status was not saved." });
        }
      }}
      options={(Object.keys(METRIC_STATUS_LABELS) as MetricStatus[]).map((s) => ({
        value: s,
        text: METRIC_STATUS_LABELS[s],
        label: <span className={cx("inline-flex h-6 items-center rounded-sm px-2 text-caption", STATUS_TONE[s])}>{METRIC_STATUS_LABELS[s]}</span>,
      }))}
      className="w-full"
    />
  );
}

/** Click to edit; Enter or leaving the field saves, Esc cancels. */
function InlineText({
  label,
  value,
  placeholder,
  multiline,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  multiline?: boolean;
  onSave: (v: string | null) => Promise<unknown>;
}) {
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim() || null;
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
      show({ text: "Saved" });
    } catch (e) {
      show({ kind: "error", text: e instanceof Error ? e.message : "It was not saved." });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    const common = {
      ref,
      "aria-label": label,
      value: draft,
      disabled: saving,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value ?? "");
          setEditing(false);
        } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          void commit();
        }
      },
    };
    return multiline ? (
      <textarea {...common} rows={3} className={cx(controlClass, "py-1.5 leading-5")} />
    ) : (
      <input {...common} className={cx(controlClass, "h-8 pointer-coarse:h-11")} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${label}: ${value || "empty"}. Edit`}
      className={cx(
        "-mx-1.5 block w-[calc(100%+12px)] rounded-sm px-1.5 py-1 text-left text-small transition-colors duration-[120ms] hover:bg-surface-2",
        value ? "text-ink" : "text-ink-3",
      )}
    >
      {value || placeholder}
      {saving ? <Skeleton className="mt-1 h-1 w-10" /> : null}
    </button>
  );
}

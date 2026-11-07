"use client";
// The rows, in one glass card per status group ("All"), or one card for a single filter. The Closed
// group shows ten rows a page, with chips for why they closed ("Rejected at screening", "No reply").
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button, Chip, GlassCard } from "@/ui";
import { AppRow, type RowHandlers } from "./AppRow";
import { closedView, type AppItem, type Group, type Page } from "./model";

/** The Closed group's place in the URL: which reason it is filtered to, and the page. */
export type ClosedControls = { why: string; page: number; onChange: (patch: { why?: string; page?: number }) => void };

function Rows({ items, h }: { items: AppItem[]; h: RowHandlers }) {
  return (
    <GlassCard as="ul" padding="none" className="overflow-hidden divide-y divide-ink/[0.06]">
      {items.map((it) => (
        <li key={it.id} data-item-id={it.id}>
          <AppRow item={it} h={h} />
        </li>
      ))}
    </GlassCard>
  );
}

function Pager({ page, onGo }: { page: Page<AppItem>; onGo: (page: number) => void }) {
  return (
    <nav aria-label="Pages of closed applications" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
      <p aria-live="polite" className="iv-num text-small text-ink-2">
        {`${page.from}–${page.to} of ${page.total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page.page <= 1} onClick={() => onGo(page.page - 1)}>
          Previous
        </Button>
        <span className="iv-num px-1 text-small text-ink-2">
          {page.page} / {page.pages}
        </span>
        <Button size="sm" variant="secondary" disabled={page.page >= page.pages} onClick={() => onGo(page.page + 1)}>
          {/* The label sits in a span of its own, so the arrow goes with it on one line. */}
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            Next
            <ChevronRight aria-hidden size={16} strokeWidth={2} className="-mr-1" />
          </span>
        </Button>
      </div>
    </nav>
  );
}

/** Closed rows: why they closed, as filter chips with counts, then ten rows a page. */
function ClosedRows({ items, h, controls }: { items: AppItem[]; h: RowHandlers; controls: ClosedControls }) {
  const region = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const { reasons, active, page } = closedView(items, controls.why, controls.page);

  const go = (next: number) => {
    controls.onChange({ page: next });
    // Back to the first row of the new page; focus follows, for the keyboard and screen readers.
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rows.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      region.current?.focus({ preventScroll: true });
    });
  };

  return (
    <div
      ref={region}
      tabIndex={-1}
      role="region"
      aria-label="Closed applications"
      className="flex flex-col gap-3 rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      {reasons.length > 1 ? (
        <div role="group" aria-label="Why they closed" className="flex flex-wrap gap-1.5">
          <Chip selected={!active} onClick={() => controls.onChange({ why: "" })}>
            All <span className="iv-num opacity-75">{items.length}</span>
          </Chip>
          {reasons.map((r) => (
            <Chip key={r.id} selected={active === r.id} onClick={() => controls.onChange({ why: active === r.id ? "" : r.id })}>
              {r.label} <span className="iv-num opacity-75">{r.count}</span>
            </Chip>
          ))}
        </div>
      ) : null}
      <div ref={rows} className="scroll-mt-28">
        <Rows items={page.items} h={h} />
      </div>
      {page.pages > 1 ? <Pager page={page} onGo={go} /> : null}
    </div>
  );
}

export function ApplicationList({ groups, grouped, h, closed }: { groups: Group[]; grouped: boolean; h: RowHandlers; closed: ClosedControls }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (!grouped) {
    const only = shown.length === 1 ? shown[0] : null;
    return only?.id === "closed" ? <ClosedRows items={only.items} h={h} controls={closed} /> : <Rows items={shown.flatMap((g) => g.items)} h={h} />;
  }
  return (
    <div className="flex flex-col gap-8">
      {shown.map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`} className="flex flex-col gap-3">
          <h2 id={`group-${g.id}`} className="flex items-baseline gap-2 px-1 text-h3 text-ink">
            {g.label}
            <span className="iv-num text-small font-medium text-ink-3">{g.items.length}</span>
          </h2>
          {g.id === "closed" ? <ClosedRows items={g.items} h={h} controls={closed} /> : <Rows items={g.items} h={h} />}
        </section>
      ))}
    </div>
  );
}

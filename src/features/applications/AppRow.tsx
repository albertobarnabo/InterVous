"use client";
// One row of /applications: logo (or initials), company, role, the status in plain words, a short
// fact ("Waiting 17 days"), and ONE button (Mark as sent / Update / Open). The whole row opens the
// application page; the button sits above the row's link.
import Link from "next/link";
import { Button, ButtonLink, CompanyMark, StatusPill, cx } from "@/ui";
import type { AppItem } from "./model";

export type RowHandlers = {
  onMarkSent: (item: AppItem) => void;
  onUpdate: (item: AppItem) => void;
};

function RowButton({ item, h }: { item: AppItem; h: RowHandlers }) {
  const label = `${item.company}, ${item.role}`;
  switch (item.action) {
    case "mark_sent":
      return (
        <Button size="sm" variant="primary" onClick={() => h.onMarkSent(item)} aria-label={`Mark as sent: ${label}`}>
          Mark as sent
        </Button>
      );
    case "update":
      return (
        <Button size="sm" onClick={() => h.onUpdate(item)} aria-label={`Update: ${label}`}>
          Update
        </Button>
      );
    default:
      return (
        <ButtonLink size="sm" variant="quiet" href={item.href} aria-label={`Open: ${label}`} tabIndex={-1}>
          Open
        </ButtonLink>
      );
  }
}

export function AppRow({ item, h }: { item: AppItem; h: RowHandlers }) {
  const where = item.location ? ` · ${item.location}` : "";
  return (
    <div
      className={cx(
        "group relative grid items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors duration-150 sm:px-5",
        "grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_8.5rem]",
        "hover:bg-white/45 has-[a[data-row-link]:focus-visible]:bg-white/60",
        "has-[a[data-row-link]:focus-visible]:shadow-[inset_0_0_0_2px_var(--accent)]",
      )}
    >
      <span className="row-span-2 block self-start rounded-full md:row-span-1 md:self-center">
        <CompanyMark name={item.company} logoUrl={item.logoUrl} size={40} />
      </span>

      <div className="min-w-0">
        <Link
          href={item.href}
          data-row-link
          data-item-link={item.id}
          className="block min-w-0 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          <span className="block truncate text-body font-semibold text-ink">{item.company}</span>
          <span className="line-clamp-2 text-small text-ink-2 md:line-clamp-1">
            {item.role}
            <span className="hidden lg:inline">{where}</span>
          </span>
        </Link>
      </div>

      {/* Status: under the name on phones, its own column from 768px */}
      <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 md:col-start-3 md:row-start-1">
        <StatusPill status={item.phase} size="sm" />
        {item.detail ? <span className="iv-num text-small text-ink-2">{item.detail}</span> : null}
      </div>

      <div className="relative z-10 col-start-3 row-span-2 row-start-1 self-center justify-self-end md:col-start-4 md:row-span-1">
        <RowButton item={item} h={h} />
      </div>
    </div>
  );
}

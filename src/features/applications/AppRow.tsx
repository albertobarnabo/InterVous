"use client";
// One list row (docs/SPEC.md 2.2): 64px, a single <a> to the dossier. Left to right: company mark,
// role with company and location, the now sentence (with the age bar while waiting), the date,
// the phase pill, and the Unconfirmed / Visa chips. Under 768px it becomes a two-line card.
import Link from "next/link";
import { AgeBar, CompanyMark, PhasePill, Tag, cx } from "@/ui";
import type { AppItem } from "./model";
import { useTransitionNavigate } from "./viewTransition";

function UnconfirmedTag({ item }: { item: AppItem }) {
  if (!item.unconfirmed.length) return null;
  return (
    <Tag tone="caution" title={`Not confirmed yet: ${item.unconfirmed.join(", ")}`}>
      Unconfirmed
    </Tag>
  );
}

function VisaTag({ item }: { item: AppItem }) {
  if (!item.visa) return null;
  return <Tag title="This role needs a visa or work permit">Visa</Tag>;
}

/** The age bar is shown only while waiting for a reply (applied, screening). */
function showsAge(item: AppItem) {
  return item.waiting !== null && (item.phase === "applied" || item.phase === "screening");
}

export function AppRow({ item }: { item: AppItem }) {
  const navigate = useTransitionNavigate();
  const where = [item.company, item.location].filter(Boolean).join(" · ");
  const age = showsAge(item);
  const srDate = item.date.on ? `${item.date.label}.` : "";

  return (
    <Link
      href={item.href}
      data-item-link={item.id}
      onClick={(e) => navigate(e, item.id, item.href)}
      className={cx(
        "group block rounded-md outline-offset-[-2px] transition-colors duration-[120ms] ease-out",
        "hover:bg-surface-2 focus-visible:bg-surface-2",
      )}
    >
      {/* Desktop: one 64px line */}
      <span className="hidden h-16 grid-cols-[32px_minmax(0,1.3fr)_minmax(0,1fr)_52px_264px] items-center gap-3 px-4 md:grid">
        <span data-vt="mark" className="block size-8 rounded-sm">
          <CompanyMark name={item.company} logoUrl={item.logoUrl} size={32} />
        </span>
        <span className="min-w-0">
          <span data-vt="role" className="block truncate text-body font-medium text-ink">
            {item.role}
          </span>
          <span className="block truncate text-small text-ink-2">{where}</span>
        </span>
        <span className="min-w-0">
          <span className={cx("block text-small text-ink-2", age ? "truncate" : "line-clamp-2")} title={item.now}>
            {item.now}
          </span>
          {age ? <AgeBar days={item.waiting} className="mt-1.5 max-w-56" /> : null}
        </span>
        <span className="iv-num text-right text-caption text-ink-3" title={item.date.label}>
          <span className="sr-only">{srDate}</span>
          <span aria-hidden>{item.date.text || "—"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <PhasePill phase={item.phase} />
          <UnconfirmedTag item={item} />
          <VisaTag item={item} />
        </span>
      </span>

      {/* Mobile: a two-line card */}
      <span className="flex gap-3 px-4 py-3 md:hidden">
        <span data-vt="mark" className="mt-0.5 block size-8 shrink-0 rounded-sm">
          <CompanyMark name={item.company} logoUrl={item.logoUrl} size={32} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span data-vt="role" className="line-clamp-2 text-body font-medium text-ink">
                {item.role}
              </span>
              <span className="block truncate text-small text-ink-2">{where}</span>
            </span>
            <PhasePill phase={item.phase} size="sm" className="mt-0.5" />
          </span>
          <span className="mt-1.5 block text-small text-ink-2">{item.now}</span>
          {age ? <AgeBar days={item.waiting} className="mt-2" /> : null}
          {item.unconfirmed.length || item.visa ? (
            <span className="mt-2 flex flex-wrap gap-1.5">
              <UnconfirmedTag item={item} />
              <VisaTag item={item} />
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

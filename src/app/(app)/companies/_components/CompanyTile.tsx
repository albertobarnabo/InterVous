"use client";

import { Pencil } from "lucide-react";
import type { Application } from "../../../../../lib/data";
import { CompanyMark, IconButton, PhaseDot, Tag, cx } from "@/ui";
import { domainOf, type CompanyWithTags } from "../_lib/companies";
import { summaryLine } from "../_lib/match";

type Props = {
  company: CompanyWithTags;
  apps: Application[];
  onOpen: (c: CompanyWithTags) => void;
  onEdit: (c: CompanyWithTags) => void;
};

/** Up to 8 phase dots: one per application, the real state of each at a glance. */
function Dots({ apps }: { apps: Application[] }) {
  if (!apps.length) return null;
  return (
    <span aria-hidden className="flex items-center gap-1">
      {apps.slice(0, 8).map((a) => (
        <PhaseDot key={a.id} phase={a.phase} label="" />
      ))}
    </span>
  );
}

/** Grid view: a plain card. The name is the button that opens the company; Edit is always visible. */
export function CompanyCard({ company, apps, onOpen, onEdit }: Props) {
  const domain = domainOf(company.website);
  return (
    <article className="group relative flex min-h-32 min-w-0 flex-col rounded-md bg-surface p-4 shadow-1 transition-shadow duration-[120ms] ease-out hover:shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_rgb(29_27_22/0.06)]">
      <div className="flex items-start gap-3">
        <CompanyMark name={company.name} logoUrl={company.logo_url} size={40} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-body font-medium text-ink">
            <button
              type="button"
              onClick={() => onOpen(company)}
              className="text-left after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {company.name}
            </button>
          </h2>
          <p className="truncate text-caption font-normal text-ink-3">{domain ?? "No website"}</p>
        </div>
        <IconButton label={`Edit ${company.name}`} icon={Pencil} size="sm" onClick={() => onEdit(company)} className="relative z-10 -mr-1 -mt-1" />
      </div>
      {company.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {company.tags.slice(0, 4).map((t) => (
            <Tag key={t.id}>{t.name}</Tag>
          ))}
          {company.tags.length > 4 ? <Tag>+{company.tags.length - 4}</Tag> : null}
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Dots apps={apps} />
        <p className={cx("text-small", apps.length ? "text-ink-2" : "text-ink-3")}>{summaryLine(apps)}</p>
      </div>
    </article>
  );
}

/** List view: a 64px row. */
export function CompanyRow({ company, apps, onOpen, onEdit }: Props) {
  const domain = domainOf(company.website);
  return (
    <li className="group relative flex min-h-16 items-center gap-3 rounded-md bg-surface px-4 py-2 shadow-1 transition-shadow duration-[120ms] ease-out hover:shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_rgb(29_27_22/0.06)]">
      <CompanyMark name={company.name} logoUrl={company.logo_url} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">
          <button
            type="button"
            onClick={() => onOpen(company)}
            className="text-left after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {company.name}
          </button>
        </p>
        <p className="truncate text-caption font-normal text-ink-3">
          {domain ?? "No website"}
          <span className="sm:hidden"> · {summaryLine(apps)}</span>
        </p>
      </div>
      <div className="hidden max-w-64 flex-wrap justify-end gap-1.5 lg:flex">
        {company.tags.slice(0, 3).map((t) => (
          <Tag key={t.id}>{t.name}</Tag>
        ))}
        {company.tags.length > 3 ? <Tag>+{company.tags.length - 3}</Tag> : null}
      </div>
      <div className="hidden w-56 items-center justify-end gap-2 sm:flex">
        <Dots apps={apps} />
        <span className={cx("truncate text-small", apps.length ? "text-ink-2" : "text-ink-3")}>{summaryLine(apps)}</span>
      </div>
      <IconButton label={`Edit ${company.name}`} icon={Pencil} size="sm" onClick={() => onEdit(company)} className="relative z-10 -mr-1" />
    </li>
  );
}

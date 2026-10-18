"use client";

import { ImagePlus } from "lucide-react";
import type { Application } from "../../../../../lib/data";
import { Button, CompanyMark, cx } from "@/ui";
import { glassClass } from "@/features/dossier/glass";
import { domainOf, type CompanyWithTags } from "../_lib/companies";
import { summaryLine } from "../_lib/match";

type Props = {
  company: CompanyWithTags;
  apps: Application[];
  onOpen: (c: CompanyWithTags) => void;
  onAddLogo: (c: CompanyWithTags) => void;
};

/** One company in the grid. The whole card opens the company; "Add logo" shows while the logo is missing. */
export function CompanyCard({ company, apps, onOpen, onAddLogo }: Props) {
  const domain = domainOf(company.website);
  return (
    <article
      className={cx(
        glassClass,
        "group relative flex min-h-36 min-w-0 flex-col gap-3 p-5 transition-[transform,box-shadow] duration-150 ease-out",
        "hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_36px_rgba(15,23,42,0.12)]",
      )}
    >
      <div className="flex items-start gap-3.5">
        <CompanyMark key={company.logo_url ?? "none"} name={company.name} logoUrl={company.logo_url} size={48} className="rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] leading-6 font-semibold text-ink">
            <button
              type="button"
              onClick={() => onOpen(company)}
              className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {company.name}
            </button>
          </h2>
          <p className="truncate text-[14px] leading-5 text-ink-2">{domain ?? "No website saved"}</p>
        </div>
      </div>
      <p className={cx("text-[15px] leading-6", apps.length ? "text-ink" : "text-ink-2")}>{summaryLine(apps)}</p>
      {company.tags.length ? (
        <p className="truncate text-[14px] text-ink-2">{company.tags.map((t) => t.name).join(" · ")}</p>
      ) : null}
      {!company.logo_url ? (
        <div className="mt-auto pt-1">
          <Button size="sm" variant="secondary" icon={ImagePlus} onClick={() => onAddLogo(company)} className="relative z-10">
            Add logo
          </Button>
        </div>
      ) : null}
    </article>
  );
}

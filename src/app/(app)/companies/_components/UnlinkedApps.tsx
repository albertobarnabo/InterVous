"use client";

import { Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Application } from "../../../../../lib/data";
import { Button, CompanyMark, cx } from "@/ui";
import { glassClass } from "@/features/dossier/glass";
import { knownCompanyNames, onCompaniesChanged } from "../_lib/companies";
import { CompanyPicker } from "./CompanyPicker";

/**
 * Applications with no company_id whose company name has no record either: they show under no
 * company. Each one can be linked to a company (or a new one) here.
 */
export function UnlinkedApps({ apps }: { apps: Application[] | undefined }) {
  const [known, setKnown] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState<Application | null>(null);
  const [version, setVersion] = useState(0);

  const candidates = useMemo(() => (apps ?? []).filter((a) => !a.company_id), [apps]);
  const names = useMemo(() => [...new Set(candidates.map((a) => String(a.company_name ?? "")))].sort(), [candidates]);

  useEffect(() => onCompaniesChanged(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    let live = true;
    knownCompanyNames(names)
      .then((s) => live && setKnown(s))
      .catch(() => live && setKnown(null));
    return () => {
      live = false;
    };
  }, [names, version]);

  const unlinked = known ? candidates.filter((a) => !known.has(String(a.company_name ?? "").trim().toLowerCase())) : [];
  if (!unlinked.length) return null;
  const n = unlinked.length;

  return (
    <section aria-label="Applications without a company" className={cx(glassClass, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link2 aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-ink">
              {n} application{n === 1 ? " has" : "s have"} no company yet
            </p>
            <p className="text-[15px] text-ink-2">Link {n === 1 ? "it" : "each one"} to a company so it shows here with a logo.</p>
          </div>
        </div>
        {open ? null : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Link {n === 1 ? "it" : "them"}
          </Button>
        )}
      </div>
      {open ? (
        <ul className="mt-4 flex flex-col divide-y divide-[rgba(15,23,42,0.08)] rounded-[16px] bg-white/70">
          {unlinked.map((a) => (
            <li key={a.id} className="flex min-h-16 items-center gap-3 px-3 py-2">
              <CompanyMark name={a.company_name || "?"} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium text-ink">{a.company_name || "No company name"}</span>
                <span className="block truncate text-[14px] text-ink-2">{a.role}</span>
              </span>
              <Button size="sm" variant="primary" onClick={() => setLinking(a)}>
                Link
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <CompanyPicker
        open={!!linking}
        onClose={() => setLinking(null)}
        job={
          linking
            ? { id: Number(linking.id), company_name: linking.company_name, role: linking.role, company_id: linking.company_id }
            : { id: 0, company_name: "", role: null, company_id: null }
        }
        onLinked={() => setVersion((v) => v + 1)}
      />
    </section>
  );
}

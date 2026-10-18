"use client";

import { Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Application } from "../../../../../lib/data";
import LinkCompanyModal from "@/components/LinkCompanyModal";
import { Button, Callout, CompanyMark } from "@/ui";
import { knownCompanyNames, onCompaniesChanged } from "../_lib/companies";

/**
 * Applications with no company_id whose company name has no record either: they appear under no
 * company. Each can be linked to a record (or a new one) with the link-company dialog.
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
    <>
      <Callout
        tone="info"
        icon={Link2}
        title={`${n} application${n === 1 ? " is" : "s are"} not linked to a company`}
        action={
          open ? null : (
            <Button size="sm" onClick={() => setOpen(true)}>
              Review {n === 1 ? "it" : "them"}
            </Button>
          )
        }
      >
        {open ? (
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-md bg-surface">
            {unlinked.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <CompanyMark name={a.company_name || "?"} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium text-ink">{a.company_name || "No company name"}</span>
                  <span className="block truncate text-caption font-normal text-ink-2">{a.role}</span>
                </span>
                <Button size="sm" icon={Link2} onClick={() => setLinking(a)}>
                  Link
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <>Their company name matches no company here, so they show under none. Link each one to a company record.</>
        )}
      </Callout>
      {linking ? (
        <LinkCompanyModal
          job={{ id: Number(linking.id), company_name: linking.company_name, role: linking.role, company_id: linking.company_id }}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
    </>
  );
}

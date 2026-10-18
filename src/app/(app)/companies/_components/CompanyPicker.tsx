"use client";
// "Link a company" / "Change company" for one application: search the companies, pick one, or
// create it. Linking sets jobs.company_id and the record's spelling of the name (lib/data linkCompany).
import { Check, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { linkCompany, searchCompanies, type CompanyOption } from "../../../../../lib/data";
import { Button, CompanyMark, Dialog, Skeleton, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { createCompany, domainOf } from "../_lib/companies";

type Props = {
  open: boolean;
  onClose: () => void;
  job: { id: number; company_name: string | null; role: string | null; company_id: string | null };
  onLinked?: (company: { id: string; name: string }) => void;
};

export function CompanyPicker({ open, onClose, job, onLinked }: Props) {
  const toast = useToast();
  const current = job.company_name ?? "";
  const [query, setQuery] = useState(job.company_id ? "" : current);
  const [results, setResults] = useState<CompanyOption[]>([]);
  const [searching, setSearching] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Linked already: start from the whole list. Not linked: start from the name as written.
    setQuery(job.company_id ? "" : current);
    setError(null);
    setSaving(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = await searchCompanies(query, 8);
        if (live) setResults(list);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const link = async (company: { id: string; name: string }) => {
    setSaving(company.id);
    setError(null);
    try {
      await linkCompany(job.id, company.id);
      toast.show({ text: `Linked to ${company.name}.` });
      onLinked?.(company);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not linked. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const createAndLink = async () => {
    const name = query.trim();
    if (!name) return;
    setSaving("new");
    setError(null);
    try {
      const c = await createCompany({ name, website: null, logo_url: null }, []);
      await link(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The company was not created. Try again.");
      setSaving(null);
    }
  };

  const q = query.trim().toLowerCase();
  const exact = results.some((c) => c.name.trim().toLowerCase() === q);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={job.company_id ? "Change company" : "Link a company"}
      description={`Pick the company for ${job.role ? `“${job.role}”` : "this application"}. Its name and logo will show on the application.`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="relative">
        <Search aria-hidden size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          data-autofocus
          aria-label="Search companies"
          placeholder="Search companies"
          className={cx(controlClass, "h-11 pl-10 text-[16px]")}
        />
      </div>

      <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto" aria-busy={searching || undefined}>
        {searching && !results.length ? (
          [0, 1, 2].map((i) => (
            <li key={i} className="flex h-14 items-center gap-3 px-2">
              <Skeleton className="size-9 rounded-[10px]" />
              <Skeleton className="w-40" />
            </li>
          ))
        ) : results.length === 0 ? (
          <li className="px-2 py-4 text-[15px] text-ink-2">No company matches “{query.trim()}”.</li>
        ) : (
          results.map((c) => {
            const isCurrent = c.id === job.company_id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!!saving || isCurrent}
                  onClick={() => void link(c)}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-white/70 disabled:cursor-default disabled:opacity-70"
                >
                  <CompanyMark name={c.name} logoUrl={c.logo_url} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-ink">{c.name}</span>
                    {c.website ? <span className="block truncate text-[14px] text-ink-2">{domainOf(c.website)}</span> : null}
                  </span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                      <Check aria-hidden size={16} /> Linked now
                    </span>
                  ) : saving === c.id ? (
                    <span className="text-[14px] text-ink-2">Linking…</span>
                  ) : (
                    <span className="text-[14px] font-medium text-accent">Link</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {!exact && !searching && query.trim() ? (
        <Button variant="quiet" icon={Plus} loading={saving === "new"} disabled={!!saving} onClick={() => void createAndLink()} className="mt-2 w-full justify-start">
          Add “{query.trim()}” as a new company and link it
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

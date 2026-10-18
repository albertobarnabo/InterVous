"use client";

// Link an application to a company record: sets jobs.company_id and renames company_name to
// the record's spelling, so the company page, counts and logos stay in step. Can also create
// the company first. Used by /companies ("Not linked to a company"); the dossier may reuse it.
import { Link2, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { updateApplication } from "../../lib/data";
import { createCompany, listCompanies, type CompanyWithTags } from "@/app/(app)/companies/_lib/companies";
import { CompanyMark, Dialog, Skeleton, Tag, Button, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";

type LinkableJob = { id: number; company_name: string | null; role: string | null; company_id?: string | null };

interface LinkCompanyModalProps {
  job: LinkableJob;
  /** Legacy prop, no longer needed (writes go through RLS as the signed-in user). */
  userId?: string;
  /** Defaults to true: legacy callers mount the dialog only while it is open. */
  open?: boolean;
  onClose: () => void;
  onLinked: (company?: { id: string; name: string }) => void;
}

export default function LinkCompanyModal({ job, open = true, onClose, onLinked }: LinkCompanyModalProps) {
  const { show } = useToast();
  const current = job.company_name ?? "";
  const [query, setQuery] = useState(current);
  const [results, setResults] = useState<CompanyWithTags[]>([]);
  const [searching, setSearching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await listCompanies({ page: 1, pageSize: 6, query });
        if (live) setResults(data);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const link = async (company: { id: string; name: string }) => {
    setSaving(true);
    setError(null);
    try {
      await updateApplication(job.id, { company_id: company.id, company_name: company.name });
      show({ kind: "success", text: `Linked to ${company.name}` });
      onLinked(company);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The application was not linked. Try again.");
      setSaving(false);
    }
  };

  const createAndLink = async () => {
    const name = query.trim() || current;
    setSaving(true);
    setError(null);
    try {
      const c = await createCompany({ name, website: null, logo_url: null }, []);
      await link(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The company was not created. Try again.");
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const exact = results.some((c) => c.name.toLowerCase() === q);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Link to a company"
      description={
        <>
          {current || "No company"}
          {job.role ? <> · {job.role}</> : null}. Linking also renames the application’s company to match the record.
        </>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="relative">
        <Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          data-autofocus
          aria-label="Search companies"
          placeholder="Search companies"
          className={cx(controlClass, "h-9 pl-9 pointer-coarse:h-11")}
        />
      </div>

      <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto" aria-busy={searching || undefined}>
        {searching && !results.length ? (
          [0, 1, 2].map((i) => (
            <li key={i} className="flex h-12 items-center gap-3 px-2">
              <Skeleton className="size-8 rounded-sm" />
              <Skeleton className="w-40" />
            </li>
          ))
        ) : results.length === 0 ? (
          <li className="px-2 py-4 text-small text-ink-3">No company matches “{query.trim()}”.</li>
        ) : (
          results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => link(c)}
                className="flex min-h-12 w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition-colors duration-[120ms] hover:bg-surface-2 disabled:opacity-50"
              >
                <CompanyMark name={c.name} logoUrl={c.logo_url} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium text-ink">{c.name}</span>
                  {c.tags.length ? <span className="block truncate text-caption font-normal text-ink-3">{c.tags.map((t) => t.name).join(" · ")}</span> : null}
                </span>
                {c.name.toLowerCase() === current.trim().toLowerCase() ? <Tag tone="accent">Same name</Tag> : null}
                <Link2 aria-hidden size={16} className="shrink-0 text-ink-3" />
              </button>
            </li>
          ))
        )}
      </ul>

      {!exact && query.trim() ? (
        <Button variant="quiet" icon={Plus} disabled={saving} onClick={createAndLink} className="mt-2 w-full justify-start">
          Create “{query.trim()}” and link
        </Button>
      ) : null}

      {error ? <p className="mt-3 text-small text-danger">{error}</p> : null}
    </Dialog>
  );
}

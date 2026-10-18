"use client";
// "Link an application" from a company: pick one of your applications and it moves to this company
// (lib/data linkCompany sets jobs.company_id and the company's spelling of the name).
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { linkCompany, type Application } from "../../../../../lib/data";
import { Button, CompanyMark, Dialog, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { StatusPill } from "@/features/dossier/glass";
import { belongsTo } from "../_lib/match";

type Props = {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string } | null;
  apps: Application[] | undefined;
};

export function AppPicker({ open, onClose, company, apps }: Props) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    setSaving(null);
  }, [open]);

  const list = useMemo(() => {
    if (!company) return [];
    const q = query.trim().toLowerCase();
    return (apps ?? [])
      .filter((a) => !belongsTo(a, company))
      .filter((a) => !q || `${a.company_name ?? ""} ${a.role ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => String(b.applied_on ?? b.cv_built_on ?? b.created_at ?? "").localeCompare(String(a.applied_on ?? a.cv_built_on ?? a.created_at ?? "")));
  }, [apps, company, query]);

  if (!company) return null;

  const link = async (a: Application) => {
    setSaving(Number(a.id));
    setError(null);
    try {
      await linkCompany(Number(a.id), company.id);
      toast.show({ text: `${a.role || "The application"} is now linked to ${company.name}.` });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not linked. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Link an application to ${company.name}`}
      description="Pick the application. It will show under this company, with its logo."
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
          aria-label="Search your applications"
          placeholder="Search by company or role"
          className={cx(controlClass, "h-11 pl-10 text-[16px]")}
        />
      </div>
      <ul className="mt-3 flex max-h-96 flex-col gap-1 overflow-y-auto">
        {list.length === 0 ? (
          <li className="px-2 py-4 text-[15px] text-ink-2">{query.trim() ? `Nothing matches “${query.trim()}”.` : "Every application is already linked here."}</li>
        ) : (
          list.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => void link(a)}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-white/70 disabled:cursor-default disabled:opacity-70"
              >
                <CompanyMark name={a.company_name || "?"} logoUrl={a.company_logo_url} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium text-ink">{a.role || "Role not recorded"}</span>
                  <span className="block truncate text-[14px] text-ink-2">{a.company_name || "No company"}</span>
                </span>
                {saving === Number(a.id) ? <span className="text-[14px] text-ink-2">Linking…</span> : <StatusPill phase={a.phase} className="hidden sm:inline-flex" />}
              </button>
            </li>
          ))
        )}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

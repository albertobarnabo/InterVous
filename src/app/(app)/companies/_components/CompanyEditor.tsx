"use client";

import { Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { companyCore, linkFrom } from "../../../../../lib/core";
import { Button, Callout, Chip, CompanyMark, ConfirmDialog, Dialog, Field, IconButton, Input, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { cx } from "@/ui/cx";
import {
  createCompany,
  createTag,
  deleteTag,
  findCompanyByName,
  listTags,
  normalizeWebsite,
  renameTag,
  researchCompany,
  saveCompanyInfo,
  saveLogo,
  updateCompany,
  type CompanyTag,
  type CompanyWithTags,
  type ResearchResult,
} from "../_lib/companies";

type Props = {
  open: boolean;
  /** The company being edited; null adds a new one. */
  company: CompanyWithTags | null;
  /** Prefilled name for a new company. */
  initialName?: string;
  /** A Tavily key is saved, so a new company can be filled in from the web. */
  tavily?: boolean;
  onClose: () => void;
  /** `open`: show the company afterwards (a new one, or one that already existed). */
  onSaved: (company: { id: string; name: string }, opts?: { open?: boolean }) => void;
};

/** Tags shown before "Show all", while nothing is typed in the tag box. */
const TAGS_SHOWN = 12;

const FACTS = [
  ["industry", "Industry"],
  ["headquarters", "Headquarters"],
  ["founded", "Founded"],
  ["employee_count", "Employees"],
] as const;

const hasInfo = (r: ResearchResult | null) => !!r && [r.description, ...FACTS.map(([k]) => r[k])].some((v) => v?.trim());

/**
 * Add or edit a company: name, careers website and tags (with tag create, rename and delete). A new one
 * can be filled in from the web first, from its website or its name, through the same Tavily auto-fill
 * as the company's About section. The logo has its own dialog.
 */
export function CompanyEditor({ open, company, initialName = "", tavily = false, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [tags, setTags] = useState<CompanyTag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [allTags, setAllTags] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // filling in a new company from the web
  const [lookup, setLookup] = useState("");
  const [researching, setResearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [found, setFound] = useState<ResearchResult | null>(null);
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const adding = !company;
  // Each opening and closing starts a new run, so an answer that comes back later is dropped.
  const run = useRef(0);
  // What the last Auto-fill put in Name and Careers website: it may replace those, never what was typed.
  const filled = useRef<{ name: string; website: string }>({ name: "", website: "" });

  useEffect(() => {
    run.current += 1;
    if (!open) return;
    setBusy(false);
    setResearching(false);
    filled.current = { name: "", website: "" };
    setName(company?.name ?? initialName);
    setWebsite(company?.website ?? "");
    setSelected(company?.tags.map((t) => t.id) ?? []);
    setTagQuery("");
    setAllTags(false);
    setManaging(false);
    setError(null);
    setLookup(company ? "" : initialName);
    setLookupError(null);
    setFound(null);
    setExisting(null);
    listTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, [open, company, initialName]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const q = tagQuery.trim().toLowerCase();
  const chosen = tags.filter((t) => selected.includes(t.id));
  const others = tags.filter((t) => !selected.includes(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const shownOthers = q || allTags ? others : others.slice(0, TAGS_SHOWN);
  const exact = tags.find((t) => t.name.toLowerCase() === q) ?? null;

  /** Enter in the tag box: pick the tag of that name, or make it. */
  const addTag = async () => {
    const n = tagQuery.trim();
    if (!n) return;
    if (exact) {
      if (!selected.includes(exact.id)) toggle(exact.id);
      setTagQuery("");
      return;
    }
    try {
      const t = await createTag(n);
      setTags((xs) => [...xs, t].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected((s) => [...s, t.id]);
      setTagQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The tag was not created.");
    }
  };

  /** "elastic.co" or "Elastic": the auto-fill of the company's About section, before the company exists. */
  const autofill = async () => {
    const text = lookup.trim();
    if (!text || researching) return;
    const mine = run.current;
    setResearching(true);
    setLookupError(null);
    try {
      const isSite = !/\s/.test(text) && !!linkFrom(text);
      const r = await researchCompany(isSite ? { homepage: text } : { name: text });
      if (mine !== run.current) return;
      const n = r.name?.trim() || (isSite ? "" : text);
      const own = (value: string, last: string) => !!value.trim() && value !== last;
      if (n && !own(name, filled.current.name)) setName(n);
      if (!own(website, filled.current.website)) setWebsite(r.website ?? "");
      filled.current = { name: n, website: r.website ?? "" };
      setFound({ ...r, name: n || r.name });
      const dup = n ? await findCompanyByName(n).catch(() => null) : null;
      if (mine === run.current) setExisting(dup);
    } catch (e) {
      if (mine !== run.current) return;
      setFound(null);
      setLookupError(e instanceof Error ? e.message : "Auto-fill found nothing. Fill it in yourself.");
    } finally {
      if (mine === run.current) setResearching(false);
    }
  };

  const save = async () => {
    const n = name.trim();
    // While a save or an Auto-fill runs, Enter does nothing: two presses would add the company twice.
    if (!n || busy || researching) return;
    const mine = run.current;
    setBusy(true);
    setError(null);
    try {
      if (company) {
        const draft = { name: n, website: normalizeWebsite(website), logo_url: company.logo_url ?? null };
        await updateCompany(company.id, draft, selected);
        show({ text: `${draft.name} saved.` });
        onSaved({ id: company.id, name: draft.name });
        return;
      }
      // Companies are shared, so a second Elastic would split its applications in two.
      const dup = await findCompanyByName(n).catch(() => null);
      if (dup) {
        if (mine === run.current) setExisting(dup);
        return;
      }
      const c = await createCompany({ name: n, website: normalizeWebsite(website), logo_url: null }, selected);
      // What auto-fill found goes in with it; a failure here never undoes the company.
      const t = (v: string | null | undefined) => v?.trim() || null;
      const extras: Promise<unknown>[] = [];
      if (found?.logo_url) extras.push(saveLogo(c.id, found.logo_url));
      if (found && hasInfo(found)) {
        extras.push(
          saveCompanyInfo({
            company_id: c.id,
            description: t(found.description),
            industry: t(found.industry),
            headquarters: t(found.headquarters),
            founded: t(found.founded),
            employee_count: t(found.employee_count),
          }),
        );
      }
      const missed = (await Promise.allSettled(extras)).some((x) => x.status === "rejected");
      show(missed ? { kind: "error", text: `${c.name} added, but part of what auto-fill found was not saved.` } : { text: `${c.name} added.` });
      // Closed meanwhile: the company is added, but this form must not touch the next one.
      if (mine === run.current) onSaved({ id: c.id, name: c.name }, { open: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The company was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={company ? `Edit ${company.name}` : "Add a company"}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim() || researching} onClick={save}>
            {company ? "Save" : "Add company"}
          </Button>
        </>
      }
    >
      {adding ? (
        <section aria-labelledby="fill-from-web" className="mb-5 rounded-2xl bg-white/60 p-4 shadow-[0_0_0_0.5px_rgba(15,23,42,0.1)]">
          <h3 id="fill-from-web" className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <Sparkles aria-hidden size={16} className="text-accent" />
            Fill in from the web
          </h3>
          <p className="mt-0.5 text-[14px] text-ink-2">Paste their website or type their name: Auto-fill finds the name, careers website, logo and what they do.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void autofill();
            }}
          >
            <label htmlFor="company-lookup" className="sr-only">
              Website or company name
            </label>
            <input
              id="company-lookup"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="elastic.co or Elastic"
              autoComplete="off"
              disabled={!tavily || researching}
              autoFocus={tavily}
              data-autofocus={tavily || undefined}
              className={cx(controlClass, "h-11 min-w-0 flex-1 text-[16px]")}
            />
            <Button type="submit" icon={Sparkles} loading={researching} disabled={!tavily || !lookup.trim()}>
              {researching ? "Searching…" : "Auto-fill"}
            </Button>
          </form>
          {!tavily ? (
            <p className="mt-2 text-[14px] text-ink-2">
              Auto-fill needs a Tavily key.{" "}
              <Link href="/settings#api-keys" className="cursor-pointer font-medium text-accent underline underline-offset-4">
                Add it in Settings
              </Link>
            </p>
          ) : null}
          {lookupError ? (
            <p role="alert" className="mt-2 text-[14px] text-danger">
              {lookupError}
            </p>
          ) : null}
        </section>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          // The Enter that ends a composition (Japanese, Chinese input) only confirms the text.
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void save();
          }
        }}
      >
        <div className="flex items-end gap-3">
          <CompanyMark name={name || "?"} logoUrl={found?.logo_url ?? company?.logo_url ?? null} size={48} />
          <Field label="Name" className="flex-1">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setExisting(null);
              }}
              placeholder="Acme"
              autoFocus={!(adding && tavily)}
              data-autofocus={!(adding && tavily) || undefined}
              required
              className="h-11 text-[16px]"
            />
          </Field>
        </div>
        {existing ? (
          <Callout
            tone="caution"
            title={`${existing.name} is already in your companies`}
            action={
              <Button size="sm" onClick={() => onSaved(existing, { open: true })}>
                Open it
              </Button>
            }
          >
            Companies are shared by all your applications, so it is not added twice.
          </Callout>
        ) : null}
        <Field label="Careers website" hint="Where they post their jobs. Optional: Auto-fill can find it.">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com/careers" inputMode="url" autoComplete="off" className="h-11 text-[16px]" />
        </Field>
      </form>

      {adding && found && hasInfo(found) ? (
        <section aria-labelledby="found-on-web" className="mt-4 rounded-2xl bg-white/60 p-4 shadow-[0_0_0_0.5px_rgba(15,23,42,0.1)]">
          <div className="flex items-start justify-between gap-3">
            <h3 id="found-on-web" className="text-[15px] font-semibold text-ink">
              About {found.name?.trim() || name.trim() || "them"}
            </h3>
            <Button size="sm" variant="quiet" onClick={() => setFound(null)}>
              Don&apos;t use this
            </Button>
          </div>
          {found.description ? <p className="mt-1.5 text-[15px] leading-6 text-ink">{found.description}</p> : null}
          {FACTS.some(([k]) => found[k]?.trim()) ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {FACTS.filter(([k]) => found[k]?.trim()).map(([k, label]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[13px] text-ink-2">{label}</dt>
                  <dd className="text-[15px] break-words text-ink">{found[k]}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {found.name && name.trim() && companyCore(found.name).toLowerCase() !== companyCore(name).toLowerCase() ? (
            <p className="mt-3 text-[14px] font-medium text-caution">
              This was found for {found.name}, not {name.trim()}. Press “Don&apos;t use this” unless it is the same company.
            </p>
          ) : null}
          <p className="mt-3 text-[13px] text-ink-2">Found on the web. It is saved with the company; change it any time in its About.</p>
        </section>
      ) : null}

      <fieldset className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-[15px] font-medium text-ink">Tags</legend>
          {tags.length ? (
            <Button size="sm" variant="quiet" icon={managing ? Check : Pencil} onClick={() => setManaging((m) => !m)}>
              {managing ? "Done" : "Rename or delete tags"}
            </Button>
          ) : null}
        </div>
        {managing ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {tags.map((t) => (
              <TagRow
                key={t.id}
                tag={t}
                onRenamed={(nt) => setTags((xs) => xs.map((x) => (x.id === nt.id ? nt : x)).sort((a, b) => a.name.localeCompare(b.name)))}
                onDeleted={() => {
                  setTags((xs) => xs.filter((x) => x.id !== t.id));
                  setSelected((s) => s.filter((x) => x !== t.id));
                }}
              />
            ))}
          </ul>
        ) : (
          <>
            {chosen.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Chosen tags">
                {chosen.map((t) => (
                  <Chip key={t.id} selected onClick={() => toggle(t.id)}>
                    <Check aria-hidden size={14} />
                    {t.name}
                  </Chip>
                ))}
              </div>
            ) : null}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addTag();
              }}
            >
              <label htmlFor="tag-search" className="sr-only">
                Find or add a tag
              </label>
              <input
                id="tag-search"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder={tags.length ? "Find or add a tag, e.g. Fintech" : "New tag, e.g. Fintech"}
                autoComplete="off"
                className={cx(controlClass, "h-11 min-w-0 flex-1 text-[16px]")}
              />
              {q && !exact ? (
                <Button type="submit" icon={Plus}>
                  Add “{tagQuery.trim()}”
                </Button>
              ) : null}
            </form>
            {tags.length === 0 ? <p className="mt-2 text-[15px] text-ink-2">No tags yet. Type one above to make it.</p> : null}
            {shownOthers.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shownOthers.map((t) => (
                  <Chip
                    key={t.id}
                    onClick={() => {
                      toggle(t.id);
                      setTagQuery("");
                    }}
                  >
                    {t.name}
                  </Chip>
                ))}
              </div>
            ) : q && exact && selected.includes(exact.id) ? (
              <p className="mt-2 text-[14px] text-ink-2">{exact.name} is already chosen.</p>
            ) : null}
            {!q && !allTags && others.length > TAGS_SHOWN ? (
              <Button size="sm" variant="quiet" className="mt-2" onClick={() => setAllTags(true)}>
                Show all {others.length} tags
              </Button>
            ) : null}
          </>
        )}
      </fieldset>

      {error ? (
        <p role="alert" className="mt-4 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

function TagRow({ tag, onRenamed, onDeleted }: { tag: CompanyTag; onRenamed: (t: CompanyTag) => void; onDeleted: () => void }) {
  const { show } = useToast();
  const [draft, setDraft] = useState(tag.name);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const changed = draft.trim() && draft.trim() !== tag.name;

  const rename = async () => {
    if (!changed) return;
    setBusy(true);
    try {
      onRenamed(await renameTag(tag.id, draft.trim()));
      show({ text: `Renamed to ${draft.trim()}` });
    } catch (e) {
      show({ kind: "error", text: e instanceof Error ? e.message : "The tag was not renamed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-1.5">
      <label htmlFor={`tag-${tag.id}`} className="sr-only">
        Name of tag {tag.name}
      </label>
      <input
        id={`tag-${tag.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void rename();
          }
        }}
        disabled={busy}
        className={cx(controlClass, "h-11 text-[16px]")}
      />
      <IconButton label={`Save the new name of ${tag.name}`} icon={Check} disabled={!changed || busy} onClick={rename} />
      <IconButton label={`Delete tag ${tag.name}`} icon={Trash2} disabled={busy} onClick={() => setConfirming(true)} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete the tag “${tag.name}”?`}
        body="It is removed from every company that has it. The companies stay."
        confirmLabel="Delete tag"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteTag(tag.id);
            show({ text: `Tag ${tag.name} deleted` });
            setConfirming(false);
            onDeleted();
          } catch (e) {
            show({ kind: "error", text: e instanceof Error ? e.message : "The tag was not deleted." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </li>
  );
}

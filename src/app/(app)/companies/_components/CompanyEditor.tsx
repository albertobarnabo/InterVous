"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Chip, CompanyMark, ConfirmDialog, Dialog, Field, IconButton, Input, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";
import { cx } from "@/ui/cx";
import {
  createCompany,
  createTag,
  deleteTag,
  listTags,
  normalizeWebsite,
  renameTag,
  updateCompany,
  type CompanyTag,
  type CompanyWithTags,
} from "../_lib/companies";

type Props = {
  open: boolean;
  /** The company being edited; null adds a new one. */
  company: CompanyWithTags | null;
  /** Prefilled name for a new company. */
  initialName?: string;
  onClose: () => void;
  onSaved: (company: { id: string; name: string }) => void;
};

/** Add or edit a company: name, website, logo and tags (with tag create, rename and delete). */
export function CompanyEditor({ open, company, initialName = "", onClose, onSaved }: Props) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [tags, setTags] = useState<CompanyTag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? initialName);
    setWebsite(company?.website ?? "");
    setLogoUrl(company?.logo_url ?? "");
    setSelected(company?.tags.map((t) => t.id) ?? []);
    setNewTag("");
    setManaging(false);
    setError(null);
    listTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, [open, company, initialName]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addTag = async () => {
    const n = newTag.trim();
    if (!n) return;
    const existing = tags.find((t) => t.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) toggle(existing.id);
      setNewTag("");
      return;
    }
    try {
      const t = await createTag(n);
      setTags((xs) => [...xs, t].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected((s) => [...s, t.id]);
      setNewTag("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The tag was not created.");
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const draft = { name: name.trim(), website: normalizeWebsite(website), logo_url: logoUrl.trim() || null };
    try {
      if (company) {
        await updateCompany(company.id, draft, selected);
        show({ text: `${draft.name} saved` });
        onSaved({ id: company.id, name: draft.name });
      } else {
        const c = await createCompany(draft, selected);
        show({ text: `${c.name} added` });
        onSaved({ id: c.id, name: c.name });
      }
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
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={save}>
            {company ? "Save" : "Add company"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void save();
          }
        }}
      >
        <div className="flex items-end gap-3">
          <CompanyMark name={name || "?"} logoUrl={logoUrl.trim() || null} size={48} />
          <Field label="Name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" autoFocus data-autofocus required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" hint="Auto-fill uses it to find the right company.">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" inputMode="url" autoComplete="off" />
          </Field>
          <Field label="Logo URL" hint="A square image works best.">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://acme.com/logo.png" inputMode="url" autoComplete="off" />
          </Field>
        </div>
      </form>

      <fieldset className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-small font-medium text-ink">Tags</legend>
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.length === 0 ? <p className="text-small text-ink-3">No tags yet. Create the first one below.</p> : null}
            {tags.map((t) => (
              <Chip key={t.id} selected={selected.includes(t.id)} onClick={() => toggle(t.id)}>
                {selected.includes(t.id) ? <Check aria-hidden size={14} /> : null}
                {t.name}
              </Chip>
            ))}
          </div>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTag();
          }}
        >
          <label htmlFor="new-tag" className="sr-only">
            New tag
          </label>
          <input
            id="new-tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="New tag, e.g. Fintech"
            className={cx(controlClass, "h-9 pointer-coarse:h-11")}
          />
          <Button type="submit" icon={Plus} disabled={!newTag.trim()}>
            Add tag
          </Button>
        </form>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-4 text-small text-danger">
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
        className={cx(controlClass, "h-9 pointer-coarse:h-11")}
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

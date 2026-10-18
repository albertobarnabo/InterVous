"use client";
// "Add logo" / "Change logo" for one company: upload an image (saved to the public bucket
// user_avatars under <user_id>/company-logos/<company_id>.<ext>), or paste an image link.
// When the website is known, its icon is offered as a one-tap choice.
import { ImageUp, Link2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { checkLogoUrl, logoFileProblem } from "../../../../../lib/data";
import { Button, CompanyMark, Dialog, Field, Input, cx, useToast } from "@/ui";
import { clearLogo, domainOf, saveLogo } from "../_lib/companies";

type Props = {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string; logo_url: string | null; website?: string | null } | null;
  onSaved?: (url: string | null) => void;
};

/** A website's icon at 128px (Google's public favicon service), for the one-tap suggestion. */
function iconFor(website: string | null | undefined): string | null {
  const d = domainOf(website);
  return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128` : null;
}

export function LogoDialog({ open, onClose, company, onSaved }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setLink("");
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (!company) return null;
  const suggestion = iconFor(company.website);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    const problem = logoFileProblem(f);
    if (problem) return setError(problem);
    setError(null);
    setLink("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  let linkUrl: string | null = null;
  try {
    linkUrl = link.trim() ? checkLogoUrl(link) : null;
  } catch {
    linkUrl = null;
  }
  const shown = preview ?? linkUrl ?? company.logo_url;

  const save = async (source: File | string) => {
    setBusy(true);
    setError(null);
    try {
      const url = await saveLogo(company.id, source);
      toast.show({ text: `Logo saved for ${company.name}.` });
      onSaved?.(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The logo was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearLogo(company.id);
      toast.show({ text: "Logo removed." });
      onSaved?.(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The logo was not removed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const ready = file ?? (link.trim() ? link : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={company.logo_url ? `Change the logo of ${company.name}` : `Add a logo for ${company.name}`}
      description="A square image works best. It shows next to every application at this company."
      footer={
        <>
          {company.logo_url ? (
            <Button variant="quiet" icon={Trash2} disabled={busy} onClick={() => void remove()} className="mr-auto text-danger">
              Remove logo
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!ready} onClick={() => ready && void save(ready)}>
            Save logo
          </Button>
        </>
      }
    >
      <div
        className={cx(
          "flex flex-wrap items-center gap-4 rounded-[16px] border border-dashed p-4 transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-[rgba(15,23,42,0.18)]",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <CompanyMark key={shown ?? "none"} name={company.name} logoUrl={shown} size={64} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-[16px] text-ink">{file ? file.name : "Upload an image"}</p>
          <p className="text-[14px] text-ink-2">PNG, JPEG, WebP or GIF, up to 2 MB. You can also drop it here.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="secondary" icon={ImageUp} onClick={() => input.current?.click()}>
          Choose image
        </Button>
      </div>

      <div className="mt-5">
        <Field label="Or paste an image link" hint="Right-click a logo on the company's website and copy the image address.">
          <Input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              if (e.target.value) {
                setFile(null);
                setPreview(null);
              }
            }}
            placeholder="https://…/logo.png"
            inputMode="url"
            autoComplete="off"
            className="h-11 text-[16px]"
          />
        </Field>
      </div>

      {suggestion && !company.logo_url ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[16px] bg-white/60 p-3">
          <CompanyMark name={company.name} logoUrl={suggestion} size={36} />
          <p className="min-w-0 flex-1 basis-40 text-[15px] text-ink-2">Use the icon of {domainOf(company.website)}</p>
          <Button size="sm" variant="secondary" icon={Link2} disabled={busy} onClick={() => void save(suggestion)}>
            Use it
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

"use client";

// Avatar upload. <AvatarPicker> is rendered inline on /settings.
// After a save, window gets an `iv:avatar-changed` CustomEvent whose detail is the new URL.
import { ImageUp, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { updateProfileAvatar } from "../../lib/backend/profiles";
import { deleteAvatar, uploadAvatar } from "../../lib/backend/storage";
import { FIXTURE_MODE } from "../../lib/data/env";
import { Button, cx, useToast } from "@/ui";
import { AVATAR_CHANGED } from "@/ui/events";

export { AVATAR_CHANGED };
const MAX_BYTES = 5 * 1024 * 1024;

type AvatarPickerProps = {
  currentUrl: string | null;
  onSaved?: (url: string) => void;
  /** Called after Save or Cancel (the dialog closes itself with it). */
  onDone?: () => void;
  className?: string;
};

export function AvatarPicker({ currentUrl, onSaved, onDone, className }: AvatarPickerProps) {
  const { user } = useAuth();
  const { show } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Choose an image file (PNG, JPEG, WebP or GIF).");
    if (f.size > MAX_BYTES) return setError("That image is over 5 MB. Choose a smaller one.");
    setError(null);
    setBroken(false);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const cancel = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = "";
    onDone?.();
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      let url: string;
      if (FIXTURE_MODE) {
        url = URL.createObjectURL(file);
      } else {
        if (!user) throw new Error("You are signed out. Sign in again to change your avatar.");
        url = await uploadAvatar(user.id, file);
        await updateProfileAvatar(user.id, url);
        if (currentUrl && currentUrl !== url) await deleteAvatar(currentUrl);
      }
      window.dispatchEvent(new CustomEvent(AVATAR_CHANGED, { detail: url }));
      onSaved?.(url);
      show({ kind: "success", text: "Avatar updated" });
      setFile(null);
      setPreview(null);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The image was not uploaded. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const shown = preview ?? currentUrl;

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-4 rounded-md border border-dashed p-4 transition-colors duration-[120ms]",
        dragging ? "border-accent bg-accent-soft" : "border-line-strong",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-ink-3">
        {shown && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from Supabase storage or a local preview
          <img src={shown} alt={preview ? "New avatar preview" : "Your avatar"} onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <UserRound aria-hidden size={28} strokeWidth={1.5} />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-small text-ink">{file ? file.name : "Shown in the top bar."}</p>
        <p className="text-caption font-normal text-ink-3">
          {file ? "Save to use this image." : "PNG, JPEG, WebP or GIF, up to 5 MB. You can also drop an image here."}
        </p>
        {error ? <p className="mt-1 text-caption text-danger">{error}</p> : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        {file ? (
          <>
            <Button size="sm" variant="primary" loading={busy} onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="quiet" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" icon={ImageUp} onClick={() => input.current?.click()}>
            Choose image
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

// API keys, write-only: the browser only ever learns whether each key is saved.
// <KeysForm> is rendered inline on /settings.
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { FIXTURE_MODE } from "../../lib/data/env";
import { setApiKeys, type KeyField, type KeysStatus } from "../../lib/keyService";
import { Button, IconButton, Tag, cx, useToast } from "@/ui";
import { controlClass } from "@/ui/Field";

export const KEY_PROVIDERS: { field: KeyField; label: string; description: string }[] = [
  { field: "open_ai", label: "OpenAI", description: "Reads job postings for “From link” (GPT 3.5 Turbo)." },
  { field: "deep_seek", label: "DeepSeek", description: "Reads job postings for “From link”." },
  { field: "mistral", label: "Mistral", description: "Reads job postings for “From link”." },
  { field: "tavily", label: "Tavily", description: "Web search for company Auto-fill." },
];

type KeysFormProps = {
  keysStatus: KeysStatus | null;
  /** Called after a key is saved, with the field that changed. */
  onSaved?: (field: KeyField) => void;
  className?: string;
};

function KeyRow({
  field,
  label,
  description,
  saved,
  onSaved,
}: {
  field: KeyField;
  label: string;
  description: string;
  saved: boolean;
  onSaved: (field: KeyField) => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `key-${field}`;

  const close = () => {
    setOpen(false);
    setValue("");
    setVisible(false);
    setError(null);
  };

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (!FIXTURE_MODE) {
        if (!user) throw new Error("You are signed out. Sign in again to save keys.");
        await setApiKeys(user.id, { [field]: value });
      }
      show({ kind: "success", text: `${label} key saved` });
      onSaved(field);
      close();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The key was not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-body font-medium text-ink">
            {label}
            <Tag tone={saved ? "accent" : "neutral"}>{saved ? "Saved" : "Not set"}</Tag>
          </p>
          <p className="text-small text-ink-2">{description}</p>
        </div>
        {!open ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-controls={inputId}>
            {saved ? "Replace" : "Add key"}
          </Button>
        ) : null}
      </div>
      {open ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {label} API key
          </label>
          <div className="relative">
            <input
              id={inputId}
              type={visible ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={saved ? "Paste the new key; the old one is replaced" : `Paste your ${label} key`}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className={cx(controlClass, "iv-num h-9 pr-11 pointer-coarse:h-11")}
            />
            <span className="absolute inset-y-0 right-0.5 flex items-center">
              <IconButton
                label={visible ? "Hide key" : "Show key"}
                icon={visible ? EyeOff : Eye}
                size="sm"
                onClick={() => setVisible((v) => !v)}
                className="pointer-coarse:size-9"
              />
            </span>
          </div>
          {error ? (
            <p id={`${inputId}-error`} className="text-caption text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary" loading={busy} disabled={!value.trim()}>
              Save key
            </Button>
            <Button size="sm" variant="quiet" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** One row per provider: status, then "Add key" / "Replace" reveals the input. */
export function KeysForm({ keysStatus, onSaved, className }: KeysFormProps) {
  const [local, setLocal] = useState<Partial<Record<KeyField, boolean>>>({});
  return (
    <ul className={cx("divide-y divide-line", className)}>
      {KEY_PROVIDERS.map((p) => (
        <KeyRow
          key={p.field}
          {...p}
          saved={Boolean(local[p.field] ?? keysStatus?.[p.field])}
          onSaved={(f) => {
            setLocal((s) => ({ ...s, [f]: true }));
            onSaved?.(f);
          }}
        />
      ))}
    </ul>
  );
}

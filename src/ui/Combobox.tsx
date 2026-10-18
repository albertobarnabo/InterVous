"use client";

import {
  Combobox as HCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "./cx";
import { controlClass } from "./Field";

export type ComboboxProps<T> = {
  items: T[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Text shown for an item in the input and used by the default filter. */
  getLabel: (item: T) => string;
  getKey: (item: T) => string | number;
  /** Custom row content. Defaults to getLabel(item). */
  renderItem?: (item: T) => ReactNode;
  /** Replace the default case-insensitive "label includes query" filter. */
  filter?: (item: T, query: string) => boolean;
  /** Offer "Create “query”" when nothing matches exactly. */
  onCreate?: (query: string) => void;
  placeholder?: string;
  emptyText?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/** Headless UI Combobox with a local filter. */
export function Combobox<T>({
  items,
  value,
  onChange,
  getLabel,
  getKey,
  renderItem,
  filter,
  onCreate,
  placeholder,
  emptyText = "No matches",
  id,
  className,
  disabled,
  ...aria
}: ComboboxProps<T>) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((it) => (filter ? filter(it, query) : getLabel(it).toLowerCase().includes(q)))
    : items;
  const exact = shown.some((it) => getLabel(it).toLowerCase() === q);

  return (
    <HCombobox
      value={value}
      onChange={(v: T | null) => onChange(v)}
      onClose={() => setQuery("")}
      disabled={disabled}
      by={(a: T | null, b: T | null) => (a && b ? getKey(a) === getKey(b) : a === b)}
    >
      <div className={cx("relative", className)}>
        <ComboboxInput
          id={id}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          aria-label={aria["aria-label"]}
          placeholder={placeholder}
          displayValue={(it: T | null) => (it ? getLabel(it) : "")}
          onChange={(e) => setQuery(e.target.value)}
          className={cx(controlClass, "h-9 pr-9 pointer-coarse:h-11")}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-3" aria-label="Show options">
          <ChevronDown aria-hidden size={16} />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor={{ to: "bottom start", gap: 4, padding: 8 }}
        transition
        className={cx(
          "z-30 max-h-72 w-(--input-width) min-w-56 overflow-auto rounded-md bg-surface p-1 shadow-2 ring-1 ring-line empty:invisible",
          "transition duration-[120ms] ease-out data-closed:opacity-0",
        )}
      >
        {shown.map((it) => (
          <ComboboxOption
            key={getKey(it)}
            value={it}
            className="group flex cursor-default items-center gap-2 rounded-sm px-2.5 py-2 text-small text-ink select-none data-focus:bg-surface-2 pointer-coarse:min-h-11"
          >
            <Check aria-hidden size={16} className="shrink-0 text-accent invisible group-data-selected:visible" />
            <span className="min-w-0 flex-1 truncate">{renderItem ? renderItem(it) : getLabel(it)}</span>
          </ComboboxOption>
        ))}
        {onCreate && q && !exact ? (
          <button
            type="button"
            onClick={() => onCreate(query.trim())}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-small text-accent hover:bg-surface-2 pointer-coarse:min-h-11"
          >
            Create “{query.trim()}”
          </button>
        ) : null}
        {!shown.length && !(onCreate && q) ? (
          <p className="px-2.5 py-2 text-small text-ink-3">{emptyText}</p>
        ) : null}
      </ComboboxOptions>
    </HCombobox>
  );
}

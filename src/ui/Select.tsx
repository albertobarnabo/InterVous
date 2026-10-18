"use client";

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { controlClass } from "./Field";

export type SelectOption<V extends string | number = string> = {
  value: V;
  label: ReactNode;
  /** Plain-text label used for the button when label is not a string. */
  text?: string;
  description?: ReactNode;
  disabled?: boolean;
};

export type SelectProps<V extends string | number = string> = {
  value: V | null;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: "sm" | "md";
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/** Headless UI Listbox. Replaces native <select> and the old CustomSelect. */
export function Select<V extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  id,
  className,
  size = "md",
  ...aria
}: SelectProps<V>) {
  const current = options.find((o) => o.value === value) ?? null;
  return (
    <Listbox value={value} onChange={(v: V | null) => v !== null && onChange(v)} disabled={disabled}>
      <ListboxButton
        id={id}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        aria-label={aria["aria-label"]}
        className={cx(
          controlClass,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          size === "md" ? "h-11" : "h-9 text-[15px]",
          "data-open:border-accent",
          className,
        )}
      >
        <span className={cx("truncate", !current && "text-ink-3")}>{current ? current.label : placeholder}</span>
        <ChevronDown aria-hidden size={16} className="shrink-0 text-ink-3" />
      </ListboxButton>
      <ListboxOptions
        anchor={{ to: "bottom start", gap: 4, padding: 8 }}
        transition
        className={cx(
          "iv-glass-thick z-30 max-h-72 w-(--button-width) min-w-52 overflow-auto rounded-[16px] p-1.5 shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_40px_rgba(15,23,42,0.16)]",
          "transition duration-[120ms] ease-out focus:outline-none data-closed:opacity-0",
        )}
      >
        {options.map((o) => (
          <ListboxOption
            key={String(o.value)}
            value={o.value}
            disabled={o.disabled}
            className={cx(
              "group flex cursor-pointer items-start gap-2 rounded-[10px] px-3 py-2.5 text-body text-ink select-none sm:text-[15px]",
              "data-focus:bg-ink/[0.06] data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11",
            )}
          >
            <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-accent invisible group-data-selected:visible" />
            <span className="flex flex-col">
              <span className="group-data-selected:font-medium">{o.label}</span>
              {o.description ? <span className="text-small text-ink-2">{o.description}</span> : null}
            </span>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

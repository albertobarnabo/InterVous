"use client";

import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";

/** Shared look for text-like controls: near-white, rounded 12px, teal focus ring. 16px text (no zoom on iPhone). */
export const controlClass =
  "w-full rounded-[12px] border border-[rgba(15,23,42,0.14)] bg-white/85 px-3.5 text-body text-ink placeholder:text-ink-3 " +
  "shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out " +
  "hover:border-[rgba(15,23,42,0.24)] focus:border-accent focus:bg-white focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/20";

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** One control (Input, Textarea, DateInput, Select, Combobox). It receives id, aria-describedby and aria-invalid. */
  children: ReactElement<ControlProps>;
  className?: string;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
};

/** Label + control + hint/error, wired with htmlFor and aria-describedby. */
export function Field({ label, hint, error, children, className, hideLabel }: FieldProps) {
  const auto = useId();
  const child = isValidElement(children) ? children : null;
  const id = child?.props.id ?? `f${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [child?.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cx("text-small font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      {child
        ? cloneElement(child, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : child.props["aria-invalid"] })
        : children}
      {hint && !error ? (
        <p id={hintId} className="text-small text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, type = "text", ...rest }: ComponentProps<"input">) {
  return <input type={type} className={cx(controlClass, "h-11", className)} {...rest} />;
}

export function Textarea({ className, rows = 4, ...rest }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cx(controlClass, "min-h-24 py-2.5 leading-[1.55]", className)} {...rest} />;
}

/** Native date picker. Value is 'YYYY-MM-DD'. */
export function DateInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  return <input type="date" className={cx(controlClass, "iv-num h-11 w-auto min-w-44 cursor-pointer", className)} {...rest} />;
}

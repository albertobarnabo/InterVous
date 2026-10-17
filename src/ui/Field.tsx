"use client";

import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";

/** Shared look for text-like controls. */
export const controlClass =
  "w-full rounded-sm border border-line-strong bg-surface px-3 text-small text-ink placeholder:text-ink-3 " +
  "transition-[border-color,box-shadow] duration-[120ms] ease-out " +
  "hover:border-ink-3 focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/30";

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
        <p id={hintId} className="text-caption font-normal text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, type = "text", ...rest }: ComponentProps<"input">) {
  return <input type={type} className={cx(controlClass, "h-9 pointer-coarse:h-11", className)} {...rest} />;
}

export function Textarea({ className, rows = 4, ...rest }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cx(controlClass, "min-h-20 py-2 leading-6", className)} {...rest} />;
}

/** Native date picker. Value is 'YYYY-MM-DD'. */
export function DateInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="date"
      className={cx(controlClass, "iv-num h-9 w-auto min-w-40 pointer-coarse:h-11", className)}
      {...rest}
    />
  );
}

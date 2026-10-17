"use client";

import {
  Dialog as HDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { cx } from "./cx";
import { Field, Input } from "./Field";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the × button (e.g. when the footer already has Cancel). */
  hideClose?: boolean;
  className?: string;
};

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

/** Headless UI Dialog: focus trap, Esc, aria-modal, scroll lock. Fades and scales from 0.98 in 160ms. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", hideClose, className }: DialogProps) {
  return (
    <HDialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[rgb(21_20_15/0.40)] transition-opacity duration-[160ms] ease-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex w-screen items-end justify-center overflow-y-auto p-4 sm:items-center">
        <DialogPanel
          transition
          className={cx(
            "relative w-full rounded-lg bg-surface p-6 shadow-2 ring-1 ring-line",
            "transition duration-[160ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100",
            widths[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-h3 text-ink">{title}</DialogTitle>
              {description ? <Description className="mt-1 text-small text-ink-2">{description}</Description> : null}
            </div>
            {hideClose ? null : <IconButton label="Close" icon={X} onClick={onClose} className="-mr-2 -mt-1" />}
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </DialogPanel>
      </div>
    </HDialog>
  );
}

export type SheetProps = Omit<DialogProps, "size"> & {
  /** Desktop placement. On mobile (under 768px) a sheet always rises from the bottom. */
  side?: "right" | "bottom";
  width?: "md" | "lg";
};

/** A dialog that slides in (280ms): from the bottom on mobile, from the right on desktop by default. */
export function Sheet({ open, onClose, title, description, children, footer, side = "right", width = "md", hideClose, className }: SheetProps) {
  const desktop =
    side === "right"
      ? cx(
          "md:inset-y-0 md:right-0 md:left-auto md:top-0 md:h-full md:max-h-none md:rounded-none md:rounded-l-lg",
          width === "md" ? "md:w-[480px]" : "md:w-[640px]",
          "md:data-closed:translate-y-0 md:data-closed:translate-x-full",
        )
      : "md:left-1/2 md:w-[640px] md:-translate-x-1/2";
  return (
    <HDialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[rgb(21_20_15/0.40)] transition-opacity duration-[280ms] ease-out data-closed:opacity-0"
      />
      <DialogPanel
        transition
        className={cx(
          "fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-lg bg-surface shadow-2 ring-1 ring-line",
          "transition duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-closed:translate-y-full",
          "motion-reduce:data-closed:translate-x-0 motion-reduce:data-closed:translate-y-0 motion-reduce:data-closed:opacity-0",
          desktop,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-h3 text-ink">{title}</DialogTitle>
            {description ? <Description className="mt-1 text-small text-ink-2">{description}</Description> : null}
          </div>
          {hideClose ? null : <IconButton label="Close" icon={X} onClick={onClose} className="-mr-2" />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </DialogPanel>
    </HDialog>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  /** When set, the confirm button stays disabled until this exact text is typed (e.g. the company name). */
  typeToConfirm?: string;
  loading?: boolean;
};

/** Only for real deletes. Everything reversible uses an Undo toast instead. */
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", typeToConfirm, loading }: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const ok = !typeToConfirm || typed.trim() === typeToConfirm.trim();
  const close = () => {
    setTyped("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      size="sm"
      hideClose
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!ok}
            loading={loading}
            onClick={async () => {
              await onConfirm();
              setTyped("");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body ? <div className="text-small text-ink-2">{body}</div> : null}
      {typeToConfirm ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) void onConfirm();
          }}
        >
          <Field label={<>Type <span className="font-semibold">{typeToConfirm}</span> to confirm</>}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}

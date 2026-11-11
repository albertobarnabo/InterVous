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

/**
 * Headless UI Dialog: focus trap, Esc, aria-modal, scroll lock. Fades and scales from 0.98 in 160ms.
 * However long the content, the title and the buttons stay on screen and only the content scrolls.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", hideClose, className }: DialogProps) {
  return (
    <HDialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="iv-scrim fixed inset-0 transition-opacity duration-[160ms] ease-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex w-screen items-end justify-center overflow-y-auto p-4 sm:items-center">
        <DialogPanel
          transition
          className={cx(
            "iv-glass-thick relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_60px_rgba(15,23,42,0.22)]",
            "transition duration-[160ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100",
            widths[size],
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 sm:px-7 sm:pt-7">
            <div className="min-w-0">
              <DialogTitle className="text-h3 text-ink">{title}</DialogTitle>
              {description ? <Description className="mt-1 text-small text-ink-2">{description}</Description> : null}
            </div>
            {hideClose ? null : <IconButton label="Close" icon={X} size="sm" variant="secondary" onClick={onClose} className="-mr-1 -mt-0.5" />}
          </div>
          {/* The content scrolls on its own; its padding keeps focus rings inside the scroll area. */}
          {/* relative: hidden labels (sr-only is absolute) belong to this scroller, not to the page's */}
          <div className={cx("relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-7", children ? "pt-4" : null, footer ? "pb-1" : "pb-6 sm:pb-7")}>
            {children}
          </div>
          {footer ? <div className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pt-5 pb-6 sm:px-7 sm:pb-7">{footer}</div> : null}
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
          "md:inset-y-3 md:right-3 md:left-auto md:top-3 md:bottom-3 md:max-h-none md:rounded-xl",
          width === "md" ? "md:w-[480px]" : "md:w-[640px]",
          "md:data-closed:translate-y-0 md:data-closed:translate-x-[calc(100%+24px)]",
        )
      : "md:bottom-3 md:left-1/2 md:w-[640px] md:-translate-x-1/2 md:rounded-xl";
  return (
    <HDialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="iv-scrim fixed inset-0 transition-opacity duration-[280ms] ease-out data-closed:opacity-0"
      />
      <DialogPanel
        transition
        className={cx(
          "iv-glass-thick fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl",
          "shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_60px_rgba(15,23,42,0.22)]",
          "transition duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-closed:translate-y-full",
          "motion-reduce:data-closed:translate-x-0 motion-reduce:data-closed:translate-y-0 motion-reduce:data-closed:opacity-0",
          desktop,
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-ink/15 md:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-ink/[0.08] px-6 pt-4 pb-4 md:pt-5">
          <div className="min-w-0">
            <DialogTitle className="text-h3 text-ink">{title}</DialogTitle>
            {description ? <Description className="mt-1 text-small text-ink-2">{description}</Description> : null}
          </div>
          {hideClose ? null : <IconButton label="Close" icon={X} size="sm" variant="secondary" onClick={onClose} className="-mr-1" />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink/[0.08] px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
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
  // While the delete runs nothing can stop it, so nothing should look as if it did.
  const close = () => {
    if (loading) return;
    setTyped("");
    onClose();
  };
  const confirm = async () => {
    if (!ok || loading) return;
    await onConfirm();
    setTyped("");
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
          <Button variant="secondary" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!ok}
            loading={loading}
            onClick={() => void confirm()}
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
            void confirm();
          }}
        >
          <Field label={<>Type <span className="font-semibold">{typeToConfirm}</span> to confirm</>}>
            {/* data-autofocus: Headless UI's focus trap puts the first focus here when the dialog opens */}
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              data-autofocus
            />
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}

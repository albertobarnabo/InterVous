"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type ToastKind = "success" | "error" | "info";
export type ToastInput = {
  kind?: ToastKind;
  text: ReactNode;
  /** The Undo (or similar) action. Running it dismisses the toast. */
  action?: { label: string; run: () => void | Promise<void> };
  /** Milliseconds; default 5000 (the Undo window), errors 8000. */
  duration?: number;
};

type Item = ToastInput & { id: number };
type ToastApi = { show: (t: ToastInput) => number; dismiss: (id: number) => void };

const Ctx = createContext<ToastApi | null>(null);

/** useToast().show({kind, text, action?: {label, run}}). */
export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useToast must be used inside <ToastProvider> (src/app/layout.tsx mounts it)");
  return api;
}

const icons = { success: Check, error: TriangleAlert, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const seq = useRef(1);
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = seq.current++;
      const kind = input.kind ?? "success";
      setItems((xs) => [...xs.slice(-2), { ...input, kind, id }]);
      const ms = input.duration ?? (kind === "error" ? 8000 : 5000);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+12px+env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = icons[t.kind ?? "success"];
            return (
              <motion.div
                key={t.id}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: reduce ? 0.1 : 0.16, ease: "easeOut" }}
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md bg-ink py-2.5 pl-3.5 pr-2 text-small text-bg shadow-2"
              >
                <Icon aria-hidden size={16} className={cx("shrink-0", t.kind === "error" && "text-[var(--danger-soft)]")} />
                <div className="min-w-0 flex-1">{t.text}</div>
                {t.action ? (
                  <button
                    type="button"
                    onClick={async () => {
                      dismiss(t.id);
                      await t.action!.run();
                    }}
                    className="h-8 shrink-0 rounded-sm px-2.5 font-medium text-bg underline-offset-2 hover:underline focus-visible:outline-bg pointer-coarse:min-h-11"
                  >
                    {t.action.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-bg pointer-coarse:size-11"
                >
                  <X aria-hidden size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

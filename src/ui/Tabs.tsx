"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type TabItem<Id extends string = string> = { id: Id; label: ReactNode; count?: number };

export type TabsProps<Id extends string = string> = {
  tabs: TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** Prefix for element ids; pass the same to <TabPanel idBase>. */
  idBase?: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * Tab list with a sliding underline (200ms). Arrow keys, Home and End move between tabs.
 * URL sync (?tab=) is the caller's job. Scrolls horizontally on narrow screens.
 */
export function Tabs<Id extends string = string>({
  tabs,
  value,
  onChange,
  idBase = "tabs",
  className,
  ...aria
}: TabsProps<Id>) {
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      onKeyDown={onKey}
      className={cx(
        "relative flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cx(
              "relative flex h-11 shrink-0 items-center gap-1.5 rounded-t-sm px-3 text-small font-medium",
              "transition-colors duration-[120ms] ease-out focus-visible:outline-offset-[-2px]",
              selected ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? <span className="iv-num text-caption text-ink-3">{t.count}</span> : null}
            {selected ? (
              <motion.span
                layoutId={`${idBase}-underline`}
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type TabPanelProps = { tabId: string; idBase?: string; children: ReactNode; className?: string };

/** The panel for the selected tab. Render only the active one; it fades in over 120ms. */
export function TabPanel({ tabId, idBase = "tabs", children, className }: TabPanelProps) {
  return (
    <motion.div
      key={tabId}
      role="tabpanel"
      id={`${idBase}-panel-${tabId}`}
      aria-labelledby={`${idBase}-tab-${tabId}`}
      tabIndex={0}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={cx("focus-visible:outline-offset-4", className)}
    >
      {children}
    </motion.div>
  );
}

"use client";
// The grouped list (docs/SPEC.md 2.2): In interviews, Waiting, Not sent, Closed, Older records, in
// reading order, each with a count. Closed and Older records start collapsed. A row that changes
// group after a phase change slides there (layout animation, spring 500/40).
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { cx } from "@/ui";
import { AppRow } from "./AppRow";
import type { Group, ListGroupId } from "./model";

const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;
const FADE = { duration: 0.1 } as const;

type Props = {
  groups: Group[];
  /** Which collapsible groups are open. */
  open: Partial<Record<ListGroupId, boolean>>;
  onToggle: (id: ListGroupId) => void;
  /** Force every group open (a search or a group filter is active). */
  expandAll: boolean;
};

export function ApplicationList({ groups, open, onToggle, expandAll }: Props) {
  const reduce = useReducedMotion();
  const shown = groups.filter((g) => g.items.length > 0);
  return (
    <LayoutGroup id="applications-list">
      <div className="flex flex-col gap-8">
        {shown.map((g) => (
          <ListGroup
            key={g.id}
            group={g}
            isOpen={expandAll || !g.collapsedByDefault || !!open[g.id]}
            collapsible={g.collapsedByDefault && !expandAll}
            onToggle={() => onToggle(g.id)}
            reduce={!!reduce}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}

function ListGroup({
  group,
  isOpen,
  collapsible,
  onToggle,
  reduce,
}: {
  group: Group;
  isOpen: boolean;
  collapsible: boolean;
  onToggle: () => void;
  reduce: boolean;
}) {
  const headingId = useId();
  const listId = useId();
  const count = group.items.length;

  const heading = (
    <>
      <span>{group.label}</span>
      <span className="iv-num text-small font-normal text-ink-3">{count}</span>
    </>
  );

  return (
    <motion.section aria-labelledby={headingId} layout={reduce ? false : "position"} transition={SPRING}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-h3 text-ink">
          {collapsible ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={listId}
              className="-mx-2 inline-flex min-h-11 items-center gap-2 rounded-sm px-2 transition-colors duration-[120ms] ease-out hover:bg-surface-2 md:min-h-9"
            >
              <ChevronRight
                aria-hidden
                size={18}
                strokeWidth={1.75}
                className={cx("text-ink-3 transition-transform duration-[200ms] ease-out", isOpen && "rotate-90")}
              />
              {heading}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2">{heading}</span>
          )}
        </h2>
        {group.note ? <p className="text-small text-ink-3">{group.note}</p> : null}
        {group.id === "waiting" ? (
          <p className="hidden text-caption font-normal text-ink-3 md:block">
            Bars count days waiting, up to 60. Marks at 21 days (old enough to judge) and 45 (likely closed).
          </p>
        ) : null}
      </div>

      {/* Opening a group fades its rows in while the groups below slide down (their own layout
          animation). No height clip, so a row moving between groups is never cut off. */}
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.ul
            key="rows"
            id={listId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? FADE : { duration: 0.16, ease: "easeOut" }}
            className="rounded-md bg-surface shadow-1"
          >
            {group.items.map((it, i) => (
              <motion.li
                key={it.id}
                layoutId={reduce ? undefined : `app-row-${it.id}`}
                layout={reduce ? false : "position"}
                transition={SPRING}
                data-item-id={it.id}
                className={cx(
                  "relative [&>a]:rounded-none [&:first-child>a]:rounded-t-md [&:last-child>a]:rounded-b-md",
                  i > 0 && "border-t border-line",
                )}
              >
                <AppRow item={it} />
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

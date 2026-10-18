"use client";
// The board (docs/SPEC.md 2.2): Not sent | Sent | In process | Interviewing | Offer | Closed (n).
// Closed starts collapsed. Drag with mouse, touch or keyboard (@dnd-kit): the handle on each card
// picks it up with Space or Enter, the arrow keys choose a column, Space drops, Escape cancels.
// A drop opens a small panel in the target column with a date (default today) and an optional
// note; confirming writes a `phase_change` event (movePhase), and the toast's Undo reverts it.
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, GripVertical, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgeBar, CompanyMark, IconButton, Menu, PhaseDot, Tag, cx, phaseLabel, type MenuEntry } from "@/ui";
import { PHASES } from "../../../lib/types";
import { toColumns, type AppItem, type BoardColumnId, type Column, type Phase } from "./model";
import { CLOSING_PHASES, MoveForm } from "./move";

const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

type Pending = { item: AppItem; column: BoardColumnId; to: Phase | null };

type Props = {
  items: AppItem[];
  today: string;
  /** The card's "Move to…" menu: open the move dialog for this target. */
  onMenuMove: (item: AppItem, to: Phase) => void;
};

// ── keyboard: the arrow keys jump from column to column ──────────────────────

type Rect = { left: number; right: number; top: number; width: number };

function columnsByLeft(
  containers: Array<{ id: UniqueIdentifier }>,
  rects: Map<UniqueIdentifier, Rect>,
): Array<{ id: UniqueIdentifier; rect: Rect }> {
  return containers
    .map((c) => ({ id: c.id, rect: rects.get(c.id) }))
    .filter((c): c is { id: UniqueIdentifier; rect: Rect } => !!c.rect)
    .sort((a, b) => a.rect.left - b.rect.left);
}

const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (event.code === "ArrowUp" || event.code === "ArrowDown") {
    event.preventDefault();
    return currentCoordinates;
  }
  const dir = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!dir) return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const cols = columnsByLeft(droppableContainers.getEnabled(), droppableRects as Map<UniqueIdentifier, Rect>);
  if (!cols.length) return undefined;
  const centre = collisionRect.left + collisionRect.width / 2;
  let i = cols.findIndex((c) => centre >= c.rect.left && centre <= c.rect.right);
  if (i === -1) {
    // Between columns: start from the nearest one.
    i = cols.reduce((best, c, k) => (Math.abs(c.rect.left - centre) < Math.abs(cols[best].rect.left - centre) ? k : best), 0);
  }
  const next = cols[Math.max(0, Math.min(cols.length - 1, i + dir))];
  return { x: next.rect.left + next.rect.width / 2 - collisionRect.width / 2, y: next.rect.top + 48 };
};

/** Pointer: the column under the pointer. Keyboard (or pointer in a gap): the column under the card's centre. */
const collision: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const hits = pointerWithin(args);
    if (hits.length) return hits;
  }
  const centre = args.collisionRect.left + args.collisionRect.width / 2;
  for (const c of args.droppableContainers) {
    const r = args.droppableRects.get(c.id);
    if (r && centre >= r.left && centre <= r.right) return [{ id: c.id, data: { droppableContainer: c, value: 0 } }];
  }
  return [];
};

function focusHandle(id: number) {
  let tries = 20;
  const run = () => {
    const el = document.querySelector<HTMLElement>(`[data-handle-id="${id}"]`);
    if (el) el.focus({ preventScroll: true });
    else if (tries-- > 0) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

// ── the board ───────────────────────────────────────────────────────────────

export function Board({ items, today, onMenuMove }: Props) {
  const reduce = !!useReducedMotion();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  // A card dropped by drag mounts fresh in its new column (no fly-in from the old one).
  const [arrived, setArrived] = useState<number | null>(null);
  const lastDragEnd = useRef(0);

  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  const columns = useMemo(() => {
    const shown = pending ? items.map((it) => (it.id === pending.item.id ? { ...it, column: pending.column } : it)) : items;
    const cols = toColumns(shown);
    if (!pending) return cols;
    // The card waiting for its date sits at the top of the target column.
    return cols.map((c) =>
      c.id === pending.column ? { ...c, items: [...c.items.filter((it) => it.id === pending.item.id), ...c.items.filter((it) => it.id !== pending.item.id)] } : c,
    );
  }, [items, pending]);

  const colLabel = useCallback((id: UniqueIdentifier | null | undefined) => columns.find((c) => c.id === id)?.label ?? "no column", [columns]);
  const itemName = useCallback(
    (id: UniqueIdentifier) => {
      const it = byId.get(Number(id));
      return it ? `${it.company}, ${it.role}` : "the application";
    },
    [byId],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${itemName(active.id)}, now in ${colLabel(byId.get(Number(active.id))?.column)}. Use the left and right arrow keys to choose a column, Space to drop, Escape to cancel.`,
    onDragOver: ({ over }) => (over ? `Over ${colLabel(over.id)}.` : "Not over a column."),
    onDragEnd: ({ active, over }) => {
      const from = byId.get(Number(active.id))?.column;
      if (!over || over.id === from) return `Dropped. ${itemName(active.id)} stays in ${colLabel(from)}.`;
      return over.id === "closed"
        ? "Dropped on Closed. Choose how it closed and the date to confirm the move."
        : `Dropped on ${colLabel(over.id)}. Choose the date to confirm the move.`;
    },
    onDragCancel: ({ active }) => `Cancelled. ${itemName(active.id)} stays where it was.`,
  };

  const onDragStart = (e: DragStartEvent) => {
    setPending(null);
    setActiveId(Number(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    lastDragEnd.current = Date.now();
    setActiveId(null);
    const item = byId.get(Number(e.active.id));
    const to = e.over?.id as BoardColumnId | undefined;
    if (!item || !to || to === item.column) return;
    const col = columns.find((c) => c.id === to);
    if (!col) return;
    if (to === "closed") setClosedOpen(true);
    setArrived(item.id);
    setPending({ item, column: to, to: col.dropPhase });
  };

  const close = (id: number) => {
    setPending(null);
    focusHandle(id);
    setTimeout(() => setArrived((a) => (a === id ? null : a)), 400);
  };

  const active = activeId != null ? byId.get(activeId) ?? null : null;

  // Opening Closed adds a sixth column; bring it into view inside the board's own scroll.
  const toggleClosed = (id: BoardColumnId) => {
    const opening = !closedOpen;
    setClosedOpen(opening);
    if (opening) {
      requestAnimationFrame(() =>
        document.querySelector(`[data-column="${id}"]`)?.scrollIntoView({ inline: "end", block: "nearest", behavior: reduce ? "auto" : "smooth" }),
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        lastDragEnd.current = Date.now();
        setActiveId(null);
      }}
      accessibility={{
        announcements,
        restoreFocus: false,
        screenReaderInstructions: {
          draggable:
            "To move this application, press Space or Enter. Then use the left and right arrow keys to choose a column, and Space or Enter to drop it. Escape cancels.",
        },
      }}
    >
      <div
        data-dragging={active ? "true" : undefined}
        className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
        onClickCapture={(e) => {
          // A drag ends with a click on whatever is under the pointer: do not open it.
          if (Date.now() - lastDragEnd.current < 250) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div className="flex items-stretch gap-3">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              col={col}
              collapsed={col.collapsedByDefault && !closedOpen}
              onToggle={col.collapsedByDefault ? () => toggleClosed(col.id) : undefined}
              dragging={!!active}
            >
              {col.items.map((it) => (
                <motion.li
                  key={it.id}
                  layout={reduce || it.id === arrived ? false : "position"}
                  layoutId={reduce || it.id === arrived ? undefined : `board-card-${it.id}`}
                  initial={it.id === arrived ? { opacity: 0, scale: 0.98 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduce ? { duration: 0.1 } : SPRING}
                  className="flex flex-col gap-2"
                >
                  <DraggableCard item={it} onMenuMove={onMenuMove} />
                  {pending && pending.item.id === it.id && pending.column === col.id ? (
                    <DropPanel pending={pending} today={today} onDone={() => close(it.id)} onCancel={() => close(it.id)} />
                  ) : null}
                </motion.li>
              ))}
            </BoardColumn>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{active ? <CardBody item={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

// ── columns ─────────────────────────────────────────────────────────────────

function BoardColumn({
  col,
  collapsed,
  onToggle,
  dragging,
  children,
}: {
  col: Column;
  collapsed: boolean;
  onToggle?: () => void;
  dragging: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const count = col.items.length;
  const single = col.phases.length === 1 ? col.phases[0] : null;

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${col.label}, ${count}`}
        className={cx(
          "flex w-14 shrink-0 flex-col items-center rounded-md bg-surface-2 py-2 transition-[background-color,box-shadow] duration-[120ms] ease-out",
          isOver && "bg-accent-soft ring-2 ring-accent",
          dragging && !isOver && "ring-1 ring-line-strong",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Show ${col.label} (${count})`}
          className="flex min-h-11 w-11 flex-col items-center gap-3 rounded-sm py-2 text-ink-2 transition-colors duration-[120ms] ease-out hover:bg-surface hover:text-ink"
        >
          <ChevronRight aria-hidden size={16} strokeWidth={1.75} />
          <span className="text-small font-medium [writing-mode:vertical-rl]">
            {col.label} <span className="iv-num font-normal text-ink-3">({count})</span>
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      data-column={col.id}
      aria-label={`${col.label}, ${count}`}
      className={cx(
        "flex w-[272px] shrink-0 flex-col rounded-md bg-surface-2 p-2 transition-[background-color,box-shadow] duration-[120ms] ease-out md:w-auto md:min-w-[196px] md:flex-1 md:shrink",
        isOver && "bg-accent-soft ring-2 ring-accent",
      )}
    >
      <header className="flex h-9 items-center gap-2 px-1.5">
        {single ? <PhaseDot phase={single} label="" /> : null}
        <h2 className="min-w-0 flex-1 truncate text-small font-medium text-ink">{col.label}</h2>
        <span className="iv-num text-caption font-normal text-ink-3">{count}</span>
        {onToggle ? <IconButton size="sm" label={`Hide ${col.label}`} icon={ChevronLeft} onClick={onToggle} aria-expanded className="-mr-1" /> : null}
      </header>
      <ul className="mt-1 flex min-h-24 flex-1 flex-col gap-2">
        {children}
        {count === 0 ? (
          <li className={cx("rounded-md border border-dashed px-3 py-6 text-center text-caption font-normal", isOver ? "border-accent text-accent" : "border-line-strong text-ink-3")}>
            {dragging ? "Drop here" : "Nothing here"}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

// ── cards ───────────────────────────────────────────────────────────────────

function moveMenu(item: AppItem, onMenuMove: Props["onMenuMove"]): MenuEntry[] {
  const entry = (p: Phase): MenuEntry => ({ label: `Move to ${phaseLabel(p)}`, onSelect: () => onMenuMove(item, p) });
  const open = PHASES.filter((p) => !CLOSING_PHASES.includes(p) && p !== item.phase).map(entry);
  const closing = CLOSING_PHASES.filter((p) => p !== item.phase).map(entry);
  return [...open, "separator", ...closing, "separator", { label: "Open", href: item.href }];
}

function DraggableCard({ item, onMenuMove }: { item: AppItem; onMenuMove: Props["onMenuMove"] }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} {...listeners} data-item-id={item.id} className={cx("touch-manipulation", isDragging && "opacity-40")}>
      <CardBody
        item={item}
        controls={
          <>
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              type="button"
              data-handle-id={item.id}
              aria-label={`Drag ${item.company}, ${item.role}`}
              className={cx(
                "inline-flex size-8 cursor-grab items-center justify-center rounded-sm text-ink-3 transition-colors duration-[120ms] ease-out",
                "hover:bg-surface-2 hover:text-ink active:cursor-grabbing pointer-coarse:size-11",
              )}
            >
              <GripVertical aria-hidden size={16} strokeWidth={1.75} />
            </button>
            <span onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="contents">
              <Menu
                items={moveMenu(item, onMenuMove)}
                trigger={<IconButton size="sm" label={`Move ${item.company} to…`} icon={MoreHorizontal} />}
              />
            </span>
          </>
        }
      />
    </div>
  );
}

function CardBody({ item, controls, overlay }: { item: AppItem; controls?: ReactNode; overlay?: boolean }) {
  const age = item.waiting !== null && (item.phase === "applied" || item.phase === "screening");
  // On a pending drop into Closed the phase is still the old one: name it only once it is closed.
  const closedPhase = CLOSING_PHASES.includes(item.phase);
  return (
    <article
      className={cx(
        "relative rounded-md bg-surface p-3 shadow-1",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent",
        overlay && "cursor-grabbing shadow-2 ring-1 ring-accent",
      )}
    >
      <div className="flex items-center gap-2">
        <CompanyMark name={item.company} logoUrl={item.logoUrl} size={24} />
        <span className="min-w-0 flex-1 truncate text-caption font-normal text-ink-2">{item.company}</span>
      </div>
      {overlay ? (
        <p className="mt-2 line-clamp-2 text-small font-medium text-ink">{item.role}</p>
      ) : (
        <Link
          href={item.href}
          draggable={false}
          data-item-link={item.id}
          className={cx(
            "mt-2 line-clamp-2 text-small font-medium text-ink focus-visible:outline-none [-webkit-touch-callout:none]",
            "after:absolute after:inset-0 after:rounded-md after:content-['']",
          )}
        >
          {item.role}
        </Link>
      )}
      <p className="mt-1 text-caption font-normal text-ink-3">{item.now}</p>
      {age ? <AgeBar days={item.waiting} className="mt-2" /> : null}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {closedPhase ? (
            <Tag>
              <PhaseDot phase={item.phase} label="" size={6} />
              {phaseLabel(item.phase)}
            </Tag>
          ) : null}
          {item.unconfirmed.length ? (
            <Tag tone="caution" title={`Not confirmed yet: ${item.unconfirmed.join(", ")}`}>
              Unconfirmed
            </Tag>
          ) : null}
          {item.visa ? <Tag title="This role needs a visa or work permit">Visa</Tag> : null}
          {!item.inWindow ? <Tag title="From the old tracker, incomplete">Old tracker</Tag> : null}
        </div>
        <span className="relative z-10 -mr-1.5 -mb-1.5 flex shrink-0 items-center">
          {controls ?? (
            <span aria-hidden className="flex text-ink-3">
              <span className="inline-flex size-8 items-center justify-center">
                <GripVertical size={16} strokeWidth={1.75} />
              </span>
              <span className="inline-flex size-8 items-center justify-center">
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </span>
            </span>
          )}
        </span>
      </div>
    </article>
  );
}

// ── the drop panel ──────────────────────────────────────────────────────────

function DropPanel({ pending, today, onDone, onCancel }: { pending: Pending; today: string; onDone: () => void; onCancel: () => void }) {
  const { item, to } = pending;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // The target column may sit outside the board's scroll (Closed, or any column on a phone).
    const raf = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} role="group" aria-label={`Move ${item.company}`} className="scroll-m-4 rounded-md bg-surface p-3 shadow-2 ring-1 ring-accent">
      {to ? (
        <p className="mb-3 text-small text-ink-2">
          <span className="font-medium text-ink">Move to {phaseLabel(to)}.</span> When did it happen?
        </p>
      ) : null}
      <MoveForm
        item={item}
        today={today}
        to={to}
        choices={to ? undefined : CLOSING_PHASES}
        choiceLabel="How did it close?"
        onDone={onDone}
        onCancel={onCancel}
      />
    </div>
  );
}

"use client";
// List keys (docs/SPEC.md 2.8): j / k move between rows, Enter opens (a native link), m opens the
// move menu for the focused row. The same keys work on the board's cards.
// Rows and cards mark their link with data-item-link="<id>".
import { useEffect, useRef } from "react";
import { isTypingTarget } from "@/ui";

const LINK = "[data-item-link]";

function links(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(LINK)].filter((el) => el.offsetParent !== null);
}

/** The id of the row or card that holds focus, or null. */
export function focusedItemId(): number | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return null;
  const host = el.closest<HTMLElement>("[data-item-id]");
  const raw = host?.dataset.itemId ?? el.dataset.itemLink;
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) ? id : null;
}

/**
 * Focus the link of an item once it is on screen and no dialog is open (a closing dialog restores
 * focus to where it was opened from, which would otherwise win). Gives up after `timeoutMs`.
 */
export function focusItem(id: number, timeoutMs = 5000) {
  const start = Date.now();
  const run = () => {
    const el = document.querySelector<HTMLElement>(`[data-item-link="${id}"]`);
    if (el && el.offsetParent !== null && !document.querySelector("[role=dialog]")) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest" });
      return;
    }
    if (Date.now() - start < timeoutMs) setTimeout(run, 40);
  };
  setTimeout(run, 0);
}

export function useListKeys({ onMove, enabled = true }: { onMove: (id: number) => void; enabled?: boolean }) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      // While a board card is being dragged with the keyboard, dnd-kit owns the keys.
      if (document.querySelector("[data-dragging=true]")) return;
      const key = e.key;
      if (key !== "j" && key !== "k" && key !== "m") return;

      if (key === "m") {
        const id = focusedItemId();
        if (id == null) return;
        e.preventDefault();
        onMoveRef.current(id);
        return;
      }

      const all = links();
      if (!all.length) return;
      e.preventDefault();
      const current = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-item-id]") : null;
      const currentLink = current?.querySelector<HTMLElement>(LINK) ?? null;
      let i = currentLink ? all.indexOf(currentLink) : -1;
      if (i === -1) i = key === "j" ? -1 : all.length;
      const next = all[Math.max(0, Math.min(all.length - 1, i + (key === "j" ? 1 : -1)))];
      next.focus();
      next.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

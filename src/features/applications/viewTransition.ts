"use client";
// List → dossier View Transition (docs/SPEC.md 3.7): the company mark and the role title morph into
// the dossier header. Names are set only on the clicked row, right before the transition starts,
// so no two elements ever share a name:
//   mark  → `app-{id}`        role title → `app-title-{id}`
// The dossier header (src/features/dossier/Header.tsx) sets the same two names on its
// company mark and its h1, through viewTransitionNames() below.
import { useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> };
};

export function viewTransitionNames(id: number) {
  return { mark: `app-${id}`, role: `app-title-${id}` };
}

/** The transition waiting for the dossier to draw its header. */
let pending: { id: number; finish: () => void } | null = null;

/**
 * The dossier header calls this (in a layout effect) once it is in the DOM with its names set:
 * that is the moment the browser may capture the new view, so the mark and title can morph.
 */
export function viewTransitionTargetReady(id: number) {
  if (pending && pending.id === id) pending.finish();
}

/**
 * onClick handler for a row link. Plain left clicks run the navigation inside
 * document.startViewTransition when the browser has it and motion is allowed; everything
 * else (modifier clicks, middle clicks, old browsers, reduced motion) falls through to the Link.
 */
export function useTransitionNavigate() {
  const router = useRouter();

  return useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: number, href: string) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const doc = document as ViewTransitionDocument;
      if (typeof doc.startViewTransition !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      e.preventDefault();

      const names = viewTransitionNames(id);
      const row = e.currentTarget;
      // Rows render a desktop and a mobile layout; name only the one on screen.
      const visible = (sel: string) =>
        [...row.querySelectorAll<HTMLElement>(sel)].find((el) => el.getClientRects().length > 0) ?? null;
      const mark = visible("[data-vt=mark]");
      const role = visible("[data-vt=role]");
      if (mark) mark.style.viewTransitionName = names.mark;
      if (role) role.style.viewTransitionName = names.role;

      try {
        pending?.finish();
        doc.startViewTransition(
          () =>
            new Promise<void>((resolve) => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                if (pending?.finish === finish) pending = null;
                resolve();
              };
              pending = { id, finish };
              router.push(href);
              // Never hold the page frozen for long: a dossier that is still loading (or a missing
              // one) ends the wait here and the view simply cross-fades.
              setTimeout(finish, 500);
            }),
        );
      } catch {
        pending = null;
        if (mark) mark.style.viewTransitionName = "";
        if (role) role.style.viewTransitionName = "";
        router.push(href);
      }
    },
    [router],
  );
}

"use client";
// The filter and the search live in the URL query, so Home's tiles can link straight to a filter:
//   /applications?show=waiting   ?show=interviews   ?show=not_sent   ?show=closed   ?q=text
// The Closed group adds its own: ?why=rejected-screening (why they closed) and ?page=2.
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SHOW_VALUES, type Show } from "./model";

export type ListState = { show: Show; q: string; why: string; page: number };

function parse(params: URLSearchParams): ListState {
  const show = params.get("show") as Show | null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    show: show && SHOW_VALUES.includes(show) ? show : "all",
    q: params.get("q") ?? "",
    why: params.get("why") ?? "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

function serialize(s: ListState): string {
  const p = new URLSearchParams();
  if (s.show !== "all") p.set("show", s.show);
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.why) p.set("why", s.why);
  if (s.page > 1) p.set("page", String(s.page));
  return p.toString();
}

export function useListState(): [ListState, (patch: Partial<ListState>) => void] {
  const params = useSearchParams();
  const state = useMemo(() => parse(new URLSearchParams(params?.toString() ?? "")), [params]);

  const update = useCallback((patch: Partial<ListState>) => {
    // The browser's own history call is written at once (Next keeps useSearchParams in step with it),
    // so the next update reads this one back: a quick click right after typing loses neither.
    const current = parse(new URLSearchParams(window.location.search));
    const next = { ...current, ...patch };
    const changed = (k: "q" | "show" | "why") => k in patch && patch[k] !== current[k];
    // A new search, view or closed filter starts again from the first page; the same one does not.
    if (!("page" in patch) && (changed("q") || changed("show") || changed("why"))) next.page = 1;
    // The closed filter belongs to the views that show the Closed group.
    if (changed("show") && next.show !== "all" && next.show !== "closed") next.why = "";
    const qs = serialize(next);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  return [state, update];
}

"use client";
// The filter and the search live in the URL query, so Home's tiles can link straight to a filter:
//   /applications?show=waiting   ?show=interviews   ?show=not_sent   ?show=closed   ?q=text
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SHOW_VALUES, type Show } from "./model";

export type ListState = { show: Show; q: string };

function parse(params: URLSearchParams): ListState {
  const show = params.get("show") as Show | null;
  return { show: show && SHOW_VALUES.includes(show) ? show : "all", q: params.get("q") ?? "" };
}

function serialize(s: ListState): string {
  const p = new URLSearchParams();
  if (s.show !== "all") p.set("show", s.show);
  if (s.q.trim()) p.set("q", s.q.trim());
  return p.toString();
}

export function useListState(): [ListState, (patch: Partial<ListState>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/applications";
  const state = useMemo(() => parse(new URLSearchParams(params?.toString() ?? "")), [params]);

  const update = useCallback(
    (patch: Partial<ListState>) => {
      // Read the live query so two quick updates do not overwrite each other.
      const current = parse(new URLSearchParams(window.location.search));
      const qs = serialize({ ...current, ...patch });
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return [state, update];
}

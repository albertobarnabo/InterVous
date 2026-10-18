"use client";
// The view and every filter live in the URL query (docs/SPEC.md 2.2):
//   ?view=board  ?group=waiting,not_sent  ?family=forward_deployed  ?visa=1  ?unconfirmed=1  ?q=text
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { GROUP_IDS, type Filters, type ListGroupId } from "./model";

export type View = "list" | "board";
export type ListState = Filters & { view: View };

export const EMPTY_FILTERS: Filters = { groups: [], family: null, visa: false, unconfirmed: false, q: "" };

function parse(params: URLSearchParams): ListState {
  const groups = (params.get("group") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ListGroupId => (GROUP_IDS as string[]).includes(s));
  return {
    view: params.get("view") === "board" ? "board" : "list",
    groups: [...new Set(groups)],
    family: params.get("family") || null,
    visa: params.get("visa") === "1",
    unconfirmed: params.get("unconfirmed") === "1",
    q: params.get("q") ?? "",
  };
}

function serialize(s: ListState): string {
  const p = new URLSearchParams();
  if (s.view === "board") p.set("view", "board");
  if (s.groups.length) p.set("group", GROUP_IDS.filter((g) => s.groups.includes(g)).join(","));
  if (s.family) p.set("family", s.family);
  if (s.visa) p.set("visa", "1");
  if (s.unconfirmed) p.set("unconfirmed", "1");
  if (s.q.trim()) p.set("q", s.q.trim());
  // Keep commas readable in the address bar.
  return p.toString().replace(/%2C/gi, ",");
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

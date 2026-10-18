"use client";
import { useMemo } from "react";
import { FIXTURE_MODE, todayIn, useApplications, useResource, useSettings } from "../../../lib/data";
import { fixtureToday, loadFixture } from "../../../lib/data/fixture";
import { buildItems, type AppItem } from "./model";

/** 'YYYY-MM-DD' in the user's time zone (the fixture's pinned date in fixture mode). */
export function useToday(timeZone: string | undefined): string | null {
  // The key must not start with 'applications': patchCached() matches cache keys by prefix.
  const fx = useResource<string>(FIXTURE_MODE ? "fixture-today" : null, async () => fixtureToday(await loadFixture()));
  if (FIXTURE_MODE) return fx.data ?? null;
  return todayIn(timeZone ?? "Europe/Berlin");
}

export type ApplicationItems = {
  items: AppItem[] | undefined;
  today: string | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/** Every application as a list/board item: now sentence, group, column, age, chips. */
export function useApplicationItems(): ApplicationItems {
  const apps = useApplications();
  const settings = useSettings();
  const today = useToday(settings.data?.timezone);
  // Settings decide the campaign window and the no-reply threshold; fall back to the defaults on error.
  const settingsReady = !settings.loading || !!settings.error;

  const items = useMemo(() => {
    if (!apps.data || !today || !settingsReady) return undefined;
    return buildItems(apps.data, settings.data, today);
  }, [apps.data, settings.data, today, settingsReady]);

  return {
    items,
    today,
    loading: items === undefined && !apps.error,
    refreshing: apps.refreshing,
    error: apps.error,
    refetch: apps.refetch,
  };
}

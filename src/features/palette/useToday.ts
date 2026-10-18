"use client";

import { useEffect, useState } from "react";
import { FIXTURE_MODE, todayIn, useSettings } from "../../../lib/data";
import { fixtureToday, loadFixture } from "../../../lib/data/fixture";

/**
 * Today as 'YYYY-MM-DD' in the user's timezone (user_settings.timezone, Europe/Berlin by default).
 * In dev fixture mode it is the fixture's pinned date, so sentences match `intervous today`.
 */
export function useToday(): string {
  const { data } = useSettings();
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => {
    if (!FIXTURE_MODE) return;
    let live = true;
    loadFixture()
      .then((f) => live && setPinned(fixtureToday(f)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return pinned ?? todayIn(data?.timezone ?? "Europe/Berlin");
}

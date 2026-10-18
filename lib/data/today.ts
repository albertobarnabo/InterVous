'use client';
// Today as 'YYYY-MM-DD' for screens: the user's time zone (user_settings.timezone), or the
// fixture's pinned date in dev fixture mode so sentences match `intervous today`.
import { useEffect, useState } from 'react';
import { todayIn } from './dates';
import { FIXTURE_MODE } from './env';
import { fixtureToday, loadFixture } from './fixture';
import { useSettings } from './queries';

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
    return pinned ?? todayIn(data?.timezone ?? 'Europe/Berlin');
}

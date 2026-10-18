'use client';
// Company logos per application id, from the shared applications read (cached with /applications).
import { useMemo } from 'react';
import { useApplications } from '../../../lib/data';

export function useLogos(): Map<number, string | null> {
    const apps = useApplications();
    return useMemo(() => new Map((apps.data ?? []).map((a) => [Number(a.id), a.company_logo_url ?? null])), [apps.data]);
}

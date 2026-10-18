'use client';
// The input of lib/core buildHome (buildToday + computeInsights), for /home.
// useInsightsInput() (lib/data) already returns the complete input, contacts and the jobs columns
// job_overview leaves out included, so this is a pass-through that keeps the screens' result shape.
import type { CoreInput } from '../../../lib/core';
import { useInsightsInput, type InsightsInput } from '../../../lib/data';

export type CoreInputResult = {
    /** null until the read has landed. */
    input: CoreInput | null;
    /** The same object, typed as lib/data returns it (for writes that need the stored row, e.g. `uncertain`). */
    raw: InsightsInput | null;
    error: Error | null;
    loading: boolean;
    refreshing: boolean;
    refetch: () => Promise<void>;
};

export function useCoreInput(): CoreInputResult {
    const base = useInsightsInput();
    const raw = base.data ?? null;
    return {
        input: raw as unknown as CoreInput | null,
        raw,
        error: base.error,
        loading: base.loading,
        refreshing: base.refreshing,
        refetch: base.refetch,
    };
}

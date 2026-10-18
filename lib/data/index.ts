// InterVous data layer (docs/SPEC.md 8, WP5). Client-side only: import from client components.
//   reads:  useApplications, useApplication(ref), useInsightsInput, useSettings, useToday, searchCompanies
//   writes: logEvent, movePhase, recordUpdate (undoable), updateApplication (0 rows = error), signedUrl(path),
//           linkCompany(jobId, companyId|null), setCompanyLogo(companyId, file|url), removeCompanyLogo, and helpers
//   live:   refetch on visibilitychange + Realtime on jobs/job_events/job_documents (automatic)
//   dev:    NEXT_PUBLIC_FIXTURES=1 with NODE_ENV=development reads lib/core/test/fixture.json instead
export { useApplications, useApplication, useInsightsInput, useSettings, KEYS } from './queries';
export {
    logEvent,
    movePhase,
    recordUpdate,
    updateApplication,
    deleteApplication,
    wasDeleted,
    deleteEvent,
    updateRequirement,
    updateAnswer,
    updateProofPoint,
    updateJobProofPoint,
    updateSettings,
    signedUrl,
    refetchAll,
} from './mutations';
export type { MoveResult, RecordResult } from './mutations';
export {
    searchCompanies,
    getCompanyOption,
    linkCompany,
    setCompanyLogo,
    removeCompanyLogo,
    logoFileProblem,
    checkLogoUrl,
    LOGO_MAX_BYTES,
    LOGO_TYPES,
} from './companies';
export type { CompanyOption } from './companies';
export { useToday } from './today';
export { useResource, invalidateAll, patchCached, peekCached, startLive } from './store';
export type { Resource, ResourceResult } from './store';
export { FIXTURE_MODE } from './env';
export { todayIn } from './dates';
export * from './rows';

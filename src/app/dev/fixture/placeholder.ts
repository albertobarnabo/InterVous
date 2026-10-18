// Served by ./route.ts only when lib/core/test/fixture.json is missing (dev fixture mode).
// Invented sample rows, just enough to render every screen; not real applications.
const U = "fixture-user";
const job = (o: Record<string, unknown>) => ({
  user_id: U, location: "", url: "", stage: null, status: null, application_date: null,
  company_id: null, country_code: null, channel: null, role_family: null, visa_needed: null, years_required: null,
  applied_on: null, cv_built_on: null, closes_on: null, next_action: null, next_action_due: null, posting_live: null,
  uncertain: [], last_activity_at: null, created_at: "2026-09-01T09:00:00Z", updated_at: "2026-10-10T09:00:00Z", source: "web",
  first_response_on: null, last_inbound_on: null, last_follow_up_on: null, last_event_on: null, next_interview_at: null,
  open_gaps: 0, cautions: 0, answer_count: 0, unsaved_answers: 0, has_cv: false, has_sent_cv: false, has_jd: false,
  ...o,
});
const ev = (id: number, job_id: number, kind: string, occurred_on: string, o: Record<string, unknown> = {}) => ({
  id, job_id, user_id: U, kind, occurred_on, occurred_at: null, date_uncertain: false, from_phase: null, to_phase: null,
  direction: ["reply", "interview_scheduled", "rejection", "offer", "auto_ack", "assessment"].includes(kind) ? "in" : kind === "applied" ? "out" : "self",
  title: null, body: null, contact_id: null, source: "web", created_at: `${occurred_on}T10:00:00Z`, ...o,
});

export const PLACEHOLDER_FIXTURE = {
  placeholder: true,
  today: "2026-10-17",
  apps: [
    job({ id: 1, slug: "example-draft", company_name: "Example Labs", role: "Applied AI Engineer", location: "Berlin, DE", country_code: "DE",
      phase: "draft", cv_built_on: "2026-10-03", posting_live: true, last_event_on: "2026-10-03", has_cv: true, uncertain: ["cv_built_on"] }),
    job({ id: 2, slug: "sample-waiting", company_name: "Sample Corp", role: "ML Engineer", location: "London, UK", country_code: "GB",
      phase: "applied", visa_needed: true, cv_built_on: "2026-08-28", applied_on: "2026-08-30", last_event_on: "2026-08-30", has_cv: true, channel: "ats" }),
    job({ id: 3, slug: "demo-interviewing", company_name: "Demo Systems", role: "Forward Deployed Engineer", location: "Remote",
      phase: "interviewing", cv_built_on: "2026-08-20", applied_on: "2026-08-22", first_response_on: "2026-08-26", last_inbound_on: "2026-09-03",
      last_event_on: "2026-09-03", has_cv: true, has_jd: true, cautions: 1, channel: "referral" }),
    job({ id: 4, slug: "closed-example", company_name: "Closed Example GmbH", role: "Data Scientist", location: "Munich, DE", country_code: "DE",
      phase: "rejected", cv_built_on: "2026-08-10", applied_on: "2026-08-11", first_response_on: "2026-09-01", last_inbound_on: "2026-09-01", last_event_on: "2026-09-01" }),
  ],
  events: [
    ev(1, 1, "cv_built", "2026-10-03"),
    ev(2, 2, "cv_built", "2026-08-28"),
    ev(3, 2, "applied", "2026-08-30", { to_phase: "applied", from_phase: "draft" }),
    ev(4, 3, "cv_built", "2026-08-20"),
    ev(5, 3, "applied", "2026-08-22", { to_phase: "applied", from_phase: "draft" }),
    ev(6, 3, "reply", "2026-08-26", { to_phase: "screening", from_phase: "applied", title: "Recruiter reply" }),
    ev(7, 3, "interview_scheduled", "2026-09-03", { to_phase: "interviewing", from_phase: "screening", title: "Round 1 invite" }),
    ev(8, 4, "applied", "2026-08-11", { to_phase: "applied", from_phase: "draft" }),
    ev(9, 4, "rejection", "2026-09-01", { to_phase: "rejected", from_phase: "applied", title: "Rejection email" }),
  ],
  documents: [
    { id: "d1", job_id: 3, user_id: U, kind: "jd_snapshot", label: "Captured while building", storage_path: null,
      content: "## Forward Deployed Engineer\n\nYou will work with customers to ship **production LLM systems**.\n\n- 5+ years of software engineering\n- Experience with Kubernetes\n- Python and TypeScript",
      mime_type: "text/markdown", size_bytes: 180, sha256: "placeholder1", source_url: null, captured_at: "2026-08-20T10:00:00Z", submitted: null, created_at: "2026-08-20T10:00:00Z" },
  ],
  answers: [
    { id: "a1", job_id: 3, user_id: U, position: 0, question: "Why this team?", answer: null, char_limit: 1200, submitted: true,
      source_path: "given in chat 2026-08-22", created_at: "2026-08-22T10:00:00Z", updated_at: "2026-08-22T10:00:00Z" },
  ],
  requirements: [
    { id: "r1", job_id: 3, user_id: U, position: 0, requirement: "Python and TypeScript", importance: "required", verdict: "met",
      evidence: "Daily in two shipped projects", topic: null, gap_state: null, anchor_text: "Python and TypeScript", note: null, created_at: "2026-08-20T10:00:00Z" },
    { id: "r2", job_id: 3, user_id: U, position: 1, requirement: "5+ years of software engineering", importance: "required", verdict: "gap",
      evidence: null, topic: "years_experience", gap_state: "worded_around", anchor_text: "5+ years of software engineering", note: null, created_at: "2026-08-20T10:00:00Z" },
    { id: "r3", job_id: 3, user_id: U, position: 2, requirement: "Production claim in the answer", importance: null, verdict: "caution",
      evidence: "The answer says production; it runs in the lab only.", topic: null, gap_state: null, anchor_text: null, note: null, created_at: "2026-08-20T10:00:00Z" },
  ],
  proofPoints: [
    { id: "p1", user_id: U, key: "sample-parser", name: "Sample parser", summary: "A document parser", metric: "73.8% exact match",
      facts: { exact_match: "73.8%" }, aliases: [], metric_status: "needs_care", caveat: "Lab only", link: null,
      created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-01T10:00:00Z" },
  ],
  jobProofPoints: [{ job_id: 3, proof_point_id: "p1", user_id: U, position: 0, detail: "84.7% strict F1" }],
  contacts: [{ id: "c1", user_id: U, job_id: 3, company_id: null, name: "A. Recruiter", role: "Recruiter", email: null, linkedin_url: null, notes: null, created_at: "2026-08-26T10:00:00Z" }],
  companies: [],
  settings: { user_id: U, follow_up_after_days: 14, no_reply_after_days: 45, mature_after_days: 21, draft_stale_after_days: 7,
    weekly_target: 3, timezone: "Europe/Berlin", campaign_start: "2026-08-01", updated_at: "2026-08-01T00:00:00Z" },
};

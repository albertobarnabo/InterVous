// Would iv_upsert_application change anything for this payload? (spec 7.4 step 4: a re-run of the
// import changes nothing.)
//
// The RPC always rewrites the row (updated_at) and replaces the lists it is given (new ids), so the
// importer skips the call when the stored state already equals what the call would leave behind.
// This mirrors the RPC's rules exactly: missing key = keep, gap_state and answer text carried over
// by matching text, proof-point facts merged, events and documents de-duplicated.
import { diffJob } from '../lib/manifest.mjs';
import { must } from '../lib/output.mjs';

const lower = (s) => String(s ?? '').trim().toLowerCase();
const nul = (v) => (v === undefined || v === '' ? null : v);
/** JSON with sorted keys, so jsonb equality does not depend on key order. */
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * Everything the RPC reads or replaces for one job.
 * @param {any} ctx
 * @param {number} jobId
 */
export async function loadStored(ctx, jobId) {
  const sb = ctx.sb;
  const q = async (table, cols, order) => {
    let b = sb.from(table).select(cols).eq('job_id', jobId);
    if (order) b = b.order(order);
    return must(await b, `load ${table}`) ?? [];
  };
  const [job, requirements, answers, jpp, contacts, events, documents] = await Promise.all([
    sb.from('jobs').select('*').eq('id', jobId).maybeSingle().then((r) => must(r, 'load the application')),
    q('job_requirements', 'position, requirement, importance, verdict, evidence, topic, gap_state, anchor_text, note', 'position'),
    q('job_answers', 'position, question, answer, char_limit, submitted, source_path', 'position'),
    q('job_proof_points', 'position, detail, proof_point:proof_points(key)', 'position'),
    q('contacts', 'name, role, email, linkedin_url, notes, company_id'),
    q('job_events', 'kind, occurred_on, title'),
    q('job_documents', 'kind, sha256, label, submitted, storage_path'),
  ]);
  return { job, requirements, answers, jpp, contacts, events, documents };
}

/** The user's proof_points rows by key. */
export async function loadProofPoints(ctx) {
  const rows = must(await ctx.sb.from('proof_points').select('key, name, summary, metric, facts, metric_status, caveat, link'), 'load proof points') ?? [];
  return new Map(rows.map((r) => [r.key, r]));
}

/**
 * What the call would change, as short reasons; [] means nothing.
 * @param {Awaited<ReturnType<typeof loadStored>> | null} stored  null = no row yet
 * @param {Record<string, any>} p   the full RPC payload, documents included
 * @param {{ company: { id: string, name: string } | null, proofPoints: Map<string, any> }} env
 */
export function pendingChanges(stored, p, env) {
  if (!stored?.job) return ['new application'];
  const { job } = stored;
  const reasons = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(p, k);

  const companyName = env.company?.name ?? (p.company ? String(p.company).trim() : null);
  for (const c of diffJob(job, p, companyName)) reasons.push(c.field);
  if (job.slug !== p.slug) reasons.push('slug');
  if (env.company && job.company_id !== env.company.id) reasons.push('company_id');
  if (p.source === 'import' && job.source !== 'import') reasons.push('source');
  const companyId = env.company?.id ?? job.company_id ?? null;

  if (has('requirements')) {
    const old = new Map(stored.requirements.map((r) => [lower(r.requirement), r.gap_state]));
    const want = (p.requirements ?? []).map((r) => ({
      requirement: r.requirement, importance: nul(r.importance), verdict: r.verdict, evidence: nul(r.evidence),
      topic: r.topic ? lower(r.topic) : null,
      gap_state: ['gap', 'partial'].includes(r.verdict) ? (nul(r.gap_state) ?? nul(old.get(lower(r.requirement))) ?? 'open') : null,
      anchor_text: nul(r.anchor_text), note: nul(r.note),
    }));
    const got = stored.requirements.map((r) => ({
      requirement: r.requirement, importance: nul(r.importance), verdict: r.verdict, evidence: nul(r.evidence), topic: nul(r.topic),
      gap_state: nul(r.gap_state), anchor_text: nul(r.anchor_text), note: nul(r.note),
    }));
    if (canon(want) !== canon(got)) reasons.push('requirements');
  }

  if (has('answers')) {
    const old = new Map(stored.answers.map((a) => [lower(a.question), a]));
    const want = (p.answers ?? []).map((a) => {
      const o = old.get(lower(a.question));
      return {
        question: a.question, answer: nul(a.answer) ?? nul(o?.answer) ?? null, char_limit: nul(a.char_limit) ?? null,
        submitted: a.submitted ?? o?.submitted ?? null, source_path: nul(a.source_path),
      };
    });
    const got = stored.answers.map((a) => ({ question: a.question, answer: nul(a.answer), char_limit: nul(a.char_limit), submitted: a.submitted ?? null, source_path: nul(a.source_path) }));
    if (canon(want) !== canon(got)) reasons.push('answers');
  }

  if (has('proof_points')) {
    const want = (p.proof_points ?? []).map((x) => ({ key: x.key, detail: nul(x.detail) }));
    const got = stored.jpp.map((x) => ({ key: x.proof_point?.key ?? null, detail: nul(x.detail) }));
    if (canon(want) !== canon(got)) reasons.push('proof_points');
    for (const x of p.proof_points ?? []) {
      const row = env.proofPoints.get(x.key);
      if (!row) {
        reasons.push(`proof point ${x.key} (new)`);
        continue;
      }
      const next = {
        name: x.name !== undefined ? (x.name ?? x.key) : row.name,
        summary: x.summary ?? row.summary ?? null,
        metric: x.metric ?? row.metric ?? null,
        facts: { ...(row.facts ?? {}), ...(x.facts ?? {}) },
        metric_status: x.metric_status !== undefined ? (x.metric_status ?? 'verified') : row.metric_status,
        caveat: x.caveat ?? row.caveat ?? null,
        link: x.link ?? row.link ?? null,
      };
      const cur = { name: row.name, summary: row.summary ?? null, metric: row.metric ?? null, facts: row.facts ?? {}, metric_status: row.metric_status, caveat: row.caveat ?? null, link: row.link ?? null };
      if (canon(next) !== canon(cur)) reasons.push(`proof point ${x.key}`);
    }
  }

  if (has('contacts')) {
    const key = (c) => canon([lower(c.name), nul(c.role), nul(c.email), nul(c.linkedin_url), nul(c.notes)]);
    const want = (p.contacts ?? []).map(key).sort();
    const got = stored.contacts.map(key).sort();
    if (canon(want) !== canon(got) || stored.contacts.some((c) => (c.company_id ?? null) !== companyId)) reasons.push('contacts');
  }

  if (has('events')) {
    const seen = new Set(stored.events.map((e) => `${e.kind}|${e.occurred_on}|${e.title ?? ''}`));
    const fresh = (p.events ?? []).filter((e) => !seen.has(`${e.kind}|${e.on}|${e.title ?? ''}`));
    if (fresh.length) reasons.push(`${fresh.length} new event${fresh.length === 1 ? '' : 's'}`);
  }

  if (has('documents')) {
    const byKey = new Map(stored.documents.map((d) => [`${d.kind}|${d.sha256}`, d]));
    for (const d of p.documents ?? []) {
      const s = byKey.get(`${d.kind}|${d.sha256}`);
      if (!s) reasons.push(`new ${d.kind}`);
      else if ((d.label != null && s.label !== d.label) || (d.submitted != null && s.submitted !== d.submitted)) reasons.push(`${d.kind} label`);
    }
  }
  return reasons;
}

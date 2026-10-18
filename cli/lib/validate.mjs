// Validation applied to every write (spec 6.2). The allowed values come from lib/core, which mirrors
// the CHECK constraints in the migration.
import {
  CHANNELS, DOCUMENT_KINDS, EVENT_KINDS, GAP_STATES, METRIC_STATUSES, PHASES, SLUG_RE, VERDICTS, WORK_MODES,
  isDateString, todayIn,
} from '../../lib/core/index.mjs';
import { invalid } from './output.mjs';

export const SALARY_PERIODS = Object.freeze(['year', 'month', 'day', 'hour']);
export const IMPORTANCES = Object.freeze(['required', 'nice']);
export const PROOF_KEY_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;
export const TOPIC_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)?)?$/;

/** The payload keys iv_upsert_application reads (migration section 8). */
export const PAYLOAD_KEYS = Object.freeze([
  'slug', 'job_id', 'company', 'company_website', 'company_create', 'role', 'team', 'location', 'country_code', 'work_mode',
  'url', 'channel', 'channel_detail', 'role_family', 'seniority', 'years_required', 'visa_needed', 'salary', 'posting',
  'phase', 'applied_on', 'cv_built_on', 'closes_on', 'cv_variant', 'next_action', 'notes', 'status_evidence', 'uncertain',
  'source', 'requirements', 'answers', 'proof_points', 'contacts', 'events', 'documents',
]);
/** Manifest-only keys, removed before the RPC call. */
export const MANIFEST_KEYS = Object.freeze(['files', '$schema', 'comment']);

export const isIsoTimestamp = (v) => typeof v === 'string' && ISO_TS_RE.test(v) && !Number.isNaN(new Date(v).getTime());

/** 'YYYY-MM-DD' (a real calendar date) or a usage error. */
export function checkDate(value, label) {
  if (!isDateString(value)) throw invalid(`${label} must be a date written YYYY-MM-DD, got ${JSON.stringify(value)}`);
  return value;
}

export function checkTimestamp(value, label) {
  if (!isIsoTimestamp(value)) throw invalid(`${label} must be an ISO timestamp (e.g. 2026-10-20T14:00:00+02:00), got ${JSON.stringify(value)}`);
  return value;
}

export function checkOneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw invalid(`${label} must be one of ${allowed.join(', ')}; got ${JSON.stringify(value)}`);
  return value;
}

export const checkPhase = (v, label = 'phase') => checkOneOf(v, PHASES, label);
export const checkKind = (v, label = 'kind') => checkOneOf(v, EVENT_KINDS, label);

export function checkSlug(v, label = 'slug') {
  if (typeof v !== 'string' || !SLUG_RE.test(v)) {
    throw invalid(`${label} must match ^[a-z0-9][a-z0-9-]{1,80}$ (lowercase letters, digits and dashes); got ${JSON.stringify(v)}`);
  }
  return v;
}

/** Today in the user's time zone. */
export const today = (tz) => todayIn(tz);

/**
 * Validate an RPC payload (the manifest minus `files`). Returns a normalised copy plus warnings;
 * collects every problem before failing so the agent can fix them in one go.
 * @param {Record<string, any>} input
 * @param {{ today: string, requireCompanyRole?: boolean, fillAppliedOn?: boolean }} opts
 *   fillAppliedOn (default true): a sent phase without applied_on gets today. The history import
 *   passes false, because some rows were sent on a date nobody knows (the RPC keeps NULL then).
 * @returns {{ payload: Record<string, any>, warnings: string[] }}
 */
export function validatePayload(input, opts) {
  /** @type {string[]} */ const errors = [];
  /** @type {string[]} */ const warnings = [];
  const p = structuredClone(input);
  const err = (m) => errors.push(m);
  const has = (k) => Object.prototype.hasOwnProperty.call(p, k);
  const isStr = (v) => typeof v === 'string';
  const optStr = (k, obj = p, label = k) => {
    if (obj[k] !== undefined && obj[k] !== null && !isStr(obj[k])) err(`${label} must be text or null`);
  };
  const optDate = (k, obj = p, label = k) => {
    if (obj[k] !== undefined && obj[k] !== null && !isDateString(obj[k])) err(`${label} must be YYYY-MM-DD or null; got ${JSON.stringify(obj[k])}`);
  };
  const optEnum = (k, allowed, obj = p, label = k) => {
    if (obj[k] !== undefined && obj[k] !== null && !allowed.includes(obj[k])) err(`${label} must be one of ${allowed.join(', ')}; got ${JSON.stringify(obj[k])}`);
  };
  const optBool = (k, obj = p, label = k) => {
    if (obj[k] !== undefined && obj[k] !== null && typeof obj[k] !== 'boolean') err(`${label} must be true, false or null`);
  };
  const optInt = (k, obj = p, label = k, min = 0, max = 100000) => {
    const v = obj[k];
    if (v !== undefined && v !== null && !(Number.isInteger(v) && v >= min && v <= max)) err(`${label} must be a whole number${max < 100000 ? ` from ${min} to ${max}` : ''} or null`);
  };
  const list = (k) => {
    if (!has(k)) return null;
    if (!Array.isArray(p[k])) {
      err(`${k} must be a list`);
      return null;
    }
    return p[k];
  };

  for (const k of Object.keys(p)) {
    if (!PAYLOAD_KEYS.includes(k)) warnings.push(`unknown key "${k}" is ignored`);
  }

  if (!isStr(p.slug) || !SLUG_RE.test(p.slug)) err(`slug must match ^[a-z0-9][a-z0-9-]{1,80}$; got ${JSON.stringify(p.slug)}`);
  if (has('job_id') && !(Number.isInteger(p.job_id) && p.job_id > 0)) err('job_id must be a positive whole number');
  if (opts.requireCompanyRole) {
    if (!isStr(p.company) || !p.company.trim()) err('company is required');
    if (!isStr(p.role) || !p.role.trim()) err('role is required');
  } else {
    optStr('company');
    optStr('role');
  }
  for (const k of ['company_website', 'team', 'location', 'channel_detail', 'role_family', 'seniority', 'cv_variant', 'notes', 'status_evidence']) optStr(k);
  optBool('company_create');
  if (p.url !== undefined && p.url !== null && p.url !== '') {
    if (!isStr(p.url) || !/^https?:\/\/\S+$/i.test(p.url)) err(`url must start with http:// or https://; got ${JSON.stringify(p.url)}`);
  }
  if (p.country_code !== undefined && p.country_code !== null) {
    if (!isStr(p.country_code) || !/^[A-Za-z]{2}$/.test(p.country_code)) err(`country_code must be two letters (ISO 3166, e.g. NL, GB); got ${JSON.stringify(p.country_code)}`);
    else if (p.country_code !== p.country_code.toUpperCase()) p.country_code = p.country_code.toUpperCase();
  }
  optEnum('work_mode', WORK_MODES);
  optEnum('channel', CHANNELS);
  optEnum('source', ['web', 'cli', 'import']);
  optInt('years_required', p, 'years_required', 0, 60);
  optBool('visa_needed');
  if (p.phase !== undefined && p.phase !== null) optEnum('phase', PHASES);
  for (const k of ['applied_on', 'cv_built_on', 'closes_on']) optDate(k);
  if (p.role_family !== undefined && p.role_family !== null && isStr(p.role_family) && !TOPIC_RE.test(p.role_family)) {
    warnings.push(`role_family is usually lowercase snake_case (e.g. forward_deployed); got ${JSON.stringify(p.role_family)}`);
  }

  if (has('salary') && p.salary !== null) {
    if (typeof p.salary !== 'object' || Array.isArray(p.salary)) err('salary must be an object {text, min, max, currency, period}');
    else {
      optStr('text', p.salary, 'salary.text');
      for (const k of ['min', 'max']) {
        const v = p.salary[k];
        if (v !== undefined && v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) err(`salary.${k} must be a number or null`);
      }
      if (typeof p.salary.min === 'number' && typeof p.salary.max === 'number' && p.salary.min > p.salary.max) err('salary.min is larger than salary.max');
      if (p.salary.currency !== undefined && p.salary.currency !== null) {
        if (!isStr(p.salary.currency) || !/^[A-Za-z]{3}$/.test(p.salary.currency)) err('salary.currency must be a 3-letter code (EUR, USD, GBP) or null');
        else p.salary.currency = p.salary.currency.toUpperCase();
      }
      optEnum('period', SALARY_PERIODS, p.salary, 'salary.period');
      if ((p.salary.min != null || p.salary.max != null) && (!p.salary.currency || !p.salary.period)) warnings.push('salary has numbers but no currency or period; it will not be grouped in Insights');
    }
  } else if (has('salary') && p.salary === null) {
    p.salary = { text: null, min: null, max: null, currency: null, period: null };
  }
  if (has('posting') && p.posting !== null) {
    if (typeof p.posting !== 'object' || Array.isArray(p.posting)) err('posting must be an object {live, checked_at}');
    else {
      optBool('live', p.posting, 'posting.live');
      if (p.posting.checked_at != null && !isIsoTimestamp(p.posting.checked_at)) err('posting.checked_at must be an ISO timestamp or null');
    }
  } else if (has('posting') && p.posting === null) {
    p.posting = { live: null, checked_at: null };
  }
  if (has('next_action') && p.next_action !== null) {
    if (typeof p.next_action !== 'object' || Array.isArray(p.next_action)) err('next_action must be an object {text, due}');
    else {
      optStr('text', p.next_action, 'next_action.text');
      optDate('due', p.next_action, 'next_action.due');
      if (p.next_action.due && !p.next_action.text) err('next_action.due needs next_action.text');
    }
  } else if (has('next_action') && p.next_action === null) {
    p.next_action = { text: null, due: null };
  }
  if (has('uncertain')) {
    if (p.uncertain === null) p.uncertain = [];
    else if (!Array.isArray(p.uncertain) || p.uncertain.some((x) => !isStr(x))) err('uncertain must be a list of field names');
  }

  const reqs = list('requirements');
  reqs?.forEach((r, i) => {
    const at = `requirements[${i}]`;
    if (!r || typeof r !== 'object') return err(`${at} must be an object`);
    if (!isStr(r.requirement) || !r.requirement.trim()) err(`${at}.requirement is required`);
    if (!VERDICTS.includes(r.verdict)) err(`${at}.verdict must be one of ${VERDICTS.join(', ')}; got ${JSON.stringify(r.verdict)}`);
    optEnum('importance', IMPORTANCES, r, `${at}.importance`);
    optEnum('gap_state', GAP_STATES, r, `${at}.gap_state`);
    if (r.topic !== undefined && r.topic !== null && (!isStr(r.topic) || !TOPIC_RE.test(r.topic))) err(`${at}.topic must be lowercase snake_case (e.g. years_experience); got ${JSON.stringify(r.topic)}`);
    if (r.gap_state && r.verdict && !['gap', 'partial'].includes(r.verdict)) warnings.push(`${at}: gap_state only applies to gap or partial items; it is dropped`);
    if (r.verdict === 'gap' && !r.topic) warnings.push(`${at}: a gap without a topic is not counted in Insights (I6)`);
    for (const k of ['evidence', 'anchor_text', 'note']) optStr(k, r, `${at}.${k}`);
  });

  const pps = list('proof_points');
  const seenPp = new Set();
  pps?.forEach((pp, i) => {
    const at = `proof_points[${i}]`;
    if (!pp || typeof pp !== 'object') return err(`${at} must be an object`);
    if (!isStr(pp.key) || !PROOF_KEY_RE.test(pp.key)) err(`${at}.key must match ^[a-z0-9][a-z0-9-]{1,60}$; got ${JSON.stringify(pp.key)}`);
    else if (seenPp.has(pp.key)) err(`${at}.key "${pp.key}" appears twice`);
    else seenPp.add(pp.key);
    optEnum('metric_status', METRIC_STATUSES, pp, `${at}.metric_status`);
    if (pp.facts !== undefined && (typeof pp.facts !== 'object' || pp.facts === null || Array.isArray(pp.facts))) err(`${at}.facts must be an object`);
    for (const k of ['detail', 'name', 'summary', 'metric', 'caveat', 'link']) optStr(k, pp, `${at}.${k}`);
  });

  const answers = list('answers');
  const seenQ = new Set();
  answers?.forEach((a, i) => {
    const at = `answers[${i}]`;
    if (!a || typeof a !== 'object') return err(`${at} must be an object`);
    if (!isStr(a.question) || !a.question.trim()) err(`${at}.question is required`);
    else if (seenQ.has(a.question.trim().toLowerCase())) err(`${at}: the question "${a.question}" appears twice`);
    else seenQ.add(a.question.trim().toLowerCase());
    optStr('answer', a, `${at}.answer`);
    optStr('source_path', a, `${at}.source_path`);
    optInt('char_limit', a, `${at}.char_limit`, 1, 100000);
    optBool('submitted', a, `${at}.submitted`);
    if (isStr(a.answer) && Number.isInteger(a.char_limit) && a.answer.length > a.char_limit) {
      warnings.push(`${at}: the answer is ${a.answer.length} characters, over the ${a.char_limit} limit`);
    }
  });

  const contacts = list('contacts');
  contacts?.forEach((c, i) => {
    const at = `contacts[${i}]`;
    if (!c || typeof c !== 'object') return err(`${at} must be an object`);
    if (!isStr(c.name) || !c.name.trim()) err(`${at}.name is required`);
    for (const k of ['role', 'email', 'linkedin_url', 'notes']) optStr(k, c, `${at}.${k}`);
  });

  const events = list('events');
  events?.forEach((e, i) => {
    const at = `events[${i}]`;
    if (!e || typeof e !== 'object') return err(`${at} must be an object`);
    if (!EVENT_KINDS.includes(e.kind)) err(`${at}.kind must be one of ${EVENT_KINDS.join(', ')}; got ${JSON.stringify(e.kind)}`);
    if (!isDateString(e.on)) err(`${at}.on is required, written YYYY-MM-DD; got ${JSON.stringify(e.on)}`);
    if (e.at != null && !isIsoTimestamp(e.at)) err(`${at}.at must be an ISO timestamp`);
    optEnum('to_phase', PHASES, e, `${at}.to_phase`);
    optBool('date_uncertain', e, `${at}.date_uncertain`);
    for (const k of ['title', 'body']) optStr(k, e, `${at}.${k}`);
  });

  const docs = list('documents');
  docs?.forEach((d, i) => {
    const at = `documents[${i}]`;
    if (!d || typeof d !== 'object') return err(`${at} must be an object`);
    if (!DOCUMENT_KINDS.includes(d.kind)) err(`${at}.kind must be one of ${DOCUMENT_KINDS.join(', ')}`);
    if (!d.storage_path && !d.content) err(`${at} needs storage_path or content`);
  });

  // a sent phase needs a sent date: fill in today and say so
  if (opts.fillAppliedOn !== false && p.phase && !['draft', 'skipped'].includes(p.phase) && PHASES.includes(p.phase) && (p.applied_on === undefined || p.applied_on === null)) {
    p.applied_on = opts.today;
    warnings.push(`phase is ${p.phase} but applied_on is empty: set applied_on to today (${opts.today}). Fix it if it was sent on another day.`);
  }
  if (p.applied_on && p.applied_on > opts.today) warnings.push(`applied_on ${p.applied_on} is in the future`);
  if (p.phase === 'draft' && p.applied_on) warnings.push('phase is draft but applied_on is set; drafts are usually unsent');

  if (errors.length) {
    throw invalid(errors.length === 1 ? errors[0] : `${errors.length} problems in the payload:\n  - ${errors.join('\n  - ')}`, 'Fix the manifest and run again.', { errors });
  }
  return { payload: p, warnings };
}

/** Parse repeated `k=v` flags (`k:=json` parses JSON; a numeric v becomes a number; `k=` removes k). */
export function parseFacts(list = []) {
  /** @type {Record<string, any>} */ const set = {};
  /** @type {string[]} */ const unset = [];
  for (const item of list) {
    const m = String(item).match(/^([A-Za-z0-9_.-]+)(:?=)(.*)$/s);
    if (!m) throw invalid(`--fact expects key=value (or key:=json); got ${JSON.stringify(item)}`);
    const [, k, op, raw] = m;
    if (op === ':=') {
      try {
        set[k] = JSON.parse(raw);
      } catch {
        throw invalid(`--fact ${k}:= is not valid JSON: ${raw}`);
      }
    } else if (raw === '') unset.push(k);
    else set[k] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  }
  return { set, unset };
}

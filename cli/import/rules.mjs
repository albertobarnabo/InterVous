// The history import's mapping rules (spec 7.3): one history.json record -> one manifest for
// prepareApplication() (the iv_upsert_application payload plus `files`).
//
// Rule code only: the data that needs judgement (which live row each slug adopts, proof-point
// names and true numbers, gap topics, cautions, next actions, JD files) lives in the map files next
// to adopt.json, outside this repo, because it is personal data (spec 7.1).
import fs from 'node:fs';
import path from 'node:path';
import { GAP_STATES, PHASES, WORK_MODES, isDateString, toDateOnly } from '../../lib/core/index.mjs';
import { invalid } from '../lib/output.mjs';
import { jdSnapshotDocument } from './jd.mjs';

// ---------------------------------------------------------------------------
// inputs
// ---------------------------------------------------------------------------

function readJsonFile(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw invalid(`No such ${what}: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw invalid(`${file} is not valid JSON: ${/** @type {Error} */ (e).message}`);
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * history.json: {applications: [...]}, every record with a unique slug in `id`.
 * @param {string} file absolute path
 */
export function loadHistory(file) {
  const h = readJsonFile(file, 'history file');
  const apps = Array.isArray(h) ? h : h?.applications;
  if (!Array.isArray(apps) || !apps.length) throw invalid(`${file} has no applications[]`);
  const seen = new Set();
  for (const [i, a] of apps.entries()) {
    if (!isObj(a) || typeof a.id !== 'string' || !a.id) throw invalid(`${file}: applications[${i}] has no id (the slug)`);
    if (seen.has(a.id)) throw invalid(`${file}: the slug ${a.id} appears twice`);
    seen.add(a.id);
  }
  return { file, dir: path.dirname(file), applications: apps, generatedAt: h?.generated_at ?? null };
}

const compile = (patterns, where) => (patterns ?? []).map((p) => {
  try {
    return new RegExp(p, 'i');
  } catch (e) {
    throw invalid(`${where}: bad pattern ${JSON.stringify(p)}: ${/** @type {Error} */ (e).message}`);
  }
});

/** lowercase, trimmed, spaces collapsed: how proof-point names are looked up */
export const normName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * adopt.json and the maps next to it: proof_aliases.json, gap_topics.json, overrides.json.
 * @param {string} adoptFile absolute path
 */
export function loadMaps(adoptFile) {
  const dir = path.dirname(adoptFile);
  const adoptJson = readJsonFile(adoptFile, 'adopt map');
  const adoptRaw = isObj(adoptJson?.adopt) ? adoptJson.adopt : adoptJson;
  /** @type {Map<string, number | null>} */ const adopt = new Map();
  for (const [slug, id] of Object.entries(adoptRaw ?? {})) {
    if (slug.startsWith('_') || slug === 'leave_alone') continue;
    if (id !== null && !(Number.isInteger(id) && id > 0)) throw invalid(`adopt.json: ${slug} must map to a jobs.id or null (create), got ${JSON.stringify(id)}`);
    adopt.set(slug, id);
  }
  const leaveAlone = Array.isArray(adoptJson?.leave_alone) ? adoptJson.leave_alone : [];
  if (leaveAlone.some((x) => !Number.isInteger(x))) throw invalid('adopt.json: leave_alone must list jobs ids');

  const pa = readJsonFile(path.join(dir, 'proof_aliases.json'), 'proof_aliases.json (next to adopt.json)');
  if (!isObj(pa?.aliases) || !isObj(pa?.proof_points)) throw invalid('proof_aliases.json needs {aliases: {...}, proof_points: {...}}');
  /** @type {Map<string, Array<{ key: string, detail?: string, prefix?: string }>>} */ const aliases = new Map();
  for (const [name, v] of Object.entries(pa.aliases)) {
    const list = (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'string' ? { key: x } : x));
    for (const x of list) {
      if (!isObj(x) || typeof x.key !== 'string') throw invalid(`proof_aliases.json: alias ${JSON.stringify(name)} must be a key, a list of keys or {key, detail|prefix}`);
      if (!pa.proof_points[x.key]) throw invalid(`proof_aliases.json: alias ${JSON.stringify(name)} points to ${x.key}, which has no entry in proof_points`);
    }
    aliases.set(normName(name), list);
  }

  const gt = readJsonFile(path.join(dir, 'gap_topics.json'), 'gap_topics.json (next to adopt.json)');
  const topics = (gt?.topics ?? []).map((t, i) => {
    if (!isObj(t) || typeof t.topic !== 'string') throw invalid(`gap_topics.json: topics[${i}] needs {topic, patterns}`);
    return { topic: t.topic, res: compile(t.patterns, `gap_topics.json topics[${i}]`) };
  });
  const gapStates = (gt?.gap_states ?? []).map((g, i) => {
    if (!isObj(g) || !GAP_STATES.includes(g.gap_state)) throw invalid(`gap_topics.json: gap_states[${i}].gap_state must be one of ${GAP_STATES.join(', ')}`);
    return { gap_state: g.gap_state, res: compile(g.patterns, `gap_topics.json gap_states[${i}]`) };
  });

  const ov = readJsonFile(path.join(dir, 'overrides.json'), 'overrides.json (next to adopt.json)');
  const overrides = isObj(ov?.applications) ? ov.applications : {};
  const jdSnapshots = isObj(ov?.jd_snapshots) ? ov.jd_snapshots : {};
  const cvRoot = path.resolve(dir, typeof ov?.cv_root === 'string' ? ov.cv_root : '..');
  return { dir, adoptFile, adopt, leaveAlone, aliases, proofPoints: pa.proof_points, topics, gapStates, overrides, jdSnapshots, cvRoot };
}

// ---------------------------------------------------------------------------
// small rules
// ---------------------------------------------------------------------------

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').replace(/[.;,]+$/, '').trim();

const COUNTRIES = {
  us: 'US', usa: 'US', 'united states': 'US',
  uk: 'GB', gb: 'GB', 'united kingdom': 'GB', england: 'GB',
  it: 'IT', italy: 'IT', de: 'DE', germany: 'DE', nl: 'NL', netherlands: 'NL', 'the netherlands': 'NL',
  fr: 'FR', france: 'FR', es: 'ES', spain: 'ES', ch: 'CH', switzerland: 'CH', ie: 'IE', ireland: 'IE',
};

/**
 * "San Francisco, US" -> US; "London, UK" -> GB; "Remote…" -> work_mode remote, no country.
 * @returns {{ country_code: string | null, work_mode: string | null, warning?: string }}
 */
export function placeOf(location, workMode) {
  const loc = String(location ?? '').trim();
  const mode = workMode && WORK_MODES.includes(workMode) ? workMode : null;
  if (/^remote\b/i.test(loc)) return { country_code: null, work_mode: 'remote' };
  const suffix = loc.split(',').pop()?.trim().toLowerCase() ?? '';
  const cc = COUNTRIES[suffix] ?? null;
  return { country_code: cc, work_mode: mode, ...(cc || !loc ? {} : { warning: `no country for location "${loc}"` }) };
}

/**
 * "company ATS (Ashby)" -> ats / Ashby; "ECB portal" -> portal; "recruiter" -> recruiter;
 * "internal referral" -> referral; "LinkedIn (applied on Meta careers site)" -> linkedin / Meta careers.
 * @returns {{ channel: string, channel_detail: string | null, warning?: string }}
 */
export function channelOf(raw) {
  const s = String(raw ?? '').trim();
  let m;
  if ((m = /^company ATS(?:\s*\((.+)\))?$/i.exec(s))) return { channel: 'ats', channel_detail: m[1]?.trim() ?? null };
  if ((m = /^(.*)\bportal\b/i.exec(s))) return { channel: 'portal', channel_detail: s };
  if (/^recruiter\b/i.test(s)) return { channel: 'recruiter', channel_detail: null };
  if (/referral/i.test(s)) return { channel: 'referral', channel_detail: /^referral$/i.test(s) ? null : s };
  if ((m = /^LinkedIn(?:\s*\((.+)\))?$/i.exec(s))) {
    const inner = m[1]?.trim();
    const site = inner ? (/^applied on (?:the )?(.+?)(?: site)?$/i.exec(inner)?.[1] ?? inner) : null;
    return { channel: 'linkedin', channel_detail: site };
  }
  if (/e-?mail/i.test(s)) return { channel: 'email', channel_detail: null };
  return { channel: 'other', channel_detail: s || null, warning: `unknown channel "${s}" stored as other` };
}

const PHASE_OF_STATUS = { applied: 'applied', interviewing: 'interviewing', draft: 'draft', not_applied: 'skipped' };

export function phaseOf(status) {
  const s = String(status ?? '').trim().toLowerCase();
  const p = PHASE_OF_STATUS[/** @type {keyof typeof PHASE_OF_STATUS} */ (s)] ?? (/** @type {readonly string[]} */ (PHASES).includes(s) ? s : null);
  if (!p) throw invalid(`unknown history status ${JSON.stringify(status)}`);
  return p;
}

const UNCERTAIN_RENAME = { status: 'phase', date_applied: 'applied_on', date_cv_built: 'cv_built_on' };
export const renameUncertain = (list) => [...new Set((list ?? []).map((f) => UNCERTAIN_RENAME[/** @type {keyof typeof UNCERTAIN_RENAME} */ (f)] ?? f))];

const ROLE_FAMILY = { forward_deployed_customer_facing: 'forward_deployed' };
export const roleFamilyOf = (f) => (f ? ROLE_FAMILY[/** @type {keyof typeof ROLE_FAMILY} */ (f)] ?? f : null);

/** "Name (detail)" -> {name, paren}; only a trailing, un-nested parenthesis is split off. */
export function splitParen(text) {
  const t = String(text ?? '').trim();
  const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(t);
  return m ? { name: m[1].trim(), paren: m[2].trim() } : { name: t, paren: null };
}

const NICE_PREFIX = /^(preferred|nice|bonus|desirable|stand out)\s*:\s*/i;

/** "agent behaviours on real coding tasks (lazy-cat, tare)" -> met item with evidence; "preferred: …" -> importance nice. */
export function metItem(text) {
  let t = String(text ?? '').trim();
  let importance = null;
  if (NICE_PREFIX.test(t)) {
    importance = 'nice';
    t = t.replace(NICE_PREFIX, '');
  }
  const { name, paren } = splitParen(t);
  return { requirement: name, verdict: 'met', ...(importance ? { importance } : {}), ...(paren ? { evidence: paren } : {}) };
}

export function topicFor(text, topics) {
  for (const t of topics) if (t.res.some((re) => re.test(text))) return t.topic;
  return 'other';
}

function gapStateFor(text, gapStates) {
  for (const g of gapStates) if (g.res.some((re) => re.test(text))) return g.gap_state;
  return null;
}

/**
 * gaps[] -> gap items: split on ";", and "NOT claimed: a, b" gives one not_claimed gap per technology.
 * @returns {Array<{ requirement: string, fromNotClaimedList?: boolean }>}
 */
export function splitGaps(entries) {
  const out = [];
  for (const entry of entries ?? []) {
    for (const part of String(entry).split(';')) {
      const t = clean(part);
      if (!t) continue;
      const m = /^NOT claimed\s*:\s*(.+)$/i.exec(t);
      if (m) {
        for (const tech of m[1].split(',')) {
          const x = clean(tech);
          if (x) out.push({ requirement: x, fromNotClaimedList: true });
        }
      } else out.push({ requirement: cap(t) });
    }
  }
  return out;
}

/** "(1600 chars)", "(max ~1,195-1,200 chars)" -> the largest number before "chars". */
export function charLimitOf(question) {
  const m = /([\d,]+)(?:\s*[-–]\s*([\d,]+))?\s*chars?\b/i.exec(String(question ?? ''));
  if (!m) return null;
  const nums = [m[1], m[2]].filter(Boolean).map((x) => Number(x.replace(/,/g, '')));
  const n = Math.max(...nums);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Event text rules, tried in order (spec 7.3). "not applied" is guarded so it never becomes an applied event.
 * @type {Array<[RegExp, string]>}
 */
const EVENT_RULES = [
  [/invitation|invite|webex/i, 'interview_scheduled'],
  [/no longer|404|taken down/i, 'posting_closed'],
  [/closing date|deadline/i, 'closes'],
  [/\bnot applied\b/i, 'note'],
  [/submitted|\bapplied\b/i, 'applied'],
  [/built/i, 'cv_built'],
  [/submission attempted/i, 'attempt'],
];

export function eventKindOf(text) {
  for (const [re, kind] of EVENT_RULES) if (re.test(text)) return kind;
  return 'note';
}

/**
 * history events (+ the synthetic cv_built / applied ones) -> payload events, closes_on, and
 * fields that become uncertain ("submission attempted").
 */
export function eventsOf(rec, { cvBuiltOn, appliedOn, uncertain }) {
  /** @type {Array<Record<string, any>>} */ const events = [];
  /** @type {string | null} */ let closesOn = null;
  const addUncertain = new Set();
  const warnings = [];
  for (const e of rec.events ?? []) {
    if (!isDateString(e?.date)) {
      warnings.push(`event without a valid date skipped: ${JSON.stringify(e)}`);
      continue;
    }
    for (const part of String(e.event ?? '').split(';')) {
      const title = cap(clean(part));
      if (!title) continue;
      const kind = eventKindOf(title);
      if (kind === 'closes') {
        closesOn = closesOn && closesOn > e.date ? closesOn : e.date;
        continue;
      }
      if (kind === 'attempt') addUncertain.add('phase');
      const k = kind === 'attempt' ? 'note' : kind;
      const dateUncertain = (k === 'applied' && uncertain.has('applied_on')) || (k === 'cv_built' && uncertain.has('cv_built_on'));
      events.push({ kind: k, on: e.date, title, ...(dateUncertain ? { date_uncertain: true } : {}) });
    }
  }
  const has = (kind, on) => events.some((x) => x.kind === kind && x.on === on);
  if (cvBuiltOn && !has('cv_built', cvBuiltOn)) {
    events.push({ kind: 'cv_built', on: cvBuiltOn, title: 'CV variant built', ...(uncertain.has('cv_built_on') ? { date_uncertain: true } : {}) });
  }
  if (appliedOn && !has('applied', appliedOn)) {
    events.push({ kind: 'applied', on: appliedOn, title: 'Sent', ...(uncertain.has('applied_on') ? { date_uncertain: true } : {}) });
  }
  // chronological, stable within a day
  const sorted = events.map((x, i) => ({ x, i })).sort((a, b) => a.x.on.localeCompare(b.x.on) || a.i - b.i).map(({ x }) => x);
  return { events: sorted, closesOn, addUncertain, warnings };
}

// ---------------------------------------------------------------------------
// one record -> one manifest
// ---------------------------------------------------------------------------

/** The canonical proof_points columns of one key (name, summary, metric, facts, metric_status, caveat, link). */
function canonical(maps, key) {
  const c = maps.proofPoints[key] ?? {};
  /** @type {Record<string, any>} */ const out = {};
  for (const k of ['name', 'summary', 'metric', 'facts', 'metric_status', 'caveat', 'link']) if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  return out;
}

function proofPointsOf(rec, maps, ov, warnings) {
  /** @type {Array<Record<string, any>>} */ const out = [];
  const unknown = [];
  for (const entry of rec.proof_points_used ?? []) {
    const { name, paren } = splitParen(entry);
    const hits = maps.aliases.get(normName(entry)) ?? maps.aliases.get(normName(name));
    if (!hits) {
      unknown.push(entry);
      continue;
    }
    const exact = maps.aliases.has(normName(entry));
    for (const h of hits) {
      let detail = h.detail ?? (exact && !h.prefix ? null : paren);
      if (h.prefix) detail = [h.prefix, exact ? null : paren].filter(Boolean).join(', ') || null;
      if (ov.proof_point_details?.[h.key] !== undefined) detail = ov.proof_point_details[h.key];
      const dup = out.find((x) => x.key === h.key);
      if (dup) {
        if (detail && dup.detail !== detail) dup.detail = [dup.detail, detail].filter(Boolean).join('; ');
        warnings.push(`proof point ${h.key} is named twice ("${entry}"); the wordings were joined`);
        continue;
      }
      out.push({ key: h.key, detail: detail ?? null, ...canonical(maps, h.key) });
    }
  }
  if (unknown.length) {
    throw invalid(`${rec.id}: proof points with no alias: ${unknown.map((u) => JSON.stringify(u)).join(', ')}`, `Add them to ${path.join(maps.dir, 'proof_aliases.json')} (aliases -> key).`);
  }
  return out;
}

function answersOf(rec) {
  return (rec.answers ?? []).map((a) => {
    const question = String(a.question ?? '').trim();
    const where = String(a.where ?? '').trim();
    const charLimit = charLimitOf(question);
    const file = /(\/[^\s;,'"()]+\.(?:md|markdown|txt))/.exec(where)?.[1] ?? null;
    let isFile = false;
    try {
      isFile = Boolean(file) && fs.statSync(/** @type {string} */ (file)).isFile();
    } catch {
      isFile = false;
    }
    const base = { ...(charLimit ? { char_limit: charLimit } : {}) };
    if (isFile) {
      const skeleton = /^skeleton\b/i.test(where);
      return {
        question: skeleton ? `${question} (skeleton only; the text he submitted was not saved)` : question,
        file, source_path: file, ...base, ...(skeleton ? { submitted: false } : {}),
      };
    }
    return { question, answer: null, source_path: where || null, ...base };
  });
}

function gapItemsOf(rec, maps, ov) {
  const explicit = Array.isArray(ov.gaps);
  const raw = explicit ? ov.gaps.map((g) => ({ ...g })) : splitGaps(rec.gaps);
  return raw.map((g) => {
    const text = `${g.requirement} ${g.note ?? ''}`;
    const topic = g.topic ?? topicFor(g.requirement, maps.topics);
    let gapState = g.gap_state ?? gapStateFor(text, maps.gapStates) ?? (g.fromNotClaimedList ? 'not_claimed' : null);
    let note = g.note ?? null;
    const byTopic = ov.gap_states?.[topic];
    if (byTopic) {
      gapState = byTopic.gap_state ?? gapState;
      note = byTopic.note ?? note;
    }
    /** @type {Record<string, any>} */ const item = { requirement: g.requirement, verdict: 'gap', topic };
    if (g.importance) item.importance = g.importance;
    // "open" is the default: leaving it out lets the RPC keep a state edited on the web
    if (gapState && gapState !== 'open') item.gap_state = gapState;
    else if (g.gap_state === 'open') item.gap_state = 'open';
    if (g.anchor_text) item.anchor_text = g.anchor_text;
    if (note) item.note = note;
    return item;
  });
}

function mtimeDate(file, timeZone) {
  try {
    return toDateOnly(fs.statSync(file).mtime, timeZone);
  } catch {
    return null;
  }
}

const exists = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/**
 * One history record -> a manifest (RPC payload + files) for prepareApplication().
 * @param {Record<string, any>} rec  a history.json application
 * @param {ReturnType<typeof loadMaps>} maps
 * @param {{ jobId?: number | null, liveCompany?: string | null, timeZone?: string }} [opts]
 * @returns {{ manifest: Record<string, any>, warnings: string[] }}
 */
export function buildManifest(rec, maps, opts = {}) {
  const warnings = [];
  const ov = maps.overrides[rec.id] ?? {};
  const tz = opts.timeZone ?? 'Europe/Berlin';
  const phase = phaseOf(rec.status);
  // an override of `uncertain` (a fact confirmed since) also decides which event dates are unsure
  const confirmed = isObj(ov.set) && Object.prototype.hasOwnProperty.call(ov.set, 'uncertain');
  const uncertain = new Set(confirmed ? ov.set.uncertain : renameUncertain(rec.uncertain));
  const appliedOn = rec.date_applied ?? null;
  const cvBuiltOn = rec.date_cv_built ?? null;
  const place = placeOf(rec.location, rec.work_mode);
  if (place.warning) warnings.push(place.warning);
  const ch = channelOf(rec.channel);
  if (ch.warning) warnings.push(ch.warning);

  const ev = eventsOf(rec, { cvBuiltOn, appliedOn, uncertain });
  warnings.push(...ev.warnings);
  for (const f of ev.addUncertain) uncertain.add(f);

  let company = rec.company;
  if (ov.keep_live_company && opts.liveCompany) {
    if (String(opts.liveCompany).trim().toLowerCase() !== String(rec.company ?? '').trim().toLowerCase()) {
      warnings.push(`company kept as the live name "${opts.liveCompany}" (history says "${rec.company}")`);
    }
    company = opts.liveCompany;
  }

  /** @type {Record<string, any>} */
  const m = {
    slug: rec.id,
    ...(opts.jobId ? { job_id: opts.jobId } : {}),
    company,
    role: rec.role,
    team: rec.team ?? null,
    location: rec.location ?? null,
    url: rec.url ?? null,
    country_code: place.country_code,
    work_mode: place.work_mode,
    channel: ch.channel,
    channel_detail: ch.channel_detail,
    role_family: roleFamilyOf(rec.role_family),
    seniority: rec.seniority_asked ?? null,
    years_required: rec.years_required ?? null,
    visa_needed: rec.visa_needed ?? null,
    salary: { text: rec.salary ?? null, min: null, max: null, currency: null, period: null, ...(ov.salary ?? {}) },
    posting: rec.posting_check ? { live: rec.posting_check.live ?? null, checked_at: rec.posting_check.date ? `${rec.posting_check.date}T12:00:00Z` : null } : { live: null, checked_at: null },
    phase,
    applied_on: appliedOn, // always sent, null included: clears the dates the first import wrote on drafts
    cv_built_on: cvBuiltOn,
    closes_on: ev.closesOn,
    cv_variant: rec.cv_variant ?? null,
    notes: rec.notes ?? null,
    status_evidence: rec.status_evidence ?? null,
    uncertain: [...uncertain],
    source: 'import',
    requirements: [
      ...(rec.requirements_matched ?? []).map(metItem),
      ...gapItemsOf(rec, maps, ov),
      ...(ov.cautions ?? []).map((c) => ({ verdict: 'caution', ...c })),
    ],
    proof_points: proofPointsOf(rec, maps, ov, warnings),
    answers: answersOf(rec),
    contacts: (rec.contacts ?? []).map((c) => ({ name: c.name, ...(c.role ? { role: c.role } : {}), ...(c.email ? { email: c.email } : {}) })),
    events: ev.events,
  };

  // files: the CV PDF (rebuilt since, so not marked as the version sent) and its LaTeX source
  /** @type {Record<string, any>} */ const files = {};
  if (rec.cv_pdf_path) {
    if (exists(rec.cv_pdf_path)) {
      files.cv_pdf = { path: rec.cv_pdf_path, label: `Rebuilt ${mtimeDate(rec.cv_pdf_path, tz)}; may differ from what you sent`, submitted: null };
    } else warnings.push(`CV PDF not found: ${rec.cv_pdf_path}`);
  }
  if (rec.cv_variant) {
    const tex = path.join(maps.cvRoot, 'variants', `${rec.cv_variant}.tex`);
    if (exists(tex)) files.cv_source = { path: tex };
    else warnings.push(`LaTeX source not found: ${tex}`);
  }
  if (Object.keys(files).length) m.files = files;

  const jd = maps.jdSnapshots[rec.id];
  if (jd) m.documents = [jdSnapshotDocument({ file: path.resolve(maps.dir, jd.file), url: rec.url ?? null, captured_at: jd.captured_at, label: jd.label ?? null })];

  for (const [k, v] of Object.entries(ov.set ?? {})) if (k !== 'uncertain') m[k] = v;
  for (const [k, v] of Object.entries(ov.append ?? {})) m[k] = [m[k], v].filter(Boolean).join(' ');
  return { manifest: m, warnings };
}

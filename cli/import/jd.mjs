// JD snapshots for the history import (spec 7.3, `fetched/*.json` -> jd_snapshot).
//
// The fetched files are raw ATS answers saved on 2026-10-17: an Ashby job board ({jobs: [...]},
// descriptionHtml), a Greenhouse job ({id, content} with the HTML entity-escaped once) or the
// Apple jobs API ({res: {...}} with plain-text fields). The posting is the one whose id appears in
// the application's URL. The HTML becomes Markdown with turndown; the result is deterministic, so
// a re-run produces the same sha256 and the snapshot is not stored twice.
import crypto from 'node:crypto';
import fs from 'node:fs';
import TurndownService from 'turndown';
import { invalid } from '../lib/output.mjs';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
turndown.remove(['script', 'style']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

/** Undo one level of HTML entity escaping (Greenhouse sends `&lt;p&gt;`). */
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** No trailing spaces, no non-breaking spaces, at most one blank line in a row, one final newline. */
const tidy = (md) => `${String(md)
  .replace(/\u00a0/g, ' ')
  .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()}\n`;

/** HTML -> Markdown. */
export function htmlToMarkdown(html) {
  return tidy(turndown.turndown(String(html ?? ''))).trimEnd();
}

/** Plain-text lines -> a Markdown bullet list. */
const bullets = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join('\n');

/** Markdown for one posting of a fetched ATS file, or null when the file does not hold it. */
export function postingMarkdown(json, url) {
  const u = String(url ?? '');
  // Ashby board: {jobs: [{id, title, descriptionHtml, jobUrl, location}]}
  if (Array.isArray(json?.jobs)) {
    const job = json.jobs.find((j) => j?.id && u.includes(String(j.id)));
    if (!job) return null;
    const head = [`# ${String(job.title).trim()}`];
    const meta = [job.location, job.workplaceType, job.compensation?.compensationTierSummary].filter(Boolean).join(' · ');
    if (meta) head.push(meta);
    return { title: String(job.title).trim(), markdown: tidy(`${head.join('\n\n')}\n\n${htmlToMarkdown(job.descriptionHtml)}`), sourceId: String(job.id) };
  }
  // Greenhouse job: {id, title, content (escaped HTML), location: {name}}
  if (json && typeof json.content === 'string' && json.id !== undefined) {
    if (!u.includes(String(json.id))) return null;
    const head = [`# ${String(json.title).trim()}`];
    if (json.location?.name) head.push(String(json.location.name));
    return { title: String(json.title).trim(), markdown: tidy(`${head.join('\n\n')}\n\n${htmlToMarkdown(decodeEntities(json.content))}`), sourceId: String(json.id) };
  }
  // Apple jobs API: {res: {jobNumber, postingTitle, jobSummary, description, responsibilities, minimumQualifications, preferredQualifications}}
  const r = json?.res;
  if (r && typeof r === 'object' && (r.jobNumber || r.positionId)) {
    if (!u.includes(String(r.jobNumber ?? r.positionId))) return null;
    const parts = [`# ${String(r.postingTitle).trim()}`];
    const where = (r.locations ?? []).map((l) => [l.name, l.countryName].filter(Boolean).join(', ')).join('; ');
    if (where) parts.push(where);
    if (r.jobSummary) parts.push(String(r.jobSummary).trim());
    if (r.description) parts.push('## Description', String(r.description).trim());
    if (r.responsibilities) parts.push('## Responsibilities', bullets(r.responsibilities));
    if (r.minimumQualifications) parts.push('## Minimum Qualifications', bullets(r.minimumQualifications));
    if (r.preferredQualifications) parts.push('## Preferred Qualifications', bullets(r.preferredQualifications));
    return { title: String(r.postingTitle).trim(), markdown: tidy(parts.join('\n\n')), sourceId: String(r.jobNumber ?? r.positionId) };
  }
  return null;
}

/** Fetched files can be large (the OpenAI board is 14 MB): parse each one once per run. */
const cache = new Map();
function readJson(file) {
  if (!cache.has(file)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      throw invalid(`JD snapshot: no such file ${file}`, 'Check jd_snapshots in overrides.json; the paths resolve against the folder of adopt.json.');
    }
    try {
      cache.set(file, JSON.parse(text));
    } catch (e) {
      throw invalid(`JD snapshot: ${file} is not valid JSON: ${/** @type {Error} */ (e).message}`);
    }
  }
  return cache.get(file);
}

/**
 * The jd_snapshot document for an application (a documents[] entry stored inline), or throws when
 * the fetched file does not hold the posting.
 * @param {{ file: string, url: string | null, captured_at: string, label?: string | null }} spec  file is absolute
 */
export function jdSnapshotDocument(spec) {
  const posting = postingMarkdown(readJson(spec.file), spec.url);
  if (!posting) throw invalid(`JD snapshot: ${spec.file} has no posting matching ${spec.url ?? '(no URL)'}`);
  const content = posting.markdown;
  const buf = Buffer.from(content, 'utf8');
  return {
    kind: 'jd_snapshot',
    content,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    mime_type: 'text/markdown',
    size_bytes: buf.length,
    source_url: spec.url ?? null,
    captured_at: spec.captured_at,
    label: spec.label ?? null,
  };
}

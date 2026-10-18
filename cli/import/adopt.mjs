// Which live row each history record lands on (spec 7.2).
//
// adopt.json says it explicitly (slug -> jobs.id, or null to create). The dry run and the real run
// both re-derive the table from the live rows, in this order: a row that already has the slug
// (a re-run), else the same posting URL, else the exact company + role (case-insensitive), and
// refuse to run when the derived table and adopt.json disagree. A row adopt.json names that cannot
// be re-derived (rows 133 and 134 have no URL) is only a warning: the explicit id is the reason
// adopt.json exists.
import { normalizeUrl } from '../../lib/core/index.mjs';

const ci = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * @typedef {object} Adoption
 * @property {string} slug
 * @property {number | null} adopt      what adopt.json says (null = create)
 * @property {number | null} derived    what the live rows say
 * @property {'slug' | 'url' | 'company_role' | null} by
 * @property {number | null} id         the row this record writes to (null = a new row)
 * @property {'adopt' | 'update' | 'create'} action
 * @property {string | null} note
 */

/**
 * @param {Array<Record<string, any>>} records history applications
 * @param {Array<{ id: number, slug: string | null, company_name: string | null, role: string | null, url: string | null }>} rows  the user's live jobs rows
 * @param {{ adopt: Map<string, number | null>, leaveAlone: number[] }} maps
 * @returns {{ table: Adoption[], errors: string[], warnings: string[] }}
 */
export function deriveAdoption(records, rows, maps) {
  const errors = [];
  const warnings = [];
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const leave = new Set(maps.leaveAlone.map(Number));
  const slugs = new Set(records.map((r) => r.id));
  for (const s of maps.adopt.keys()) if (!slugs.has(s)) warnings.push(`adopt.json lists ${s}, which is not in the history file`);

  /** @type {Adoption[]} */ const table = [];
  for (const rec of records) {
    const slug = rec.id;
    const has = maps.adopt.has(slug);
    const adopt = has ? /** @type {number | null} */ (maps.adopt.get(slug)) : null;
    if (!has) errors.push(`${slug}: missing from adopt.json (map it to a jobs.id, or to null to create a new row)`);

    /** @type {number | null} */ let derived = null;
    /** @type {Adoption['by']} */ let by = null;
    const bySlug = rows.filter((r) => r.slug === slug);
    if (bySlug.length) {
      derived = Number(bySlug[0].id);
      by = 'slug';
    } else {
      const norm = normalizeUrl(rec.url);
      const byUrl = norm ? rows.filter((r) => normalizeUrl(r.url) === norm) : [];
      if (byUrl.length > 1) errors.push(`${slug}: ${byUrl.length} live rows have its URL (#${byUrl.map((r) => r.id).join(', #')}); resolve the duplicate first`);
      if (byUrl.length) {
        derived = Number(byUrl[0].id);
        by = 'url';
      } else {
        const byName = rows.filter((r) => ci(r.company_name) === ci(rec.company) && ci(r.role) === ci(rec.role));
        if (byName.length > 1) errors.push(`${slug}: ${byName.length} live rows have its company and role (#${byName.map((r) => r.id).join(', #')})`);
        if (byName.length) {
          derived = Number(byName[0].id);
          by = 'company_role';
        }
      }
    }
    const target = byId.get(Number(derived));
    if (derived !== null && target?.slug && target.slug !== slug) {
      errors.push(`${slug}: the live row #${derived} (matched by ${by === 'url' ? 'URL' : 'company and role'}) already belongs to ${target.slug}`);
    }

    /** @type {number | null} */ let id = null;
    let note = null;
    if (adopt !== null) {
      const row = byId.get(adopt);
      if (!row) errors.push(`${slug}: adopt.json maps it to #${adopt}, which is not one of your rows`);
      else if (row.slug && row.slug !== slug) errors.push(`${slug}: adopt.json maps it to #${adopt}, which already belongs to ${row.slug}`);
      if (derived !== null && derived !== adopt) errors.push(`${slug}: adopt.json says #${adopt}, the live rows say #${derived} (by ${by})`);
      if (derived === null && row) {
        note = `#${adopt} could not be re-derived (${rec.url ? 'no row has its URL' : 'no URL'}; live company/role "${row.company_name} / ${row.role}"); adopting it by the explicit id`;
        warnings.push(`${slug}: ${note}`);
      }
      id = adopt;
    } else if (has) {
      if (derived !== null && by !== 'slug') errors.push(`${slug}: adopt.json says create, but live row #${derived} matches it by ${by}; map it to that id`);
      id = by === 'slug' ? derived : null;
    }
    if (id !== null && leave.has(id)) errors.push(`${slug}: #${id} is a legacy row on the leave_alone list`);
    const action = id === null ? 'create' : by === 'slug' ? 'update' : 'adopt';
    table.push({ slug, adopt, derived, by, id, action, note });
  }
  const ids = table.filter((t) => t.id !== null).map((t) => t.id);
  for (const dup of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) {
    errors.push(`#${dup} is the target of ${table.filter((t) => t.id === dup).map((t) => t.slug).join(' and ')}`);
  }
  return { table, errors, warnings };
}

// Generic debugging commands from the first CLI, kept as they were (spec 6.1):
//   status, jobs, companies, db, storage, export
// They act through the same row-level security as the web app. `jobs add` now writes `phase`
// (the trigger keeps the legacy status/stage in step) instead of status:'Applied' / stage:''.
import fs from 'node:fs';
import { PHASES, todayIn } from '../../lib/core/index.mjs';
import { MIME_BY_EXT } from '../lib/files.mjs';
import { emitRead, fromSupabase, invalid, printKv, printTable, usage } from '../lib/output.mjs';
import path from 'node:path';

const TABLES = [
  'jobs', 'companies', 'company_info', 'company_tags', 'company_tag_map', 'profiles',
  'job_events', 'job_documents', 'job_answers', 'job_requirements', 'proof_points', 'job_proof_points', 'contacts', 'user_settings',
];

/** Errors here name raw tables/columns: a 42703 is a typo, not a missing migration. */
const mustRaw = (r, what) => {
  if (r.error) throw fromSupabase(r.error, what, { schemaHint: false });
  return r.data;
};

/** Raw output: JSON with --json (or piped), else a table / key-value block. */
function out(ctx, data) {
  emitRead(ctx, data, (d) => {
    if (Array.isArray(d)) return printTable(d);
    if (d && typeof d === 'object') return printKv(d);
    console.log(d);
  });
}

// "field=value" sets a string; "field:=value" parses value as JSON (numbers, booleans, null, arrays, objects).
function pairs(list = []) {
  /** @type {Record<string, any>} */ const obj = {};
  for (const item of list) {
    const m = String(item).match(/^([^:=]+)(:?=)(.*)$/s);
    if (!m) throw usage(`Expected field=value or field:=json, got "${item}"`);
    const [, k, op, raw] = m;
    if (op === ':=') {
      try {
        obj[k] = JSON.parse(raw);
      } catch {
        throw invalid(`Invalid JSON for ${k}: ${raw}`);
      }
    } else obj[k] = raw;
  }
  return obj;
}

function dataFlag(flags) {
  if (flags.file) {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (e) {
      throw invalid(`Cannot read JSON from ${flags.file}: ${/** @type {Error} */ (e).message}`);
    }
  }
  if (flags.data) {
    try {
      return JSON.parse(flags.data);
    } catch (e) {
      throw invalid(`--data is not valid JSON: ${/** @type {Error} */ (e).message}`);
    }
  }
  if (flags.set) return pairs(flags.set);
  throw usage('Provide --data <json>, --file <path> or --set field=value');
}

function applyWhere(q, where) {
  for (const [k, v] of Object.entries(pairs(where))) q = v === null ? q.is(k, null) : q.eq(k, v);
  return q;
}

const DATA_OPTS = { data: { type: 'string' }, file: { type: 'string' }, set: { type: 'string', multiple: true } };

// ---------------------------------------------------------------------------

export const status = {
  options: {},
  async run(ctx) {
    const s = await ctx.session();
    /** @type {Record<string, any>} */ const counts = { email: s.user.email };
    for (const t of TABLES) {
      // GET with limit 0: supabase-js reports a HEAD 404 (missing table) as success
      const { count, error } = await ctx.sb.from(t).select('*', { count: 'exact' }).limit(0);
      counts[t] = error ? `error: ${error.message}` : count;
    }
    out(ctx, counts);
  },
};

export const jobs = {
  options: {
    ...DATA_OPTS, phase: { type: 'string' }, status: { type: 'string' }, limit: { type: 'string' }, company: { type: 'string' }, role: { type: 'string' },
    location: { type: 'string' }, url: { type: 'string' }, date: { type: 'string' }, yes: { type: 'boolean' },
  },
  async run(ctx, pos, flags) {
    const [sub, id] = pos;
    const s = await ctx.session();
    const sb = ctx.sb;
    if (!sub || sub === 'list') {
      let q = sb.from('jobs').select('*').eq('user_id', s.user.id).order('applied_on', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
      if (flags.phase) q = q.eq('phase', flags.phase);
      if (flags.status) q = q.eq('status', flags.status);
      if (flags.limit) q = q.limit(Number(flags.limit));
      const data = mustRaw(await q, 'list jobs');
      return out(ctx, ctx.json ? data : data.map((j) => ({ id: j.id, slug: j.slug ?? '', sent: j.applied_on ?? '', company: j.company_name, role: j.role, phase: j.phase, status: j.status, stage: j.stage })));
    }
    if (sub === 'get') return out(ctx, mustRaw(await sb.from('jobs').select('*').eq('id', id).single(), `load job ${id}`));
    if (sub === 'add') {
      if (!flags.company || !flags.role) throw usage('jobs add needs --company and --role');
      const phase = flags.phase ?? 'applied';
      if (!PHASES.includes(phase)) throw usage(`--phase must be one of ${PHASES.join(', ')}`);
      const sent = !['draft', 'skipped'].includes(phase);
      const row = {
        user_id: s.user.id, company_name: flags.company, role: flags.role, location: flags.location ?? '', url: flags.url ?? '',
        phase, applied_on: sent ? (flags.date ?? todayIn()) : (flags.date ?? null), source: 'cli', ...pairs(flags.set),
      };
      return out(ctx, mustRaw(await sb.from('jobs').insert([row]).select().single(), 'add the job'));
    }
    if (sub === 'update') {
      if (!id) throw usage('jobs update <id> --set field=value');
      return out(ctx, mustRaw(await sb.from('jobs').update(dataFlag(flags)).eq('id', id).eq('user_id', s.user.id).select().single(), `update job ${id}`));
    }
    if (sub === 'delete') {
      if (!flags.yes) throw usage('Refusing to delete without --yes');
      mustRaw(await sb.from('jobs').delete().eq('id', id).eq('user_id', s.user.id), `delete job ${id}`);
      return out(ctx, { deleted: Number(id) });
    }
    throw usage(`Unknown jobs subcommand: ${sub}`);
  },
};

export const companies = {
  options: {},
  async run(ctx, pos) {
    const [sub, id] = pos;
    await ctx.session();
    if (!sub || sub === 'list') return out(ctx, mustRaw(await ctx.sb.from('companies').select('id, name, website').order('name'), 'list companies'));
    if (sub === 'get') return out(ctx, mustRaw(await ctx.sb.from('companies').select('*, company_info(*), company_tag_map(company_tags(name))').eq('id', id).single(), `load company ${id}`));
    throw usage(`Unknown companies subcommand: ${sub}`);
  },
};

export const db = {
  options: { ...DATA_OPTS, where: { type: 'string', multiple: true }, columns: { type: 'string' }, order: { type: 'string' }, limit: { type: 'string' }, yes: { type: 'boolean' } },
  async run(ctx, pos, flags) {
    const [sub, table] = pos;
    if (!sub || !table) throw usage('db <select|insert|update|delete> <table> ...');
    await ctx.session();
    const sb = ctx.sb;
    if (sub === 'select') {
      let q = sb.from(table).select(flags.columns ?? '*');
      q = applyWhere(q, flags.where);
      if (flags.order) {
        const [col, dir] = String(flags.order).split('.');
        q = q.order(col, { ascending: dir !== 'desc' });
      }
      if (flags.limit) q = q.limit(Number(flags.limit));
      return out(ctx, mustRaw(await q, `select from ${table}`));
    }
    if (sub === 'insert') {
      const rows = dataFlag(flags);
      return out(ctx, mustRaw(await sb.from(table).insert(Array.isArray(rows) ? rows : [rows]).select(), `insert into ${table}`));
    }
    if (sub === 'update') {
      if (!flags.where) throw usage('db update needs at least one --where');
      const q = applyWhere(sb.from(table).update(dataFlag(flags)), flags.where);
      return out(ctx, mustRaw(await q.select(), `update ${table}`));
    }
    if (sub === 'delete') {
      if (!flags.where) throw usage('db delete needs at least one --where');
      if (!flags.yes) throw usage('Refusing to delete without --yes');
      const q = applyWhere(sb.from(table).delete(), flags.where);
      return out(ctx, { deleted: mustRaw(await q.select(), `delete from ${table}`).length });
    }
    throw usage(`Unknown db subcommand: ${sub}`);
  },
};

export const storage = {
  options: { upsert: { type: 'boolean' }, expires: { type: 'string' }, yes: { type: 'boolean' } },
  async run(ctx, pos, flags) {
    const [sub, bucket, a, b] = pos;
    await ctx.session();
    const st = ctx.sb.storage;
    if (sub === 'buckets') return out(ctx, mustRaw(await st.listBuckets(), 'list buckets').map(({ id, public: pub }) => ({ id, public: pub })));
    if (!sub || !bucket) throw usage('storage <buckets|list|upload|download|url|remove> <bucket> ...');
    if (sub === 'list') {
      const data = mustRaw(await st.from(bucket).list(a ?? '', { limit: 1000 }), `list ${bucket}`);
      return out(ctx, data.map(({ name, metadata, updated_at }) => ({ name, size: metadata?.size ?? '', updated_at })));
    }
    if (sub === 'upload') {
      if (!a || !b) throw usage('storage upload <bucket> <local-file> <remote-path> [--upsert]');
      const contentType = MIME_BY_EXT[/** @type {keyof typeof MIME_BY_EXT} */ (path.extname(a).toLowerCase())] ?? 'application/octet-stream';
      return out(ctx, mustRaw(await st.from(bucket).upload(b, fs.readFileSync(a), { contentType, upsert: Boolean(flags.upsert) }), `upload ${b}`));
    }
    if (sub === 'download') {
      if (!a || !b) throw usage('storage download <bucket> <remote-path> <local-file>');
      const data = mustRaw(await st.from(bucket).download(a), `download ${a}`);
      fs.writeFileSync(b, Buffer.from(await data.arrayBuffer()));
      return out(ctx, { saved: b });
    }
    if (sub === 'url') return out(ctx, mustRaw(await st.from(bucket).createSignedUrl(a, Number(flags.expires ?? 3600)), `sign ${a}`));
    if (sub === 'remove') {
      if (!flags.yes) throw usage('Refusing to remove without --yes');
      return out(ctx, mustRaw(await st.from(bucket).remove([a]), `remove ${a}`));
    }
    throw usage(`Unknown storage subcommand: ${sub}`);
  },
};

export const exportAll = {
  options: { out: { type: 'string' } },
  async run(ctx, _pos, flags) {
    const s = await ctx.session();
    /** @type {Record<string, any>} */
    const dump = { exported_at: new Date().toISOString(), user: { id: s.user.id, email: s.user.email } };
    for (const t of TABLES) {
      const { data, error } = await ctx.sb.from(t).select('*');
      dump[t] = error ? { error: error.message } : data;
    }
    const text = JSON.stringify(dump, null, 2);
    if (flags.out) {
      fs.writeFileSync(flags.out, text, { mode: 0o600 });
      return console.log(`Wrote ${flags.out}`);
    }
    process.stdout.write(`${text}\n`);
  },
};

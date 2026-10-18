// A throwaway local Supabase for the CLI tests: Postgres (the same image as scripts/test-sql.sh),
// PostgREST, GoTrue and storage-api on a private docker network, behind a tiny in-process HTTP
// router that serves /rest/v1, /auth/v1 and /storage/v1 like the hosted gateway does.
// It never touches the live project or ~/.config/intervous.
//
//   node cli/test/stack.mjs up      start (or reuse) a stack, print its env, keep the router running
//   node cli/test/stack.mjs down    remove the containers of the kept stack
//
// Tests call startStack(): it reuses a stack started with `up` (state in the temp dir) when its
// containers are still running, else starts a fresh one that stop() removes again.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20261017120000_intervous_v2.sql');
const SETUP = path.join(ROOT, 'supabase/tests/setup.sql');
const STATE_FILE = path.join(os.tmpdir(), 'intervous-cli-test-stack.json');

const IMAGES = {
  db: process.env.IV_TEST_DB_IMAGE ?? 'public.ecr.aws/supabase/postgres:17.11.0.004',
  rest: process.env.IV_TEST_REST_IMAGE ?? 'public.ecr.aws/supabase/postgrest:v16.4',
  auth: process.env.IV_TEST_AUTH_IMAGE ?? 'public.ecr.aws/supabase/gotrue:v2.197.0',
  storage: process.env.IV_TEST_STORAGE_IMAGE ?? 'public.ecr.aws/supabase/storage-api:v1.79.36',
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** HS256 JWT, as Supabase signs its keys and sessions. */
export function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function docker(args, opts = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

export function dockerAvailable() {
  try {
    docker(['info', '--format', '{{.ServerVersion}}']);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function running(name) {
  try {
    return docker(['inspect', '-f', '{{.State.Running}}', name]) === 'true';
  } catch {
    return false;
  }
}

function hostPort(name, port) {
  // "127.0.0.1:55012" (one line per binding)
  const line = docker(['port', name, `${port}/tcp`]).split('\n')[0];
  return Number(line.split(':').pop());
}

async function waitFor(label, fn, timeoutMs = 120_000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await fn()) return;
    } catch (e) {
      last = e;
    }
    await sleep(500);
  }
  throw new Error(`${label} did not become ready${last ? `: ${last.message}` : ''}`);
}

function psql(container, user, sql, { file, vars = [] } = {}) {
  const input = file ? fs.readFileSync(file, 'utf8') : sql;
  return docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', ...vars], { input });
}

// ---------------------------------------------------------------------------
// the stack
// ---------------------------------------------------------------------------

async function startContainers() {
  const id = crypto.randomBytes(3).toString('hex');
  const net = `intervous-cli-test-${id}`;
  const names = { db: `${net}-db`, rest: `${net}-rest`, auth: `${net}-auth`, storage: `${net}-storage` };
  const secret = crypto.randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat: now, exp: now + 10 * 365 * 86400 }, secret);
  const serviceKey = signJwt({ role: 'service_role', iss: 'supabase', iat: now, exp: now + 10 * 365 * 86400 }, secret);
  const state = { id, net, names, secret, anonKey, serviceKey, ports: {} };

  docker(['network', 'create', net]);
  docker(['run', '-d', '--rm', '--name', names.db, '--network', net, '--network-alias', 'db', '-e', 'POSTGRES_PASSWORD=postgres', IMAGES.db]);
  await waitFor('postgres', () => {
    const logs = execFileSync('docker', ['logs', names.db], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/init process complete/.test(logs)) return false;
    docker(['exec', names.db, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-tAc', 'select 1']);
    return true;
  });
  // the service roles have no password in a bare image; the hosted project sets them
  psql(names.db, 'supabase_admin', ['authenticator', 'supabase_auth_admin', 'supabase_storage_admin']
    .map((r) => `alter role ${r} with password 'postgres';`).join('\n'));

  const jwtExp = process.env.IV_TEST_JWT_EXP ?? '3600';
  docker([
    'run', '-d', '--rm', '--name', names.auth, '--network', net, '-p', '127.0.0.1::9999',
    '-e', 'GOTRUE_API_HOST=0.0.0.0', '-e', 'GOTRUE_API_PORT=9999', '-e', 'API_EXTERNAL_URL=http://127.0.0.1',
    '-e', 'GOTRUE_DB_DRIVER=postgres', '-e', 'GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@db:5432/postgres',
    '-e', 'GOTRUE_SITE_URL=http://127.0.0.1', '-e', `GOTRUE_JWT_SECRET=${secret}`, '-e', `GOTRUE_JWT_EXP=${jwtExp}`,
    '-e', 'GOTRUE_JWT_AUD=authenticated', '-e', 'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated', '-e', 'GOTRUE_JWT_ADMIN_ROLES=service_role',
    '-e', 'GOTRUE_EXTERNAL_EMAIL_ENABLED=true', '-e', 'GOTRUE_MAILER_AUTOCONFIRM=true', '-e', 'GOTRUE_DISABLE_SIGNUP=false',
    '-e', 'GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true', '-e', 'GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=0',
    '-e', 'GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000', '-e', 'GOTRUE_LOG_LEVEL=warn',
    IMAGES.auth,
  ]);
  docker([
    'run', '-d', '--rm', '--name', names.storage, '--network', net, '-p', '127.0.0.1::5000',
    '-e', `ANON_KEY=${anonKey}`, '-e', `SERVICE_KEY=${serviceKey}`, '-e', `AUTH_JWT_SECRET=${secret}`, '-e', `PGRST_JWT_SECRET=${secret}`,
    '-e', 'DATABASE_URL=postgres://supabase_storage_admin:postgres@db:5432/postgres',
    '-e', 'FILE_SIZE_LIMIT=52428800', '-e', 'STORAGE_BACKEND=file', '-e', 'FILE_STORAGE_BACKEND_PATH=/tmp/storage',
    '-e', 'TENANT_ID=stub', '-e', 'REGION=local', '-e', 'GLOBAL_S3_BUCKET=stub', '-e', 'ENABLE_IMAGE_TRANSFORMATION=false',
    '-e', 'POSTGREST_URL=http://rest:3000',
    IMAGES.storage,
  ]);
  state.ports.auth = hostPort(names.auth, 9999);
  state.ports.storage = hostPort(names.storage, 5000);
  await waitFor('gotrue', async () => (await fetch(`http://127.0.0.1:${state.ports.auth}/health`)).ok);
  await waitFor('storage-api', async () => (await fetch(`http://127.0.0.1:${state.ports.storage}/status`)).ok);

  // the live schema, then the migration as postgres (like the SQL editor), twice (re-run safety)
  psql(names.db, 'supabase_admin', null, { file: SETUP });
  psql(names.db, 'postgres', null, { file: MIGRATION });
  psql(names.db, 'postgres', null, { file: MIGRATION });

  docker([
    'run', '-d', '--rm', '--name', names.rest, '--network', net, '--network-alias', 'rest', '-p', '127.0.0.1::3000',
    '-e', 'PGRST_DB_URI=postgres://authenticator:postgres@db:5432/postgres', '-e', 'PGRST_DB_SCHEMAS=public',
    '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', `PGRST_JWT_SECRET=${secret}`, '-e', 'PGRST_DB_USE_LEGACY_GUCS=false',
    IMAGES.rest,
  ]);
  state.ports.rest = hostPort(names.rest, 3000);
  await waitFor('postgrest', async () => {
    const r = await fetch(`http://127.0.0.1:${state.ports.rest}/job_overview?limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    return r.status === 200;
  });
  return state;
}

function startRouter(state, port = 0) {
  const routes = [
    ['/rest/v1', state.ports.rest],
    ['/auth/v1', state.ports.auth],
    ['/storage/v1', state.ports.storage],
  ];
  const server = http.createServer((req, res) => {
    const hit = routes.find(([p]) => req.url === p || req.url.startsWith(`${p}/`) || req.url.startsWith(`${p}?`));
    if (!hit) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: 'no route' }));
    }
    const [prefix, target] = hit;
    const upstream = http.request(
      { host: '127.0.0.1', port: target, method: req.method, path: req.url.slice(prefix.length) || '/', headers: { ...req.headers, host: `127.0.0.1:${target}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: e.message }));
    });
    req.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function removeContainers(state) {
  for (const n of Object.values(state.names)) {
    try {
      docker(['rm', '-f', n]);
    } catch {
      /* already gone */
    }
  }
  try {
    docker(['network', 'rm', state.net]);
  } catch {
    /* already gone */
  }
}

function keptState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Object.values(s.names).every(running)) return s;
  } catch {
    /* none */
  }
  return null;
}

/**
 * @returns {Promise<{url: string, anonKey: string, serviceKey: string, secret: string, dbContainer: string,
 *   sql: (q: string) => string, createUser: (email: string, password: string) => Promise<{id: string}>, stop: () => Promise<void>}>}
 */
export async function startStack() {
  let state = keptState();
  const reused = Boolean(state);
  if (!state) state = await startContainers();
  const server = await startRouter(state);
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    anonKey: state.anonKey,
    serviceKey: state.serviceKey,
    secret: state.secret,
    dbContainer: state.names.db,
    reused,
    sql: (q) => docker(['exec', '-i', state.names.db, 'psql', '-X', '-q', '-tA', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: q }),
    async createUser(email, password) {
      const r = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: state.serviceKey, Authorization: `Bearer ${state.serviceKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(`createUser: ${r.status} ${JSON.stringify(body)}`);
      return body;
    },
    async stop() {
      await new Promise((r) => server.close(r));
      if (!reused && !process.env.KEEP) removeContainers(state);
      else if (!reused) fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    },
  };
}

// ---------------------------------------------------------------------------
// manual use
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'down') {
    const s = (() => {
      try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      } catch {
        return null;
      }
    })();
    if (s) removeContainers(s);
    fs.rmSync(STATE_FILE, { force: true });
    console.log(s ? `removed ${s.net}` : 'no kept stack');
  } else if (cmd === 'up') {
    let state = keptState();
    if (!state) {
      state = await startContainers();
      fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    }
    const server = await startRouter(state, Number(process.env.PORT ?? 0));
    console.log(`INTERVOUS_URL=http://127.0.0.1:${server.address().port}`);
    console.log(`(anon key and secret are in ${STATE_FILE}; Ctrl-C stops the router, \`down\` removes the containers)`);
  } else {
    console.log('usage: node cli/test/stack.mjs up|down');
  }
}

// An in-memory stand-in for lib/data/client.ts. `state` holds the rows and the stored files; every
// write and every failure a test asks for goes through it, and `log` records the order of calls.
export const state = {
    uid: 'u1',
    tables: { jobs: [], job_documents: [] },
    /** Stored object paths. */
    objects: new Set(),
    /** Paths the storage policy silently refuses to remove. */
    refused: new Set(),
    /** Set to an Error message to make the matching call fail. */
    failDelete: null,
    failRead: null,
    failList: null,
    failRemove: null,
    log: [],
};

export function reset(tables = {}, objects = []) {
    state.tables = { jobs: [], job_documents: [], ...tables };
    state.objects = new Set(objects);
    state.refused = new Set();
    state.failDelete = state.failRead = state.failList = state.failRemove = null;
    state.log = [];
}

class Query {
    constructor(table) {
        this.table = table;
        this.op = 'select';
        this.filters = [];
    }
    select() {
        return this;
    }
    delete() {
        this.op = 'delete';
        return this;
    }
    in(column, values) {
        this.filters.push((row) => values.includes(row[column]));
        return this;
    }
    /** Only the one filter the app sends: phase.is.null,phase.in.(draft,skipped). */
    or(expression) {
        if (expression !== 'phase.is.null,phase.in.(draft,skipped)') throw new Error(`unexpected filter: ${expression}`);
        this.filters.push((row) => row.phase == null || row.phase === 'draft' || row.phase === 'skipped');
        return this;
    }
    then(resolve, reject) {
        return Promise.resolve().then(() => this.run()).then(resolve, reject);
    }
    run() {
        const rows = state.tables[this.table] ?? [];
        const hit = rows.filter((row) => this.filters.every((f) => f(row)));
        state.log.push(`${this.op} ${this.table}`);
        if (this.op === 'select') {
            if (state.failRead) return { data: null, error: { message: state.failRead } };
            return { data: hit, error: null };
        }
        if (state.failDelete) return { data: null, error: { message: state.failDelete } };
        state.tables[this.table] = rows.filter((row) => !hit.includes(row));
        // The cascade: documents go with their job.
        if (this.table === 'jobs') {
            const ids = hit.map((j) => j.id);
            state.tables.job_documents = state.tables.job_documents.filter((d) => !ids.includes(d.job_id));
        }
        return { data: hit, error: null };
    }
}

const bucket = {
    async list(prefix) {
        state.log.push(`list ${prefix}`);
        if (state.failList) return { data: null, error: { message: state.failList } };
        const seen = new Map();
        for (const name of state.objects) {
            if (!name.startsWith(`${prefix}/`)) continue;
            const [head, ...rest] = name.slice(prefix.length + 1).split('/');
            seen.set(head, rest.length ? { name: head, id: null } : { name: head, id: `id-${head}` });
        }
        return { data: [...seen.values()], error: null };
    },
    async remove(paths) {
        state.log.push(`remove ${paths.join(',')}`);
        if (state.failRemove) return { data: null, error: { message: state.failRemove } };
        const done = [...new Set(paths)].filter((p) => state.objects.has(p) && !state.refused.has(p));
        for (const p of done) state.objects.delete(p);
        return { data: done.map((name) => ({ name })), error: null };
    },
};

export const db = {
    from: (table) => new Query(table),
    storage: { from: () => bucket },
    auth: { getSession: async () => ({ data: { session: state.uid ? { user: { id: state.uid } } : null } }) },
};

export function toError(e) {
    return e instanceof Error ? e : new Error(e?.message ?? 'Something went wrong');
}

export function must(res) {
    if (res.error) throw toError(res.error);
    return res.data;
}

export const currentUserId = async () => state.uid;
export const likeLiteral = (s) => s;
export const fetchAll = async () => [];

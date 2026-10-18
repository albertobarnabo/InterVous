// Server-side fetch of a user-supplied URL, guarded against SSRF (docs/SPEC.md 8, WP10).
//
//   - http and https only, ports 80 and 443 only, no user:password@ in the URL
//   - the host is resolved first; if ANY of its addresses is private, loopback, link-local,
//     cloud metadata, multicast or otherwise reserved, the request is refused
//   - the connection is pinned to the address that was checked (no second DNS answer can
//     swap in an internal one between the check and the connect)
//   - at most 3 redirects, each one re-checked the same way
//   - the body is capped at 2 MB (compressed and decompressed), and the whole fetch at 10 s
//
// Node only (node:http, node:https, node:dns): import it from route handlers, never from the browser.
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { pipeline, Transform, type Readable } from 'node:stream';
import zlib from 'node:zlib';

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const TIMEOUT_MS = 10_000;

const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** A refused or failed fetch. `status` is the HTTP status the API route should answer with. */
export class FetchError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'FetchError';
        this.status = status;
    }
}

// ── address policy ──────────────────────────────────────────────────────────

const BLOCKED_V4: Array<[string, number]> = [
    ['0.0.0.0', 8], // "this network"
    ['10.0.0.0', 8], // private
    ['100.64.0.0', 10], // carrier-grade NAT (also Alibaba's metadata 100.100.100.200)
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local, incl. the cloud metadata address 169.254.169.254
    ['172.16.0.0', 12], // private
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.0.2.0', 24], // TEST-NET-1
    ['192.31.196.0', 24], // AS112
    ['192.52.193.0', 24], // AMT
    ['192.88.99.0', 24], // 6to4 relay
    ['192.168.0.0', 16], // private
    ['192.175.48.0', 24], // AS112
    ['198.18.0.0', 15], // benchmarking
    ['198.51.100.0', 24], // TEST-NET-2
    ['203.0.113.0', 24], // TEST-NET-3
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reserved, incl. 255.255.255.255
];

const BLOCKED_V6: Array<[string, number]> = [
    ['::', 96], // unspecified, loopback ::1, IPv4-compatible
    ['64:ff9b::', 96], // NAT64
    ['64:ff9b:1::', 48], // local-use NAT64
    ['100::', 64], // discard
    ['2001::', 23], // IETF protocol assignments (Teredo, ORCHID, ...)
    ['2001:db8::', 32], // documentation
    ['2002::', 16], // 6to4
    ['fc00::', 7], // unique local, incl. AWS metadata fd00:ec2::254
    ['fe80::', 10], // link-local
    ['fec0::', 10], // site-local (deprecated)
    ['ff00::', 8], // multicast
];

const blockList = new BlockList();
for (const [a, p] of BLOCKED_V4) blockList.addSubnet(a, p, 'ipv4');
for (const [a, p] of BLOCKED_V6) blockList.addSubnet(a, p, 'ipv6');

/** True when the address must never be fetched. IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked as IPv4. */
export function isBlockedAddress(address: string): boolean {
    const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
    const family = isIP(bare);
    if (family === 4) return blockList.check(bare, 'ipv4');
    if (family === 6) return blockList.check(bare, 'ipv6');
    return true; // not an IP at all: refuse
}

const BLOCKED_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/i;

/**
 * Checks the URL itself (no network): scheme, credentials, port, and host names that are internal
 * by definition. Returns the parsed URL.
 */
export function checkUrl(raw: string | URL): URL {
    let url: URL;
    try {
        url = typeof raw === 'string' ? new URL(raw) : raw;
    } catch {
        throw new FetchError('That is not a valid link.', 400);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new FetchError('Only http:// and https:// links can be read.', 400);
    }
    if (url.username || url.password) {
        throw new FetchError('Links with a user name or password in them cannot be read.', 400);
    }
    if (url.port && url.port !== '80' && url.port !== '443') {
        throw new FetchError('Only links on the standard web ports (80 and 443) can be read.', 400);
    }
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!host) throw new FetchError('That link has no host.', 400);
    if (isIP(host)) {
        if (isBlockedAddress(host)) throw blocked();
    } else if (!host.includes('.') || BLOCKED_NAME.test(host)) {
        throw blocked();
    }
    return url;
}

function blocked() {
    return new FetchError('That link points to a private or local network address, so it cannot be read.', 400);
}

/** Resolves the host and checks every address it has. Returns the one to connect to. */
export async function resolveSafe(url: URL): Promise<{ address: string; family: 4 | 6 }> {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const literal = isIP(host);
    if (literal) return { address: host, family: literal as 4 | 6 };
    let addrs: Array<{ address: string; family: number }>;
    try {
        addrs = await dnsLookup(host, { all: true, verbatim: true });
    } catch {
        throw new FetchError(`The address ${host} could not be found.`, 400);
    }
    if (!addrs.length) throw new FetchError(`The address ${host} could not be found.`, 400);
    if (addrs.some((a) => isBlockedAddress(a.address))) throw blocked();
    const first = addrs.find((a) => a.family === 4) ?? addrs[0];
    return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

// ── fetch ───────────────────────────────────────────────────────────────────

export type SafeResponse = {
    /** The URL that answered, after redirects. */
    url: string;
    status: number;
    contentType: string;
    body: string;
};

type Hop = { status: number; location: string | null; contentType: string; stream: Readable; length: number | null };

/** A dns lookup that always answers with the address resolveSafe() checked. */
function pinnedLookup(address: string, family: 4 | 6): LookupFunction {
    return (_hostname, options, callback) => {
        // net.connect asks for `all` when it races IPv4/IPv6 (autoSelectFamily)
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
    };
}

function requestOnce(url: URL, pin: { address: string; family: 4 | 6 }, signal: AbortSignal): Promise<Hop> {
    const mod = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = mod.request(
            url,
            {
                method: 'GET',
                agent: false,
                lookup: pinnedLookup(pin.address, pin.family),
                signal,
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
                    'Accept-Language': 'en;q=0.9,*;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                },
            },
            (res) => {
                const len = Number(res.headers['content-length']);
                resolve({
                    status: res.statusCode ?? 0,
                    location: typeof res.headers.location === 'string' ? res.headers.location : null,
                    contentType: String(res.headers['content-type'] ?? ''),
                    stream: decode(res, String(res.headers['content-encoding'] ?? '').toLowerCase()),
                    length: Number.isFinite(len) ? len : null,
                });
            },
        );
        req.on('error', reject);
        req.end();
    });
}

function decode(res: http.IncomingMessage, encoding: string): Readable {
    const unzip =
        encoding === 'gzip' || encoding === 'x-gzip'
            ? zlib.createGunzip()
            : encoding === 'deflate'
              ? zlib.createInflate()
              : encoding === 'br'
                ? zlib.createBrotliDecompress()
                : null;
    if (!unzip) return res; // readCapped counts these bytes itself
    // Compressed: cap the raw bytes too (readCapped caps the decompressed ones), so a small
    // zip bomb cannot slip under the limit. pipeline() forwards either side's error to the reader.
    let raw = 0;
    const cap = new Transform({
        transform(chunk: Buffer, _enc, done) {
            raw += chunk.length;
            done(raw > MAX_BYTES ? new FetchError('The page is larger than 2 MB, so it was not read.', 422) : null, chunk);
        },
    });
    pipeline(res, cap, unzip, () => {});
    return unzip;
}

async function readCapped(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
        const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += b.length;
        if (total > MAX_BYTES) {
            stream.destroy();
            throw new FetchError('The page is larger than 2 MB, so it was not read.', 422);
        }
        chunks.push(b);
    }
    return Buffer.concat(chunks);
}

function charsetOf(contentType: string): string {
    const m = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType);
    return m ? m[1].toLowerCase() : 'utf-8';
}

function toText(buf: Buffer, contentType: string): string {
    try {
        return new TextDecoder(charsetOf(contentType)).decode(buf);
    } catch {
        return new TextDecoder('utf-8').decode(buf);
    }
}

const TEXTUAL = /^(text\/|application\/(xhtml\+xml|xml|json|ld\+json))/i;

/**
 * GET a user-supplied URL under the SSRF policy above and return its text.
 * Throws FetchError (with the status the API route should answer with) on every refusal or failure.
 */
export async function safeFetchText(rawUrl: string): Promise<SafeResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        let url = checkUrl(rawUrl);
        for (let hop = 0; ; hop++) {
            const pin = await resolveSafe(url);
            let res: Hop;
            try {
                res = await requestOnce(url, pin, controller.signal);
            } catch (e) {
                throw networkError(e, controller.signal.aborted);
            }

            if (res.status >= 300 && res.status < 400 && res.location) {
                res.stream.resume(); // drain and drop the redirect body
                if (hop >= MAX_REDIRECTS) throw new FetchError(`The link redirects more than ${MAX_REDIRECTS} times, so it was not followed.`, 422);
                let next: URL;
                try {
                    next = new URL(res.location, url);
                } catch {
                    throw new FetchError('The link redirects to an address that is not valid.', 502);
                }
                url = checkUrl(next);
                continue;
            }

            if (res.status < 200 || res.status >= 300) {
                res.stream.resume();
                throw new FetchError(
                    res.status === 404 || res.status === 410
                        ? `The posting was not found (${res.status}). It may have been taken down.`
                        : res.status === 401 || res.status === 403
                          ? `The site refused to show the page to the server (${res.status}). Use Paste JD instead.`
                          : `The site answered with an error (${res.status}).`,
                    502,
                );
            }
            if (res.contentType && !TEXTUAL.test(res.contentType)) {
                res.stream.resume();
                throw new FetchError('That link is not a web page (it looks like a file). Use Paste JD instead.', 422);
            }
            if (res.length !== null && res.length > MAX_BYTES) {
                res.stream.destroy();
                throw new FetchError('The page is larger than 2 MB, so it was not read.', 422);
            }
            let buf: Buffer;
            try {
                buf = await readCapped(res.stream);
            } catch (e) {
                throw networkError(e, controller.signal.aborted);
            }
            return { url: url.toString(), status: res.status, contentType: res.contentType, body: toText(buf, res.contentType) };
        }
    } finally {
        clearTimeout(timer);
    }
}

function networkError(e: unknown, timedOut: boolean): FetchError {
    if (e instanceof FetchError) return e;
    if (timedOut) return new FetchError('The site took longer than 10 seconds to answer.', 504);
    const code = (e as { code?: string } | null)?.code ?? '';
    if (code.startsWith('Z_') || code.startsWith('ERR_ZLIB') || code === 'ERR_BROTLI_INVALID_PARAM')
        return new FetchError('The page could not be decompressed.', 502);
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new FetchError('The site could not be found.', 400);
    if (code === 'ECONNREFUSED') return new FetchError('The site refused the connection.', 502);
    if (/CERT|SSL|TLS/i.test(code)) return new FetchError('The site’s security certificate is not valid, so it was not read.', 502);
    return new FetchError('The page could not be fetched. Check the link, or use Paste JD.', 502);
}

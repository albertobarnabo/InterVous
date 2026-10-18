// node --test: the SSRF policy of ./safeFetch.ts (Node strips the TypeScript types itself).
// No network: every case here is refused before a connection is made.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FetchError, checkUrl, isBlockedAddress, safeFetchText } from './safeFetch.ts';

test('private, loopback, link-local, metadata and reserved addresses are blocked', () => {
    for (const ip of [
        '127.0.0.1',
        '127.255.255.254',
        '0.0.0.0',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.100.100.200',
        '100.64.0.1',
        '198.18.0.1',
        '224.0.0.1',
        '255.255.255.255',
        '::',
        '::1',
        '::127.0.0.1',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        '::ffff:169.254.169.254',
        '64:ff9b::7f00:1',
        'fe80::1',
        'fe80::1%en0',
        'fc00::1',
        'fd00:ec2::254',
        'ff02::1',
        '2001:db8::1',
        '2002:7f00:1::1',
        '[::1]',
        'not-an-ip',
    ]) {
        assert.equal(isBlockedAddress(ip), true, ip);
    }
});

test('public addresses are allowed', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
        assert.equal(isBlockedAddress(ip), false, ip);
    }
});

test('checkUrl refuses schemes, credentials, ports and internal names before any lookup', () => {
    const refused = [
        'ftp://example.com/job',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'http://user:pass@example.com/',
        'http://example.com:8080/',
        'https://example.com:22/',
        'http://localhost/',
        'http://LOCALHOST./',
        'http://app.localhost/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://printer.local/',
        'http://intranet/',
        'http://127.0.0.1/',
        'http://0x7f.1/',
        'http://2130706433/',
        'http://[::1]/',
        'http://[::ffff:127.0.0.1]/',
        'http://169.254.169.254/latest/meta-data/',
        'http://[fd00:ec2::254]/',
        'not a url',
    ];
    for (const u of refused) {
        assert.throws(() => checkUrl(u), (e) => e instanceof FetchError && e.status === 400, u);
    }
    for (const u of ['https://jobs.ashbyhq.com/openai/123', 'http://example.com/', 'https://example.com:443/x', 'https://8.8.8.8/']) {
        assert.equal(checkUrl(u).href, new URL(u).href);
    }
});

test('safeFetchText refuses a private target without connecting', async () => {
    for (const u of ['http://127.0.0.1/', 'http://[::ffff:169.254.169.254]/', 'http://10.0.0.1/admin']) {
        await assert.rejects(safeFetchText(u), (e) => e instanceof FetchError && e.status === 400, u);
    }
});

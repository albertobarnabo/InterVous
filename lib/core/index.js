// Directory entry for lib/core: `import { buildToday } from '…/lib/core'` resolves here (Next
// tries index.js before index.mjs) and gets everything index.mjs exports. Types come from
// index.d.ts. Tests run with `npm test` (a glob over lib/core/**/*.test.mjs).
export * from './index.mjs';

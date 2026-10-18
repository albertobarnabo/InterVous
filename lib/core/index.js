// Directory entry for lib/core.
//
// 1. Bundlers: `import { buildToday } from '…/lib/core'` resolves here (Next tries index.js before
//    index.mjs) and gets everything index.mjs exports. Types come from index.d.ts.
// 2. Tests: since Node 21, `node --test lib/core` no longer expands a directory; it runs the directory
//    as a module, which is this file. When run that way it loads every test/*.test.mjs, so
//    `node --test lib/core` runs the whole suite. The block below never runs in a bundle
//    (import.meta.main is only true for Node's entry module) and is ignored by the bundler.
export * from './index.mjs';

if (import.meta.main) {
  const fs = globalThis.process.getBuiltinModule('node:fs');
  const dir = new URL('./test/', import.meta.url);
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.test.mjs')).sort()) {
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ new URL(name, dir).href);
  }
}

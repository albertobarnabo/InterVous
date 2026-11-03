// Lets node --test load lib/data's TypeScript directly (Node strips the types itself): relative
// imports get their extension, `react` becomes hooks that work outside a render, and ./client becomes
// ./fakeClient.mjs, so no test can reach a real database. Inside src/features, `@/ui` and lib/data
// become ./fakeUi.mjs, so a hook can run with no design system and with a recorded delete.
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const stub = (name) => pathToFileURL(path.join(HERE, name)).href;

registerHooks({
    resolve(specifier, context, next) {
        if (specifier === 'react') return { url: stub('fakeReact.mjs'), shortCircuit: true };
        if (specifier === './client') return { url: stub('fakeClient.mjs'), shortCircuit: true };
        if (context.parentURL?.includes('/src/features/') && (specifier === '@/ui' || specifier.endsWith('/lib/data'))) {
            return { url: stub('fakeUi.mjs'), shortCircuit: true };
        }
        if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
            const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
            for (const candidate of [`${base}.ts`, path.join(base, 'index.mjs'), path.join(base, 'index.ts')]) {
                if (fs.existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
            }
        }
        return next(specifier, context);
    },
});

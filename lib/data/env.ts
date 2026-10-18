// Dev-only fixture mode. Both values are inlined at build time, so in a production
// build (`next build` always sets NODE_ENV=production) this is the constant `false`
// and every fixture branch is dead code.
export const FIXTURE_MODE: boolean =
    process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1';

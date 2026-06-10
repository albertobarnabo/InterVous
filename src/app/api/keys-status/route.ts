import { NextResponse } from 'next/server';
import { getUserAndKeys } from '../../../../lib/backend/serverKeys';

/* Returns only WHICH keys are configured, never the values.
   The settings UI uses this for its "Saved / Not set" badges. */
export async function GET(request: Request) {
    try {
        const auth = await getUserAndKeys(request);
        if (!auth) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { keys } = auth;
        return NextResponse.json({
            open_ai: Boolean(keys?.open_ai),
            deep_seek: Boolean(keys?.deep_seek),
            mistral: Boolean(keys?.mistral),
            tavily: Boolean(keys?.tavily),
        });
    } catch (error) {
        console.error('keys-status failed:', error);
        return NextResponse.json({ error: 'Failed to read key status' }, { status: 500 });
    }
}

'use client';
// The writes behind Today's buttons and the confirm flow. Each one is a single call into lib/data
// (logEvent / movePhase / updateApplication); the database moves the phase from the event.
import type { ConfirmOption, ConfirmQuestion } from '../../../lib/core';
import { formatShort } from '../../../lib/core';
import { logEvent, movePhase, updateApplication } from '../../../lib/data';
import type { JobUpdate } from '../../../lib/data';

export type OutcomeKind = 'interview_done' | 'rejection' | 'offer' | 'withdrawn';

export const OUTCOMES: { kind: OutcomeKind; label: string }[] = [
    { kind: 'interview_done', label: 'Interview done, waiting' },
    { kind: 'rejection', label: 'They said no' },
    { kind: 'offer', label: 'Offer' },
    { kind: 'withdrawn', label: 'I withdrew' },
];

export const markFollowedUp = (jobId: number, on?: string) => logEvent(jobId, { kind: 'follow_up_sent', occurred_on: on });
export const markNoReply = (jobId: number, on?: string) => movePhase(jobId, 'no_reply', { on });
export const dropDraft = (jobId: number, note?: string) => movePhase(jobId, 'skipped', { note: note ?? null });
export const logOutcome = (jobId: number, kind: OutcomeKind, on: string) => logEvent(jobId, { kind, occurred_on: on });

/** Mark a draft as sent on a date: an `applied` event (the database moves draft → applied and sets applied_on). */
export async function markSent(jobId: number, on: string) {
    await logEvent(jobId, { kind: 'applied', occurred_on: on });
    await updateApplication(jobId, { applied_on: on });
}

export const finishNextAction = (jobId: number) => updateApplication(jobId, { next_action: null, next_action_due: null });
export const rescheduleNextAction = (jobId: number, due: string) => updateApplication(jobId, { next_action_due: due });

/**
 * A short, plain follow-up line he can paste and edit. Deliberately bare: it is sent under his name,
 * so it says only the facts (role, date) and the question.
 */
export function followUpLine(opts: { contactName?: string | null; role: string; appliedOn?: string | null; today: string }): string {
    const first = opts.contactName?.trim().split(/\s+/)[0];
    const when = opts.appliedOn ? ` on ${formatShort(opts.appliedOn, { today: opts.today })}` : '';
    return `${first ? `Hi ${first}, ` : 'Hi, '}I applied for the ${opts.role} role${when}. Is there any news on the next step? Thanks, Alberto`;
}

/** Copy text; false when the clipboard is not available (insecure context, permission). */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

// ── confirm flow ────────────────────────────────────────────────────────────

/** Options that need a date before they can be saved. */
export const NEEDS_DATE: ReadonlySet<ConfirmOption> = new Set<ConfirmOption>([
    'different_date',
    'yes_on_date',
    'date',
    'sent_on_date',
    'rejected',
    'offer',
    'withdrawn',
]);

/** Button text for each option of a question. */
export function optionLabel(q: ConfirmQuestion, o: ConfirmOption): string {
    switch (o) {
        case 'yes':
            return q.kind === 'phase' ? 'Yes, still' : 'Yes';
        case 'different_date':
            return 'Different date';
        case 'not_sent':
            return q.kind === 'phase' ? 'Yes, not sent' : 'No, not sent';
        case 'yes_on_date':
            return 'Yes, on…';
        case 'not_yet':
            return 'Not yet';
        case 'dropped':
            return 'Dropped it';
        case 'date':
            return 'Pick the date';
        case 'rejected':
            return 'Rejected';
        case 'offer':
            return 'Offer';
        case 'withdrawn':
            return 'I withdrew';
        case 'sent_on_date':
            return 'Sent it, on…';
        case 'change':
            return 'No, change it';
        default:
            return String(o);
    }
}

/** The date field a date-picking option writes, and the date it starts from. */
export function dateTarget(q: ConfirmQuestion): 'cv_built_on' | 'applied_on' {
    return q.fields.includes('cv_built_on') && !q.fields.includes('applied_on') ? 'cv_built_on' : 'applied_on';
}

const FIELD_LABELS: Record<string, string> = { phase: 'status', applied_on: 'sent date', cv_built_on: 'CV date' };
export const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f.replace(/_/g, ' ');

/** What the note event says, e.g. "Confirmed: sent on 30 Aug". */
export function answerSummary(q: ConfirmQuestion, o: ConfirmOption, date: string | null, today: string): string {
    const d = date ? formatShort(date, { today }) : '';
    switch (o) {
        case 'yes':
            return q.kind === 'phase' ? `still ${q.phase.replace(/_/g, ' ')}` : `${q.fields.map(fieldLabel).join(' and ')} as recorded`;
        case 'different_date':
        case 'date':
            return `${dateTarget(q) === 'cv_built_on' ? 'CV built' : 'sent'} on ${d}`;
        case 'yes_on_date':
        case 'sent_on_date':
            return `sent on ${d}`;
        case 'not_sent':
            return 'not sent';
        case 'not_yet':
            return 'not sent yet';
        case 'dropped':
            return 'dropped, not applying';
        case 'rejected':
            return `rejected on ${d}`;
        case 'offer':
            return `offer on ${d}`;
        case 'withdrawn':
            return `withdrew on ${d}`;
        default:
            return 'confirmed';
    }
}

/**
 * Save one answer: write the field, drop the question's fields from `uncertain`, log a note event
 * (spec 2.1). `uncertain` is the row's current list (from the stored row).
 */
export async function saveAnswer(q: ConfirmQuestion, o: ConfirmOption, date: string | null, uncertain: string[], today: string) {
    const remaining = uncertain.filter((f) => !q.fields.includes(f));
    const patch: JobUpdate = { uncertain: remaining };
    const on = date ?? today;
    switch (o) {
        case 'different_date':
        case 'date':
            patch[dateTarget(q)] = on;
            break;
        case 'yes_on_date':
        case 'sent_on_date':
            if (q.phase === 'draft') await logEvent(q.appId, { kind: 'applied', occurred_on: on });
            patch.applied_on = on;
            break;
        case 'not_sent':
            if (q.phase !== 'draft') {
                await movePhase(q.appId, 'draft', { on: today, note: 'Not sent after all' });
                patch.applied_on = null;
            }
            break;
        case 'dropped':
            await movePhase(q.appId, 'skipped', { on: today, note: 'Decided not to apply' });
            break;
        case 'rejected':
            await logEvent(q.appId, { kind: 'rejection', occurred_on: on });
            break;
        case 'offer':
            await logEvent(q.appId, { kind: 'offer', occurred_on: on });
            break;
        case 'withdrawn':
            await logEvent(q.appId, { kind: 'withdrawn', occurred_on: on });
            break;
        default:
            break; // yes / not_yet: the stored value is right
    }
    await updateApplication(q.appId, patch);
    await logEvent(q.appId, { kind: 'note', occurred_on: today, title: `Confirmed: ${answerSummary(q, o, date, today)}` });
}

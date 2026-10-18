'use client';
// "What happened?" from the Applications list and from Home: one choice (they replied, an
// interview, rejected, offer, no reply), a date, then one undoable write through recordUpdate().
// The same events the application page's "What happened?" buttons log, so the database moves
// the status the same way.
import { CalendarClock, CircleX, Hourglass, MessageSquareReply, Send, Trophy, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { formatShort, type Phase } from '../../../lib/core';
import { recordUpdate, type NewEvent } from '../../../lib/data';
import { useToast } from '@/ui';

export type UpdateChoice = 'reply' | 'interview' | 'interview_done' | 'rejected' | 'offer' | 'no_reply';

export type ChoiceInfo = {
    id: UpdateChoice;
    label: string;
    icon: LucideIcon;
    /** Label of the date field once the choice is made. */
    when: string;
    /** The date may be in the future (an interview that is booked). */
    future?: boolean;
    /** Saved at once, no date asked. */
    immediate?: boolean;
};

const NOT_SENT: Phase[] = ['draft', 'skipped'];
/** Phases a reply should move forward from (the database only moves "Sent" by itself). */
const BEFORE_REPLY: Phase[] = ['draft', 'skipped', 'applied', 'no_reply'];
const BEFORE_INTERVIEW: Phase[] = ['draft', 'skipped', 'applied', 'screening', 'no_reply', 'rejected', 'withdrawn'];

/** The choices that make sense for where an application stands. */
export function choicesFor(phase: Phase): ChoiceInfo[] {
    const rejected: ChoiceInfo = { id: 'rejected', label: 'Rejected', icon: CircleX, when: 'When did they say no?' };
    const offer: ChoiceInfo = { id: 'offer', label: 'Offer', icon: Trophy, when: 'When did the offer come?' };
    const noReply: ChoiceInfo = { id: 'no_reply', label: 'No reply', icon: Hourglass, when: '', immediate: true };
    if (phase === 'interviewing') {
        return [
            { id: 'interview_done', label: 'Interview done', icon: MessageSquareReply, when: 'When was the interview?' },
            { id: 'interview', label: 'Another interview', icon: CalendarClock, when: 'When is it?', future: true },
            rejected,
            offer,
            noReply,
        ];
    }
    const list: ChoiceInfo[] = [
        { id: 'reply', label: 'Got a reply', icon: MessageSquareReply, when: 'When did they reply?' },
        { id: 'interview', label: 'Interview', icon: CalendarClock, when: 'When is the interview?', future: true },
        rejected,
    ];
    if (phase !== 'offer') list.push(offer);
    if (phase !== 'no_reply' && !NOT_SENT.includes(phase)) list.push(noReply);
    return list;
}

type Plan = { events: NewEvent[]; patch?: { applied_on: string }; confirm: string[]; done: string };

function plan(phase: Phase, choice: UpdateChoice, date: string, today: string): Plan {
    const sentFirst: NewEvent[] = NOT_SENT.includes(phase) ? [{ kind: 'applied', occurred_on: date }] : [];
    switch (choice) {
        case 'reply':
            return {
                events: [...sentFirst, { kind: 'reply', occurred_on: date, to_phase: BEFORE_REPLY.includes(phase) ? 'screening' : null }],
                confirm: ['phase'],
                done: 'they replied',
            };
        case 'interview':
        case 'interview_done': {
            const done = choice === 'interview_done' || (date <= today && phase === 'interviewing');
            return {
                events: [
                    ...sentFirst,
                    { kind: done ? 'interview_done' : 'interview_scheduled', occurred_on: date, to_phase: BEFORE_INTERVIEW.includes(phase) ? 'interviewing' : null },
                ],
                confirm: ['phase'],
                done: done ? 'interview done, waiting to hear' : date > today ? `interview on ${formatShort(date, { today })}` : 'interview',
            };
        }
        case 'rejected':
            return { events: [{ kind: 'rejection', occurred_on: date }], confirm: ['phase'], done: 'rejected' };
        case 'offer':
            return { events: [{ kind: 'offer', occurred_on: date }], confirm: ['phase'], done: 'offer' };
        case 'no_reply':
            return { events: [{ kind: 'phase_change', to_phase: 'no_reply', occurred_on: today }], confirm: ['phase'], done: 'closed as no reply' };
    }
}

export type Target = { id: number; company: string; phase: Phase };

/**
 * The writes behind the list and Home buttons. Each resolves once saved and shows a toast with
 * Undo (recordUpdate's undo removes the events and puts the status back). Errors throw.
 */
export function useUpdates() {
    const toast = useToast();

    const withUndo = useCallback(
        (text: string, undo: () => Promise<void>) => {
            toast.show({
                kind: 'success',
                text,
                action: {
                    label: 'Undo',
                    run: async () => {
                        try {
                            await undo();
                            toast.show({ kind: 'info', text: 'Undone.' });
                        } catch (e) {
                            toast.show({ kind: 'error', text: e instanceof Error ? e.message : 'Could not undo it.' });
                        }
                    },
                },
            });
        },
        [toast],
    );

    /** "What happened?": one choice and its date. */
    const record = useCallback(
        async (t: Target, choice: UpdateChoice, date: string, today: string) => {
            const p = plan(t.phase, choice, date, today);
            const res = await recordUpdate(t.id, { events: p.events, patch: p.patch, confirm: p.confirm });
            withUndo(`Saved: ${t.company}, ${p.done}.`, res.undo);
        },
        [withUndo],
    );

    /** Mark as sent on a date (and confirm the status and the date). */
    const markSent = useCallback(
        async (t: Target, date: string, today: string) => {
            const events: NewEvent[] = NOT_SENT.includes(t.phase) ? [{ kind: 'applied', occurred_on: date }] : [];
            const res = await recordUpdate(t.id, { events, patch: { applied_on: date }, confirm: ['phase', 'applied_on'] });
            withUndo(`Marked ${t.company} as sent on ${formatShort(date, { today })}.`, res.undo);
        },
        [withUndo],
    );

    /** Close several as no reply at once (Home's "probably closed" card); one Undo for all. */
    const markNoReply = useCallback(
        async (targets: Target[], today: string) => {
            const undos: Array<() => Promise<void>> = [];
            for (const t of targets) {
                const res = await recordUpdate(t.id, { events: [{ kind: 'phase_change', to_phase: 'no_reply', occurred_on: today }], confirm: ['phase'] });
                undos.push(res.undo);
            }
            const names = targets.length === 1 ? targets[0].company : `${targets.length} applications`;
            withUndo(`Closed ${names} as no reply.`, async () => {
                for (const u of undos.reverse()) await u();
            });
        },
        [withUndo],
    );

    /** Not applying (a draft whose job post is gone). */
    const notApplying = useCallback(
        async (t: Target, today: string) => {
            const res = await recordUpdate(t.id, { events: [{ kind: 'skipped', occurred_on: today }], confirm: ['phase'] });
            withUndo(`Took ${t.company} off your list.`, res.undo);
        },
        [withUndo],
    );

    /** You sent the follow-up email. */
    const followedUp = useCallback(
        async (t: Target, today: string) => {
            const res = await recordUpdate(t.id, { events: [{ kind: 'follow_up_sent', occurred_on: today }] });
            withUndo(`Noted: you followed up with ${t.company}.`, res.undo);
        },
        [withUndo],
    );

    return { record, markSent, markNoReply, notApplying, followedUp };
}

export const SENT_ICON = Send;

// Plain words for where an application stands, and the one "next step" sentence of the
// application page. Shared by the application page, /companies and /settings.
import { addDays, daysBetween, formatShort } from "../../../lib/core";
import type { Derived } from "../../../lib/core";
import type { JobEvent, UserSettings } from "../../../lib/data";
import type { Phase } from "../../../lib/types";

export const STATUS_LABEL: Readonly<Record<Phase, string>> = {
  draft: "Not sent",
  applied: "Sent · waiting",
  screening: "In process",
  interviewing: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  no_reply: "No reply",
  withdrawn: "Withdrawn",
  skipped: "Not applying",
};

export function statusLabel(phase: string | null | undefined): string {
  return STATUS_LABEL[(phase ?? "draft") as Phase] ?? String(phase ?? "");
}

/** "today", "yesterday", "5 days ago" */
export function ago(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** "Waiting 17 days" for an application that was sent and has not heard back; null otherwise. */
export function waitingLabel(d: Derived): string | null {
  if (d.phase !== "applied" || d.responded || d.silenceDays === null || d.silenceDays < 1) return null;
  return `Waiting ${d.silenceDays} ${d.silenceDays === 1 ? "day" : "days"}`;
}

const DONE_TITLES = new Set([
  "applied",
  "sent",
  "application submitted",
  "cv built",
  "cv variant built",
  "reply",
  "rejection",
  "rejected",
  "offer",
  "interview scheduled",
  "interview done",
  "note",
]);

const EVENT_LABEL: Record<string, string> = {
  cv_built: "CV made",
  applied: "You sent it",
  auto_ack: "Automatic confirmation email",
  reply: "They replied",
  assessment: "Test or task from them",
  interview_scheduled: "Interview",
  interview_done: "Interview done",
  follow_up_sent: "You followed up",
  rejection: "Rejected",
  offer: "Offer",
  withdrawn: "You withdrew",
  skipped: "Decided not to apply",
  posting_closed: "Job post closed",
  note: "Note",
};

/** The history line of an event: a plain label, plus the event's own title when it says more. */
export function eventLine(e: Pick<JobEvent, "kind" | "title" | "to_phase">): { label: string; detail: string | null } {
  const title = e.title?.trim() || null;
  if (e.kind === "note") return { label: title ?? "Note", detail: null };
  const label = e.kind === "phase_change" ? `Status changed to ${statusLabel(e.to_phase)}` : (EVENT_LABEL[e.kind] ?? "Update");
  const detail = title && !DONE_TITLES.has(title.toLowerCase()) && title.toLowerCase() !== label.toLowerCase() ? title : null;
  return { label, detail };
}

/** One plain sentence: what to do next with this application, and why. */
export function nextStep(d: Derived, settings: Pick<UserSettings, "follow_up_after_days" | "no_reply_after_days">, today: string): string {
  const fmt = (date: string | null) => formatShort(date, { today });
  switch (d.phase) {
    case "draft":
      if (d.app.posting_live === false) return "The job post has closed. If you didn't send it, mark it as “Not applying”.";
      return "Not sent yet. When you send it, tap “Sent it” so InterVous can track the reply.";
    case "applied":
    case "screening": {
      if (d.phase === "screening" || d.responded) return "They replied. When you hear about the next step, tell InterVous what happened.";
      if (!d.appliedOn) return "Waiting for a reply. Tap “Sent it” to add the day you sent it.";
      const n = d.silenceDays ?? d.daysSinceApplied ?? 0;
      if (n >= settings.no_reply_after_days) return `No reply after ${n} days. It is probably closed: tap “No reply” to close it.`;
      if (n >= settings.follow_up_after_days) return `No reply after ${n} days. A short, friendly follow-up email can help.`;
      const by = d.silenceBase ? addDays(d.silenceBase, settings.follow_up_after_days) : null;
      return by
        ? `Nothing to do yet. If there's no reply by ${fmt(by)}, send a short follow-up.`
        : "Nothing to do yet. Check back in a week or two.";
    }
    case "interviewing": {
      const next = d.nextInterviewOn && d.nextInterviewOn >= today ? d.nextInterviewOn : null;
      if (next) {
        const days = daysBetween(today, next) ?? 0;
        const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `on ${fmt(next)}`;
        return `Interview ${when}. Read the job description and the CV you sent again before it.`;
      }
      return "How did the interview go? Tell InterVous what happened next.";
    }
    case "offer":
      return "You have an offer. Write down the details and your decision in Notes.";
    case "rejected":
      return "This one is closed. It still counts in what InterVous learns from your applications.";
    case "no_reply":
      return "Closed without a reply. If they get in touch, tap “Got a reply”.";
    case "withdrawn":
      return "You withdrew from this one.";
    case "skipped":
      return "You decided not to apply. If you change your mind, tap “Sent it” once you send it.";
    default:
      return "";
  }
}

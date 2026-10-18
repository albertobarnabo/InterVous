// Status display helpers for the primitives. The status ids (phases) come from lib/core/phases.mjs;
// the words below are what the UI shows. They replace lib/core's PHASE_LABELS on screen, so
// import STATUS_LABEL / statusLabel from "@/ui", never PHASE_LABELS from lib/core, for display.
import { isPhase, phaseTokens } from "../../lib/core/phases.mjs";
import type { Phase } from "../../lib/types";

/** Plain words for each status. The only labels the UI shows. */
export const STATUS_LABEL: Readonly<Record<Phase, string>> = Object.freeze({
  draft: "Not sent",
  applied: "Sent · waiting",
  screening: "In process",
  interviewing: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  no_reply: "No reply",
  withdrawn: "Withdrawn",
  skipped: "Not applying",
});

/** The plain label for a status id; unknown values pass through, null/undefined give "Not sent". */
export function statusLabel(p: Phase | string | null | undefined): string {
  if (p == null) return STATUS_LABEL.draft;
  return isPhase(p) ? STATUS_LABEL[p as Phase] : p;
}

/** Same as STATUS_LABEL (kept for older imports). */
export const PHASE_LABEL = STATUS_LABEL;
/** Same as statusLabel (kept for older imports). */
export const phaseLabel = statusLabel;

/** CSS colour values for a status: `fg` (text and dot) and `bg` (tint). */
export function phaseVars(phase: Phase | string | null | undefined) {
  const t = phaseTokens(phase ?? "draft");
  return { fg: `var(${t.fg})`, bg: `var(${t.bg})` };
}
/** Same as phaseVars. */
export const statusVars = phaseVars;

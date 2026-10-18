// Phase display helpers for the primitives. Labels and token names come from
// lib/core/phases.mjs (the single source); the token values live in globals.css.
import { PHASE_LABELS, phaseLabel, phaseTokens } from "../../lib/core/phases.mjs";
import type { Phase } from "../../lib/types";

export const PHASE_LABEL = PHASE_LABELS as Readonly<Record<Phase, string>>;
export { phaseLabel };

/** CSS colour values for a phase: `fg` (text and dot) and `bg` (tint). */
export function phaseVars(phase: Phase | string | null | undefined) {
  const t = phaseTokens(phase ?? "draft");
  return { fg: `var(${t.fg})`, bg: `var(${t.bg})` };
}

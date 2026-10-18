// Fit items (job_requirements) as the dossier shows them.
import { GAP_STATE_LABELS, type GapState } from "../../../lib/core";
import type { JobProofPointWithPoint, JobRequirement, ProofPoint } from "../../../lib/data";

export type Tone = "accent" | "caution";

/** Teal for met or partial, amber for a gap or a claim to check. */
export function toneOf(r: Pick<JobRequirement, "verdict">): Tone {
  return r.verdict === "met" || r.verdict === "partial" ? "accent" : "caution";
}

export function verdictLabel(r: Pick<JobRequirement, "verdict" | "gap_state">): string {
  switch (r.verdict) {
    case "met":
      return "You showed it";
    case "partial":
      return "Partly shown";
    case "caution":
      return "Claim to check";
    case "gap":
      return r.gap_state ? GAP_STATE_LABELS[r.gap_state as GapState] ?? "Gap" : "Gap";
    default:
      return r.verdict;
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Proof points named in an item's evidence (by name, key or alias), in the application's order. */
export function proofChipsFor(r: Pick<JobRequirement, "evidence">, used: JobProofPointWithPoint[]): ProofPoint[] {
  if (!r.evidence) return [];
  const ev = ` ${norm(r.evidence)} `;
  const out: ProofPoint[] = [];
  for (const u of used) {
    const p = u.proof_point;
    if (!p) continue;
    const names = [p.name, p.key.replace(/-/g, " "), ...(p.aliases ?? [])].map(norm).filter((n) => n.length >= 3);
    if (names.some((n) => ev.includes(` ${n} `))) out.push(p);
  }
  return out;
}

export function proofPointHref(key: string): string {
  return `/proof-points#${encodeURIComponent(key)}`;
}

"use client";

import { useState, type CSSProperties } from "react";
import { cx } from "./cx";

export type CompanyMarkProps = {
  name: string;
  logoUrl?: string | null;
  /** Pixel size: 40 in rows, 56 on the application page header. */
  size?: number;
  className?: string;
  /** Sets view-transition-name (e.g. `app-${id}`) for the list → page transition. */
  viewTransitionName?: string;
};

/** Initials: first letters of the first two words, ignoring legal suffixes. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(inc|ltd|llc|gmbh|ag|plc|sa|spa|srl|bv|the|of|and|&)$/i.test(w));
  if (!words.length) return name.slice(0, 2).toUpperCase() || "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Pale tints with dark text (all at least 7:1), picked from the name so a company keeps its colour.
const TINTS: Array<{ bg: string; fg: string }> = [
  { bg: "#DDEFEC", fg: "#134E4E" },
  { bg: "#DFE8FA", fg: "#1E3A7A" },
  { bg: "#FBE6DA", fg: "#7A3412" },
  { bg: "#ECE4F8", fg: "#4A2C80" },
  { bg: "#E6F1DC", fg: "#2D5216" },
  { bg: "#F7E3EA", fg: "#7A1F43" },
  { bg: "#E9ECF1", fg: "#283447" },
];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * A company logo on a white rounded tile, or the company's initials on a soft tint when there is
 * no logo (or it fails to load). Decorative: put the company name in text next to it.
 */
export function CompanyMark({ name, logoUrl, size = 40, className, viewTransitionName }: CompanyMarkProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const style: CSSProperties = { width: size, height: size, viewTransitionName, borderRadius: Math.round(size * 0.28) };
  if (logoUrl && broken !== logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setBroken(logoUrl)}
        className={cx(
          "shrink-0 bg-white object-contain shadow-[0_0_0_0.5px_rgba(15,23,42,0.12),0_1px_2px_rgba(15,23,42,0.06)]",
          className,
        )}
        style={{ ...style, padding: Math.max(2, Math.round(size * 0.1)) }}
      />
    );
  }
  const t = tintFor(name || "?");
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold tracking-tight select-none shadow-[0_0_0_0.5px_rgba(15,23,42,0.06)]",
        className,
      )}
      style={{ ...style, background: t.bg, color: t.fg, fontSize: Math.max(13, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}

/** Same as CompanyMark: `<Logo name="Apple" logoUrl={company.logo_url} />`. */
export const Logo = CompanyMark;
export type LogoProps = CompanyMarkProps;

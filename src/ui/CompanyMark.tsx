"use client";

import { useState, type CSSProperties } from "react";
import { cx } from "./cx";

export type CompanyMarkProps = {
  name: string;
  logoUrl?: string | null;
  /** Pixel size: 32 in rows, 48 in the dossier header. */
  size?: number;
  className?: string;
  /** Sets view-transition-name (e.g. `app-${id}`) for the list → dossier transition. */
  viewTransitionName?: string;
};

/** Initials: first letters of the first two words, ignoring legal suffixes. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(inc|ltd|llc|gmbh|ag|plc|sa|bv|the|of|and|&)$/i.test(w));
  if (!words.length) return name.slice(0, 2).toUpperCase() || "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Logo with object-contain, else initials on a muted tint. Replaces the old gradient tiles. */
export function CompanyMark({ name, logoUrl, size = 32, className, viewTransitionName }: CompanyMarkProps) {
  const [broken, setBroken] = useState(false);
  const style: CSSProperties = { width: size, height: size, viewTransitionName };
  const radius = size >= 40 ? "rounded-md" : "rounded-sm";
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setBroken(true)}
        className={cx("shrink-0 border border-line bg-white object-contain p-0.5", radius, className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center bg-surface-2 font-medium text-ink-2", radius, className)}
      style={{ ...style, fontSize: Math.max(13, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}

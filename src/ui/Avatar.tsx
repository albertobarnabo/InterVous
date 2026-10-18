"use client";

import { useState } from "react";
import { cx } from "./cx";

export type AvatarProps = {
  /** Image URL (e.g. the profile avatar in Supabase storage). */
  url?: string | null;
  /** Name or email: its first letter is the fallback. */
  label: string;
  /** Pixel size (default 32). */
  size?: number;
  className?: string;
};

/** A round person avatar: the photo, or the first letter of the name on a teal tint. Decorative. */
export function Avatar({ url, label, size = 32, className }: AvatarProps) {
  const [broken, setBroken] = useState<string | null>(null);
  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar URL from Supabase storage
      <img
        src={url}
        alt=""
        aria-hidden
        onError={() => setBroken(url)}
        className={cx("shrink-0 rounded-full object-cover shadow-[0_0_0_0.5px_rgba(15,23,42,0.12)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent select-none", className)}
      style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.42)) }}
    >
      {(label.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

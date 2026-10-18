import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge, taught this project's theme (src/app/globals.css @theme inline), so a class passed
// later wins over a conflicting one passed earlier: cx("relative inline-flex", "absolute hidden")
// gives "absolute hidden". Without the theme it would read `text-caption` as a colour and drop it
// next to `text-ink-3`.
const merge = extendTailwindMerge({
  override: {
    // Tailwind v4: `leading-*` sets --tw-leading, which `text-*` sizes read, so the two never
    // conflict (tailwind-merge's default drops a leading-* written before a text size).
    conflictingClassGroups: { "font-size": [] },
  },
  extend: {
    theme: {
      text: ["caption", "small", "body", "reading", "h3", "h2", "h1", "h1-sm", "figure"],
      shadow: ["1", "2"],
      container: ["content", "reading"],
    },
  },
});

/** Joins class names, skipping falsy values; a later Tailwind class overrides a conflicting earlier one. */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return merge(...parts);
}

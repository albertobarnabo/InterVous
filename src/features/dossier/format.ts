import { formatShort } from "../../../lib/core";

/** '30 Aug' (with the year when it is not this year). */
export function shortDate(date: string | null | undefined, today: string): string {
  return formatShort(date ?? null, { today });
}

/** '84 KB' */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** '1,184' */
export function int(n: number): string {
  return n.toLocaleString("en-US");
}

/** Clipboard API first; the old execCommand path when it is missing or refused (unfocused page). */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to the old path */
  }
  const active = document.activeElement as HTMLElement | null;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  active?.focus({ preventScroll: true });
  if (!ok) throw new Error("copy refused");
}

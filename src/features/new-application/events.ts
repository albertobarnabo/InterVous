// Opening the New-application sheet with something filled in (a company from /companies,
// a link pasted into the palette). It rides on the shell's OPEN_NEW_APPLICATION event, so
// the plain `n` key and openNewApplication() keep working with no detail.
import { OPEN_NEW_APPLICATION } from "@/ui/events";

export type NewApplicationMode = "link" | "paste" | "manual";

export type NewApplicationPrefill = {
  mode?: NewApplicationMode;
  company?: string;
  url?: string;
};

export function openNewApplicationWith(prefill: NewApplicationPrefill) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NewApplicationPrefill>(OPEN_NEW_APPLICATION, { detail: prefill }));
}

/** The detail of an OPEN_NEW_APPLICATION event, or {} when it came from the plain shell event. */
export function prefillOf(e: Event): NewApplicationPrefill {
  const d = (e as CustomEvent<unknown>).detail;
  return d && typeof d === "object" ? (d as NewApplicationPrefill) : {};
}

// Shell-level commands, decoupled through window events so the shell does not import
// feature packages (the palette, the new-application sheet, the shortcut sheet).
// Listeners: src/features/palette (WP9) listens for OPEN_PALETTE; the new-application
// sheet for OPEN_NEW_APPLICATION; the shortcut sheet for OPEN_SHORTCUTS.

export const OPEN_PALETTE = "iv:open-palette";
export const OPEN_NEW_APPLICATION = "iv:open-new-application";
export const OPEN_SHORTCUTS = "iv:open-shortcuts";
export const FOCUS_SEARCH = "iv:focus-search";
/** Fired on window after the avatar is saved; `detail` is the new URL (or null when removed). */
export const AVATAR_CHANGED = "iv:avatar-changed";

function emit(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

export const openPalette = () => emit(OPEN_PALETTE);
export const openNewApplication = () => emit(OPEN_NEW_APPLICATION);
export const openShortcuts = () => emit(OPEN_SHORTCUTS);
/** Focuses the page's search input: give it `data-page-search`. */
export const focusSearch = () => emit(FOCUS_SEARCH);

/** Subscribe in a useEffect; returns the unsubscribe function. */
export function onShellEvent(name: string, fn: () => void): () => void {
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}

/** True when the keyboard event comes from a text field (so global keys must not fire). */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (t as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(type);
  }
  return t.closest("[role=combobox],[role=listbox],[role=dialog] input") !== null;
}

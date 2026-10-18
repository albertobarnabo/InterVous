"use client";

import { NewApplicationSheet } from "@/features/new-application/NewApplicationSheet";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsSheet } from "./ShortcutsSheet";

/**
 * The overlays every authenticated page shares: the ⌘K palette (OPEN_PALETTE), the
 * New-application sheet (OPEN_NEW_APPLICATION) and the shortcut sheet (OPEN_SHORTCUTS).
 * Mount once in src/app/(app)/layout.tsx, next to {children} inside <AppShell>.
 */
export function GlobalSheets() {
  return (
    <>
      <CommandPalette />
      <NewApplicationSheet />
      <ShortcutsSheet />
    </>
  );
}

export default GlobalSheets;

"use client";

import { Fragment, useEffect, useState } from "react";
import { Dialog, Kbd } from "@/ui";
import { OPEN_SHORTCUTS, onShellEvent } from "@/ui/events";

const GROUPS: Array<{ title: string; keys: Array<{ keys: string[]; sep?: string; label: string }> }> = [
  {
    title: "Anywhere",
    keys: [
      { keys: ["⌘K"], label: "Search or jump to" },
      { keys: ["n"], label: "Add a job" },
      { keys: ["/"], label: "Search this page" },
      { keys: ["?"], label: "This list" },
      { keys: ["Esc"], label: "Close a window" },
    ],
  },
  {
    title: "Go to",
    keys: [
      { keys: ["g", "h"], sep: "then", label: "Home" },
      { keys: ["g", "a"], sep: "then", label: "Applications" },
      { keys: ["g", "c"], sep: "then", label: "Companies" },
      { keys: ["g", "s"], sep: "then", label: "Settings" },
    ],
  },
];

/** The `?` sheet: every keyboard shortcut. */
export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => onShellEvent(OPEN_SHORTCUTS, () => setOpen(true)), []);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" size="md">
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`keys-${g.title}`}>
            <h3 id={`keys-${g.title}`} className="text-small font-semibold text-ink">
              {g.title}
            </h3>
            <dl className="mt-2 flex flex-col">
              {g.keys.map((k) => (
                <div key={k.label} className="flex min-h-11 items-center justify-between gap-4 border-b border-ink/[0.06] last:border-b-0">
                  <dt className="text-small text-ink">{k.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1 text-caption text-ink-2">
                    {k.keys.map((key, i) => (
                      <Fragment key={key}>
                        {i > 0 ? <span>{k.sep}</span> : null}
                        <Kbd>{key}</Kbd>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

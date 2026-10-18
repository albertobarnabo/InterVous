"use client";
// The rows, in one glass card per status group ("All"), or one card for a single filter.
import { GlassCard } from "@/ui";
import { AppRow, type RowHandlers } from "./AppRow";
import type { AppItem, Group } from "./model";

function Rows({ items, h }: { items: AppItem[]; h: RowHandlers }) {
  return (
    <GlassCard as="ul" padding="none" className="overflow-hidden divide-y divide-ink/[0.06]">
      {items.map((it) => (
        <li key={it.id} data-item-id={it.id}>
          <AppRow item={it} h={h} />
        </li>
      ))}
    </GlassCard>
  );
}

export function ApplicationList({ groups, grouped, h }: { groups: Group[]; grouped: boolean; h: RowHandlers }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (!grouped) return <Rows items={shown.flatMap((g) => g.items)} h={h} />;
  return (
    <div className="flex flex-col gap-8">
      {shown.map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`} className="flex flex-col gap-3">
          <h2 id={`group-${g.id}`} className="flex items-baseline gap-2 px-1 text-h3 text-ink">
            {g.label}
            <span className="iv-num text-small font-medium text-ink-3">{g.items.length}</span>
          </h2>
          <Rows items={g.items} h={h} />
        </section>
      ))}
    </div>
  );
}

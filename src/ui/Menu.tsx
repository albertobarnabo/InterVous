"use client";

import { Menu as HMenu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactElement } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";

export type MenuEntry =
  | {
      label: string;
      icon?: LucideIcon;
      /** Called on click or Enter. */
      onSelect?: () => void;
      /** Renders the item as a link instead. */
      href?: string;
      danger?: boolean;
      disabled?: boolean;
      /** Shortcut hint shown on the right, e.g. "m". */
      hint?: string;
    }
  | "separator";

export type MenuProps = {
  items: MenuEntry[];
  /** Accessible name of the default "⋯" trigger. */
  label?: string;
  /** Custom trigger element. It must accept a ref and props (Button, IconButton, a plain <button>). */
  trigger?: ReactElement;
  anchor?: "bottom start" | "bottom end" | "top start" | "top end";
  className?: string;
};

const itemClass =
  "group flex w-full cursor-default items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-small select-none " +
  "data-focus:bg-surface-2 data-disabled:opacity-50 pointer-coarse:min-h-11";

/** Headless UI Menu. Defaults to a "⋯" icon trigger. */
export function Menu({ items, label = "More actions", trigger, anchor = "bottom end", className }: MenuProps) {
  const withIcons = items.some((it) => it !== "separator" && it.icon);
  return (
    <HMenu>
      <MenuButton as={Fragment}>{trigger ?? <IconButton label={label} icon={MoreHorizontal} />}</MenuButton>
      <MenuItems
        anchor={{ to: anchor, gap: 4, padding: 8 }}
        transition
        modal={false}
        className={cx(
          "z-30 min-w-48 rounded-md bg-surface p-1 shadow-2 ring-1 ring-line focus:outline-none",
          "origin-top transition duration-[120ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100",
          className,
        )}
      >
        {items.map((it, i) => {
          if (it === "separator") return <MenuSeparator key={`sep-${i}`} className="my-1 h-px bg-line" />;
          const Icon = it.icon;
          const content = (
            <>
              {Icon ? (
                <Icon aria-hidden size={16} strokeWidth={1.75} className={cx("shrink-0", it.danger ? "text-danger" : "text-ink-3")} />
              ) : withIcons ? (
                // the icon slot, so labels line up when other items have an icon
                <span aria-hidden className="size-4 shrink-0" />
              ) : null}
              <span className="flex-1">{it.label}</span>
              {it.hint ? <span className="font-mono text-caption text-ink-3">{it.hint}</span> : null}
            </>
          );
          return (
            <MenuItem key={`${it.label}-${i}`} disabled={it.disabled}>
              {it.href ? (
                <Link href={it.href} className={cx(itemClass, it.danger ? "text-danger" : "text-ink")}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={it.onSelect} className={cx(itemClass, it.danger ? "text-danger" : "text-ink")}>
                  {content}
                </button>
              )}
            </MenuItem>
          );
        })}
      </MenuItems>
    </HMenu>
  );
}

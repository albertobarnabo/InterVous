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
  "group flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-body select-none sm:text-[15px] " +
  "data-focus:bg-ink/[0.06] data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11";

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
          "iv-glass-thick z-30 min-w-52 rounded-[16px] p-1.5 shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_40px_rgba(15,23,42,0.16)] focus:outline-none",
          "origin-top transition duration-[120ms] ease-out data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100",
          className,
        )}
      >
        {items.map((it, i) => {
          if (it === "separator") return <MenuSeparator key={`sep-${i}`} className="mx-2 my-1 h-px bg-ink/[0.08]" />;
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
              {it.hint ? <span className="text-caption text-ink-3">{it.hint}</span> : null}
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

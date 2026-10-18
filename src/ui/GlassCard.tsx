import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/**
 * glass  regular glass (58% white): cards, tiles, lists
 * thick  78% white: overlays, or a card with a lot of small text
 * solid  88% white: long text you read (job descriptions, notes, answers)
 */
export type GlassMaterial = "glass" | "thick" | "solid";
export type GlassPadding = "none" | "sm" | "md" | "lg";

const materials: Record<GlassMaterial, string> = { glass: "iv-glass", thick: "iv-glass-thick", solid: "iv-glass-solid" };
const paddings: Record<GlassPadding, string> = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" };

/** Class string for a glass surface, for elements that are not a GlassCard. radius: card 20px, sheet 28px. */
export function glassClass(material: GlassMaterial = "glass", radius: "card" | "sheet" = "card", className?: string) {
  return cx(materials[material], radius === "sheet" ? "rounded-xl" : "rounded-lg", className);
}

const lift =
  "cursor-pointer transition-[translate,box-shadow,background-color] duration-150 ease-out hover:-translate-y-px " +
  "hover:bg-white/70 hover:shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_36px_rgba(15,23,42,0.12)] " +
  "active:translate-y-0 motion-reduce:hover:translate-y-0";

export type GlassCardProps = {
  as?: "div" | "section" | "article" | "aside" | "li" | "header" | "ul" | "ol" | "form";
  material?: GlassMaterial;
  padding?: GlassPadding;
  /** card = 20px corners (default), sheet = 28px. */
  radius?: "card" | "sheet";
  /** Hover lift and pointer, for a card that is clickable as a whole. */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

/**
 * The glass card. Group related rows inside ONE card (rows stay plain), rather than a card per
 * row: fewer blurred layers, calmer page.
 *   <GlassCard padding="md">…</GlassCard>
 *   <GlassCard material="solid">{jobDescription}</GlassCard>
 */
export function GlassCard({
  as: Tag = "div",
  material = "glass",
  padding = "md",
  radius = "card",
  interactive,
  className,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <Tag className={cx(glassClass(material, radius), paddings[padding], interactive && lift, className)} {...rest}>
      {children}
    </Tag>
  );
}

export type GlassCardLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  material?: GlassMaterial;
  padding?: GlassPadding;
  radius?: "card" | "sheet";
  className?: string;
};

/** A whole glass card that is a link (hover lift, pointer). */
export function GlassCardLink({ material = "glass", padding = "md", radius = "card", className, ...rest }: GlassCardLinkProps) {
  return <Link className={cx(glassClass(material, radius), paddings[padding], lift, "block", className)} {...rest} />;
}

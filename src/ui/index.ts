// InterVous primitives. Import from "@/ui". Light only, Apple-style glass (src/app/globals.css).
//
// WHICH ONE TO USE
//   Page frame      <div className="iv-page"> … </div>   (16px gutter on phones, 1120px max)
//   Page top        <PageHeader title="Applications" description="One plain sentence." actions={<Button …/>} />
//   Section         <Section title="Do this now" description="…" action={<Button size="sm" …/>}> … </Section>
//   Card            <GlassCard padding="md"> … </GlassCard>          regular glass (58% white, blur 24px)
//                   <GlassCard material="solid"> … </GlassCard>      long text: job description, notes (88% white)
//                   <GlassCardLink href="…"> … </GlassCardLink>      a whole card that is a link
//                   glassClass("glass" | "thick" | "solid", "card" | "sheet")  for any other element
//                   Put a list's rows inside ONE GlassCard (rows plain, divided by `divide-y divide-ink/[0.06]`),
//                   not a card per row.
//   Buttons         <Button variant="primary">Mark as sent</Button>     solid teal capsule: THE main action
//                   <Button>Update</Button>                              secondary: glass capsule (default)
//                   <Button variant="quiet">Cancel</Button>              text button
//                   <Button variant="danger">Delete</Button>             real deletes only
//                   size "sm" (32px) | "md" (40px, default) | "lg" (48px); icon={Plus}; loading
//                   <ButtonLink href="…">Open</ButtonLink>, <IconButton label="Copy" icon={Copy} />,
//                   buttonClass(variant, size) for other elements. All have cursor:pointer.
//   Filter          <SegmentedControl aria-label="Show" value={v} onChange={setV}
//                     options={[{ value: "all", label: "All", count: 23 }, …]} />
//   Numbers         <StatTile value={10} label="Waiting for a reply" href="/applications?show=waiting" />
//   To-do card      <ActionCard text="European Central Bank hasn't replied in 16 days. A short follow-up can help."
//                     company={{ name, logoUrl }} action={{ label: "Copy follow-up", onClick }} />   one sentence, one button
//   Steps strip     <Steps items={["Add a job (paste the link)", "Mark it as sent", "Tell InterVous what happened"]} />
//   Status          <StatusPill status={app.phase} />   plain words: Not sent · Sent · waiting · In process ·
//                   Interview · Offer · Rejected · No reply · Withdrawn · Not applying. Text: statusLabel(phase).
//                   (PhasePill phase={…} is the same pill under its old name.)
//   Logos           <Logo name="Apple" logoUrl={company.logo_url} size={40} />   initials on a soft tint when missing
//                   (CompanyMark is the same component.) <Avatar url={…} label={email} /> for people.
//   Empty           <EmptyState icon={Inbox} title="Nothing to do today." body="…" action={…} />
//   Overlays        Dialog, Sheet (glass, 28px corners), ConfirmDialog (real deletes), Menu, Popover, Tooltip
//   Feedback        useToast().show({ text, action: { label: "Undo", run } })
//   Forms           <Field label="Company"><Input /></Field>, Textarea, DateInput, Select, Combobox
//
// TEXT: body 16px; secondary text (text-small, 14px) in text-ink-2; labels never under 13px (text-caption).
// Long text: className="iv-reading" on a GlassCard material="solid". Numbers: "iv-num" (tabular figures).
export { cx } from "./cx";
export { Button, ButtonLink, IconButton, buttonClass } from "./Button";
export type { ButtonProps, ButtonLinkProps, IconButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { GlassCard, GlassCardLink, glassClass } from "./GlassCard";
export type { GlassCardProps, GlassCardLinkProps, GlassMaterial, GlassPadding } from "./GlassCard";
export { PageHeader, Section, Steps } from "./Section";
export type { PageHeaderProps, SectionProps, StepsProps } from "./Section";
export { StatTile, ActionCard } from "./Cards";
export type { StatTileProps, ActionCardProps, ActionCardAction } from "./Cards";
export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";
export { Kbd } from "./Kbd";
export { Field, Input, Textarea, DateInput, controlClass } from "./Field";
export type { FieldProps } from "./Field";
export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";
export { Combobox } from "./Combobox";
export type { ComboboxProps } from "./Combobox";
export { Menu } from "./Menu";
export type { MenuProps, MenuEntry } from "./Menu";
export { Popover, PopoverClose } from "./Popover";
export type { PopoverProps } from "./Popover";
export { Tabs, TabPanel } from "./Tabs";
export type { TabsProps, TabItem, TabPanelProps } from "./Tabs";
export { SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentedOption } from "./SegmentedControl";
export { Chip, Tag } from "./Chip";
export type { ChipProps } from "./Chip";
export { Dialog, Sheet, ConfirmDialog } from "./Dialog";
export type { DialogProps, SheetProps, ConfirmDialogProps } from "./Dialog";
export { ToastProvider, useToast } from "./Toast";
export type { ToastInput, ToastKind } from "./Toast";
export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { Skeleton, SkeletonRow } from "./Skeleton";
export { Callout } from "./Callout";
export type { CalloutProps } from "./Callout";
export { StatusPill, PhasePill, PhaseDot } from "./PhasePill";
export type { StatusPillProps, PhasePillProps, PhaseDotProps } from "./PhasePill";
export { STATUS_LABEL, statusLabel, statusVars, PHASE_LABEL, phaseLabel, phaseVars } from "./phase";
export { CompanyMark, Logo, initials } from "./CompanyMark";
export type { CompanyMarkProps, LogoProps } from "./CompanyMark";
export { DotStrip, DOT_STATE_LABEL } from "./DotStrip";
export type { DotStripProps, DotItem, DotState } from "./DotStrip";
export { AgeBar } from "./AgeBar";
export type { AgeBarProps } from "./AgeBar";
export { RangeBar } from "./RangeBar";
export type { RangeBarProps } from "./RangeBar";
export { WeekBars } from "./WeekBars";
export type { WeekBarsProps } from "./WeekBars";
export {
  OPEN_PALETTE,
  OPEN_NEW_APPLICATION,
  OPEN_SHORTCUTS,
  FOCUS_SEARCH,
  AVATAR_CHANGED,
  openPalette,
  openNewApplication,
  openShortcuts,
  focusSearch,
  onShellEvent,
  isTypingTarget,
} from "./events";
export { BrandMark } from "./BrandMark";

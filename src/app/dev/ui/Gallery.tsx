"use client";

import { CalendarCheck, Copy, Inbox, Mail, Plus, Send, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  ActionCard,
  AgeBar,
  Avatar,
  Button,
  ButtonLink,
  Callout,
  Chip,
  Combobox,
  CompanyMark,
  ConfirmDialog,
  DateInput,
  Dialog,
  DotStrip,
  EmptyState,
  Field,
  GlassCard,
  IconButton,
  Input,
  Kbd,
  Logo,
  Menu,
  PageHeader,
  PhaseDot,
  PhasePill,
  Popover,
  RangeBar,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  SkeletonRow,
  StatTile,
  StatusPill,
  Steps,
  TabPanel,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
  WeekBars,
  phaseVars,
  useToast,
  type DotItem,
} from "@/ui";
import { PHASES, type Phase } from "../../../../lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard as="section" padding="md" className="flex flex-col gap-4">
      <h2 className="text-h3 text-ink">{title}</h2>
      {children}
    </GlassCard>
  );
}

const COMPANIES = [
  { id: 1, name: "Anthropic" },
  { id: 2, name: "European Central Bank" },
  { id: 3, name: "G-Research" },
  { id: 4, name: "LangChain" },
  { id: 5, name: "PostHog" },
];

const DOTS: DotItem[] = [
  { state: "yes", label: "Apple" },
  { state: "no", label: "OpenAI Codex" },
  { state: "no", label: "G-Research" },
  { state: "waiting", label: "Anthropic" },
  { state: "recent", label: "Cohere" },
  { state: "no", label: "LangChain" },
  { state: "recent", label: "Meta" },
  { state: "waiting", label: "ECB 14417" },
];

const WEEKS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2026, 6, 27 + i * 7);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const built = [0, 1, 2, 1, 6, 0, 2, 1, 0, 3, 1, 3][i];
  const sent = [0, 1, 1, 0, 6, 0, 1, 1, 0, 1, 0, 0][i];
  return { start: iso, series: { built, sent } };
});

function Column() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [view, setView] = useState<string>("all");
  const [model, setModel] = useState<string>("mistral");
  const [company, setCompany] = useState<(typeof COMPANIES)[number] | null>(COMPANIES[1]);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [chip, setChip] = useState(true);

  return (
    <>
      <Section title="Type">
        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink-2">caption 13 · labels only, never smaller</p>
          <p className="text-small text-ink-2">small 14 · secondary text</p>
          <p className="text-body">body 16 / 1.55 · the default</p>
          <p className="iv-reading">reading 17 / 1.65 · You will work with customers to ship production LLM systems, at most 70 characters wide.</p>
          <p className="text-h3">h3 20 · Section title</p>
          <p className="text-h2">h2 26 · Do this now</p>
          <h1 className="text-h1-sm sm:text-h1">h1 34 · Applied AI Architect</h1>
          <p className="iv-num text-figure">10</p>
        </div>
      </Section>

      <Section title="Colour tokens">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {["bg", "surface", "surface-2", "line", "line-strong", "ink", "ink-2", "ink-3", "accent", "accent-soft", "danger", "caution-bg"].map((t) => (
            <div key={t} className="flex flex-col gap-1">
              <span className="h-10 rounded-[10px] shadow-1" style={{ background: `var(--${t})` }} />
              <span className="iv-num text-caption font-normal text-ink-2">--{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Glass cards, stat tiles, action cards">
        <PageHeader
          className="pt-0 sm:pt-0"
          title="Good morning, Alberto"
          description="10 applications are waiting for a reply and 1 is at interview stage."
          actions={<Button variant="primary" icon={Plus}>Add a job</Button>}
        />
        <div className="flex flex-col gap-3">
          <ActionCard
            company={{ name: "Apple" }}
            text="Tell us how your Apple interview went"
            detail="Interview on 12 Oct"
            action={{ label: "Update", onClick: () => toast.show({ kind: "info", text: "Update" }) }}
          />
          <ActionCard
            icon={CalendarCheck}
            text="Did you send the 5 CVs made in October? Confirm them so replies can be tracked"
            action={{ label: "Confirm", onClick: () => toast.show({ kind: "info", text: "Confirm" }) }}
          />
          <ActionCard
            company={{ name: "European Central Bank" }}
            text="European Central Bank hasn't replied in 16 days. A short follow-up can help."
            action={{ label: "Copy follow-up", icon: Copy, variant: "secondary", onClick: () => toast.show({ text: "Copied" }) }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile value={10} label="Waiting for a reply" href="/dev/ui" color={phaseVars("applied").fg} />
          <StatTile value={1} label="Interviews" href="/dev/ui" color={phaseVars("interviewing").fg} />
          <StatTile value={5} label="Not sent yet" href="/dev/ui" color={phaseVars("draft").fg} />
          <StatTile value={7} label="Closed" href="/dev/ui" color={phaseVars("no_reply").fg} />
        </div>
        <GlassCard material="solid" padding="md">
          <p className="iv-reading">
            Solid glass for long text. You will design and ship retrieval systems with our applied research team, own evaluation, and work
            directly with customers in regulated industries.
          </p>
        </GlassCard>
        <Steps items={["Add a job (paste the link)", "Mark it as sent", "Tell InterVous what happened"]} />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Send}>Mark as sent</Button>
          <Button>Log a reply</Button>
          <Button variant="quiet">Snooze</Button>
          <Button variant="danger" icon={Trash2}>Delete</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary">Small</Button>
          <Button size="sm">Secondary</Button>
          <Button size="sm" loading>Saving</Button>
          <Button size="sm" disabled>Disabled</Button>
          <ButtonLink href="/dev/ui" size="sm" variant="quiet">Link</ButtonLink>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label="Copy answer" icon={Copy} />
          <IconButton label="New application" icon={Plus} variant="secondary" />
          <IconButton label="Email" icon={Mail} size="sm" />
          <span className="flex items-center gap-1 text-small text-ink-2">
            <Kbd>⌘K</Kbd> <Kbd>g</Kbd> <Kbd>t</Kbd> <Kbd>?</Kbd>
          </span>
        </div>
      </Section>

      <Section title="Fields">
        <Field label="Company" hint="As written on the posting">
          <Input placeholder="e.g. Anthropic" defaultValue="Apple" />
        </Field>
        <Field label="URL" error="That is not a link. Paste the posting URL.">
          <Input defaultValue="jobs at apple" />
        </Field>
        <Field label="Note">
          <Textarea placeholder="Optional" rows={3} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label="Sent on">
            <DateInput defaultValue="2026-08-30" />
          </Field>
          <Field label="AI model" className="min-w-48 flex-1">
            <Select
              value={model}
              onChange={setModel}
              options={[
                { value: "mistral", label: "Mistral", description: "Fast, cheap" },
                { value: "openai", label: "OpenAI" },
                { value: "deepseek", label: "DeepSeek" },
              ]}
            />
          </Field>
        </div>
        <Field label="Company (combobox)">
          <Combobox
            items={COMPANIES}
            value={company}
            onChange={setCompany}
            getLabel={(c) => c.name}
            getKey={(c) => c.id}
            onCreate={(q) => toast.show({ kind: "info", text: `Would create “${q}”` })}
          />
        </Field>
      </Section>

      <Section title="Menu, popover, tooltip">
        <div className="flex flex-wrap items-center gap-3">
          <Menu
            items={[
              { label: "Snooze 3 days", onSelect: () => toast.show({ kind: "info", text: "Snoozed for 3 days" }) },
              { label: "Not relevant", onSelect: () => toast.show({ kind: "info", text: "Hidden" }) },
              "separator",
              { label: "Open", href: "/dev/ui", hint: "↵" },
              { label: "Delete", danger: true, icon: Trash2, onSelect: () => setConfirm(true) },
            ]}
          />
          <Popover trigger={<Button size="sm">Mark as sent…</Button>} title="When did you send it?">
            {(close) => (
              <div className="flex flex-col gap-3">
                <DateInput defaultValue="2026-10-17" aria-label="Sent on" />
                <Input placeholder="Note (optional)" aria-label="Note" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="quiet" onClick={close}>Cancel</Button>
                  <Button size="sm" variant="primary" onClick={close}>Save</Button>
                </div>
              </div>
            )}
          </Popover>
          <Tooltip content="From status_evidence: “Ashby confirmation email, 30 Aug”">
            <button type="button" className="rounded-sm text-small text-ink underline decoration-ink-3 decoration-dotted underline-offset-4">
              Sent 30 Aug
            </button>
          </Tooltip>
        </div>
      </Section>

      <Section title="Tabs, segmented control, chips">
        <Tabs
          aria-label="Dossier"
          idBase="gallery"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "cv", label: "CV" },
            { id: "posting", label: "Posting" },
            { id: "fit", label: "Fit", count: 7 },
            { id: "answers", label: "Answers", count: 3 },
          ]}
        />
        <TabPanel tabId={tab} idBase="gallery" className="text-small text-ink-2">
          Panel for <span className="font-medium text-ink">{tab}</span>.
        </TabPanel>
        <SegmentedControl
          aria-label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All", count: 23 },
            { value: "waiting", label: "Waiting", count: 10 },
            { value: "interviews", label: "Interviews", count: 1 },
            { value: "not_sent", label: "Not sent", count: 5 },
            { value: "closed", label: "Closed", count: 7 },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Chip selected={chip} onClick={() => setChip((c) => !c)}>Fintech</Chip>
          <Chip>Remote</Chip>
          <Tag tone="caution">Check this</Tag>
          <Tag>Tag</Tag>
          <Tag tone="accent">The CV you sent</Tag>
          <Tag tone="danger">Job post is gone</Tag>
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog(true)}>Dialog</Button>
          <Button onClick={() => setSheet(true)}>Sheet</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Confirm delete</Button>
          <Button
            onClick={() =>
              toast.show({
                text: "Moved Apple to Interviewing",
                action: { label: "Undo", run: () => toast.show({ kind: "info", text: "Undone" }) },
              })
            }
          >
            Toast with Undo
          </Button>
          <Button onClick={() => toast.show({ kind: "error", text: "No application was updated." })}>Error toast</Button>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Log a reply"
          description="Apple · Applied ML Engineer"
          footer={
            <>
              <Button variant="quiet" onClick={() => setDialog(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setDialog(false)}>Save</Button>
            </>
          }
        >
          <Field label="Received on">
            <DateInput defaultValue="2026-10-17" />
          </Field>
        </Dialog>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="New application" description="From link, manual, or paste the JD">
          <div className="flex flex-col gap-4">
            <Field label="Posting URL">
              <Input placeholder="https://jobs.ashbyhq.com/…" />
            </Field>
            <Button variant="primary">Read the posting</Button>
          </div>
        </Sheet>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
          title="Delete this application?"
          body="Its history, CV and answers go with it. This cannot be undone."
          typeToConfirm="Apple"
        />
        <EmptyState icon={Inbox} title="Nothing needs you." body="Last sent 6 days ago." action={<Button size="sm">Open applications</Button>} />
        <Callout title="Before the interview, check">
          Your answer says the EBA parser is in production and quotes 84.7% strict F1. It runs in the lab only; 84.7% is level-overlap F1; strict exact-match is 73.8%.
        </Callout>
        <Callout tone="info">Captured 17 Oct, while building the CV.</Callout>
        <div className="flex flex-col gap-2">
          <Skeleton lines={3} />
          <SkeletonRow />
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <StatusPill key={p} status={p as Phase} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <PhasePill key={p} phase={p as Phase} size="sm" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {PHASES.map((p) => (
            <PhaseDot key={p} phase={p as Phase} />
          ))}
          <span className="text-caption font-normal text-ink-3">hollow:</span>
          <PhaseDot phase="applied" hollow />
          <PhaseDot phase="interviewing" hollow />
        </div>
      </Section>

      <Section title="Logos and avatars">
        <div className="flex flex-wrap items-center gap-3">
          <Logo name="European Central Bank" size={40} />
          <Logo name="G-Research" size={40} />
          <Logo name="Apple" size={40} />
          <Logo name="Mistral AI" size={40} />
          <CompanyMark name="Anthropic" size={56} />
          <CompanyMark name="Globe Inc" logoUrl="/intervous/globe.svg" size={40} />
          <CompanyMark name="Broken logo" logoUrl="/intervous/missing.png" size={56} />
          <Avatar label="alberto@example.com" size={32} />
          <Avatar label="Zoe" size={40} />
        </div>
      </Section>

      <Section title="Data display">
        <div className="flex flex-col gap-1">
          <p className="text-small text-ink">
            <span className="iv-num">1</span> of <span className="iv-num">6</span> applications sent more than 3 weeks ago got a reply.
          </p>
          <DotStrip items={DOTS} legend aria-label="Replies so far" />
        </div>
        <div className="flex flex-col gap-2">
          {[4, 16, 21, 48, 75].map((d) => (
            <AgeBar key={d} days={d} showLabel />
          ))}
          <AgeBar days={null} showLabel />
        </div>
        <RangeBar low={0.12} high={0.31} point={0.2} />
        <WeekBars weeks={WEEKS} />
      </Section>
    </>
  );
}

/** /intervous/dev/ui: every primitive on the glass backdrop (light only). */
export default function Gallery() {
  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-20 px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="iv-glass mx-auto flex h-14 max-w-[calc(var(--content-max)+40px)] items-center justify-between gap-3 rounded-[22px] px-4">
          <p className="text-body font-semibold">Primitives</p>
          <p className="text-small text-ink-2">Light only · glass</p>
        </div>
      </header>
      <div className="iv-page grid grid-cols-1 items-start gap-6 pt-6 lg:grid-cols-2">
        <Column />
      </div>
    </div>
  );
}

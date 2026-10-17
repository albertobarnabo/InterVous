# InterVous v2: build spec

InterVous is Alberto's personal job-application tracker (`/Users/albi/Projects/albertobarnabo.com/apps/InterVous`, Next.js 15 App Router, React 19, Tailwind v4, Supabase, `basePath: '/intervous'`, production `https://albertobarnabo.it/intervous`). This version has four jobs:

1. Show what needs doing today.
2. Show every application, each with its real CV PDF and job description.
3. Give insights that change a decision, and say so when the data is too thin.
4. Give the coding agent a CLI (`intervous`). With it, every CV built from a JD link lands in the tracker without Alberto typing anything.

This spec replaces proposals A, B and C. Engineers build from this file only.

---

## 0. Decisions, and where each comes from

| Area | Decision | Taken from | Why |
|---|---|---|---|
| Home screen | **Today**: a ranked queue of things that need him, each with one action button | A (C is the same idea) | The question he faces every day is "what do I do now", not "show me everything". |
| One application | **Dossier page** with a 5-step stepper, a "before the interview, check" callout, an inline question for any unconfirmed fact, the JD with highlighted requirements, the real PDF, and answers with a Copy button | B for content, A/C for tabs | B's content is the richest. Tabs (one panel visible at a time) fit his "one concept per screen" rule better than B's long chapter scroll. |
| List | Grouped list (In interviews / Waiting / Not sent / Closed), each row with a plain "now" sentence and an age bar. Board as a secondary view | B, with A's dnd-kit board | The sentence answers "where is this" without reading columns. |
| Visual | Warm paper background, teal accent `#1A6B6B` (the CV's colour), Geist Sans for the UI, Source Serif 4 for reading, Geist Mono for numbers | B, with A/C's font fix | The tracker and the CV look like one system. Serif makes long JDs and answers readable. |
| Schema | `jobs` stays the application row, gains a `phase` column, and keeps legacy `status`/`stage` in step through a trigger. Child tables: events, documents, answers, fit items, proof points, contacts. One atomic RPC writes everything | A's migration (it was already tested), extended with B's ideas: per-application wording of each proof point, canonical proof facts, gap states, JD anchors, nullable answers | A's migration had been run twice against Supabase Postgres 17. I re-tested the merged version (section 4.4). |
| Insights | Counts and dots until the sample can carry a percentage; comparisons only when the intervals do not overlap | A's thresholds + C's interval-overlap rule + B's "what did you tell each company" number check | A "17% reply rate" built on 1 of 6 is noise presented as a fact. |
| CLI | Flat verbs (`add`, `sent`, `log`, `move`, ...) on top of the existing `cli/intervous.mjs`. A manifest file on disk per application is the source of truth. A refresh lock. Login only from a TTY | A for commands, B for the manifest, C for TTY-only login and the `find`/`sent` shortcuts | The agent writes one JSON file and makes one call. Alberto alone ever types a password. |
| Primitives | Headless UI (already installed) for dialogs, menus, listbox, combobox and tabs. `@dnd-kit` for drag. `pdfjs-dist` with the worker served from `public/` | A/B | One new dependency fewer than Radix plus cmdk. The worker path works under `basePath`. |
| Live updates | Refetch when the tab regains focus (required), plus Realtime on `jobs`, `job_events` and `job_documents` (the migration adds the publication when one exists) | A + B | A CLI write shows up without a manual reload. |

Left out on purpose: match scores, success probabilities, streaks, KPI tile walls, donut charts, salary averages, "applications this month".

---

## 1. Facts verified on 2026-10-17

These were checked read-only through the existing CLI session and a local Postgres container. They change the plan.

1. **The live `jobs` table already holds 22 rows.**
   - 5 are legacy: ids 91, 121, 122, 125 and 126.
   - 17 came from the history, ids 127–143. An earlier, unreviewed `intervous import` run inserted them using only the base columns.
   - That run imported the **6 drafts as `Active / Screening`, with `application_date` set to the date the CV was built.** Today the old UI shows them as sent. The import (section 7) fixes this.
   - ECB TIN (id 134) has `application_date = 2026-09-24`, but the history has no applied date.
   - ECB 14896 (not applied) is not in the table.
   - Ids 133 (AI Futures), 134 (ECB TIN) and the legacy row 125 have **empty URLs**, so they cannot be matched by URL. The import adopts rows by explicit id (section 7.2).
2. **An abandoned draft migration is in the repo.** `supabase/migrations/20261017_application_dossier.sql` is untracked. Its `job_events` table has a different shape, and it adds columns `external_key`, `screening`, `jd_text` and others. **It was never run**: `jobs.external_key` and `public.job_events` do not exist live.
   - WP1 deletes the file.
   - The v2 migration refuses to run if a `job_events` with the old shape exists, so running the draft by mistake cannot silently break things.
3. **The CLI has an uncommitted diff.** `cli/intervous.mjs` has +224 lines: `schema`, `import`, `feedback` and `events`, written against the abandoned schema. WP3 replaces them. The generic commands `login`, `logout`, `whoami`, `status`, `jobs`, `companies`, `db`, `storage` and `export` stay.
   - The CLI is already symlinked at `~/.local/bin/intervous`.
   - Its session lives in `~/.config/intervous/session.json`, with `autoRefreshToken:false`.
4. **Read-only checks returned:** `application_date` comes back as `'YYYY-MM-DD'`, and `jobs.id` is an integer. The exact column types still come from the preflight (4.1).
5. **Local Node is v26.1.0.** `tsconfig.json` already has `allowJs: true`.
6. **Contrast.** Every colour pair in section 3 was computed and passes WCAG AA, 4.5:1 or better.

---

## 2. Information architecture

All routes sit under `/intervous`. The authenticated pages live in the route group `src/app/(app)/` and share one layout. That layout runs a single auth guard (redirect to `/login`), the app shell and the command palette. `/` and `/dashboard` redirect to `/today`, and the old dashboard bookmarks keep working.

**Shell**
- On desktop (1024px and wider), a 56px sticky top bar holds the logo, then **Today · Applications · Insights · Companies**, then a ⌘K trigger, then the avatar menu (Proof points, Settings, Sign out).
- On mobile (under 768px), a bottom tab bar holds Today, Applications, Insights and More.
- No hero banners and no background blobs. Each page has one title and at most one supporting line.

### 2.1 `/today`: what needs you now

```
Today · Sat 17 Oct
11 sent · 1 interviewing · 6 not sent · last sent 6 days ago        (one line, computed)

Needs you (n)
 ● Apple · Applied ML Engineer          Interview outcome not recorded
   Round 1 invite 3 Sep · nothing logged for 44 days        [Log outcome]   ⋯
 ● 5 applications, no reply for 48 days                     [Review]        ⋯
 ● Confirm 16 facts the history is unsure about             [Start]         ⋯
 ● OpenAI · Digital Natives (not sent)  Posting is gone · a Munich version is open
 ● AI Futures · Senior AI Product Eng.  CV built 32 days ago, not sent  [Send or drop]
Coming up        interviews in the next 7 days · drafts closing in 14 days or less
Recently added   the last 3 CLI writes, each with a CV thumbnail and "added by the agent 2h ago"
Replies so far   ●○○○○○  1 of 6 old enough to judge  ·  4 too recent     → Insights
```

- **Each row** shows a phase dot, the company and role, one plain reason sentence, the evidence (a date and an age), and one verb button. The ⋯ menu holds "Snooze 3 days", "Not relevant" and "Open".
- **Resolving a row** collapses it and shows a 5-second Undo toast instead of a confirm dialog.
- **Snooze and "Not relevant"** are stored per viewer in `localStorage` under `iv.today.dismissed`, as `{itemKey: untilISO}`. They are wrapped in try/catch, and the page works without them.
- **The confirm flow** asks one question at a time: "Did you send Anthropic · Applied AI Architect on 30 Aug? [Yes] [Different date] [No, not sent]". Each answer writes the field, removes it from `uncertain`, and writes an event.
- **Empty state:** "Nothing needs you. Last sent 6 days ago."
- **The queue rules** live in `lib/core/today.mjs`, shared with `intervous today` (section 5.3).

### 2.2 `/applications`: where everything stands

- **Header:** the title, a sample line ("18 tracked · 11 sent · 1 in interviews"), search (`/` focuses it), "New", and a List | Board switch that lives in the URL as `?view=board`.
- **Filter chips:** phase group, role family, "Needs visa" and "Has unconfirmed facts". All of them live in the URL query.
- **List** (the default). Groups appear in reading order, each with a count:
  1. **In interviews** (interviewing, offer)
  2. **Waiting** (applied, screening), longest wait first. Each row has a thin age bar on a 0–60 day scale, with ticks at 21 days ("old enough to judge") and 45 days ("likely closed").
  3. **Not sent** (draft), newest CV first
  4. **Closed** (rejected, no reply, withdrawn, skipped), collapsed by default
  5. **Older records**: rows applied before `campaign_start` (2026-08-01), collapsed, with the label "From the old tracker, incomplete"
- **Rows** are 64px tall, and each one is a single `<a>` to the dossier. From left to right a row shows:
  - a 32px company mark
  - the role (16px, weight 500), with company and location underneath (14px)
  - the **now sentence** (below)
  - the date
  - a phase pill
  - "Unconfirmed" and "Visa" chips where they apply

  No essential control is hidden behind hover.
- **Board.** The columns are Not sent | Sent | In process | Interviewing | Offer | Closed (n). Closed starts collapsed.
  - Drag uses `@dnd-kit`, with pointer, touch and keyboard support.
  - Every card also has a "Move to…" menu.
  - Dropping a card opens a popover with a date (default today) and an optional note, then inserts a `job_events` row of kind `phase_change` with `to_phase` set. The database moves the phase. Undo deletes that event and restores the previous phase.
- **Mobile.** Rows become two-line cards, and the filters collapse into one "Filter" sheet.
- **No pagination.** About 100 rows render fine. Reads are paged with `.range()` in 500-row pages.

**Now sentence** (`lib/core/now.mjs`, deterministic):

| Phase | Sentence |
|---|---|
| draft | "CV built {n} days ago. Not sent." When `posting_live = false`, add: " The posting is gone." |
| applied or screening, no reply | "Sent {n} days ago. No reply yet." When n is 45 or more: "No reply after {n} days." When `applied_on` is null: "Sent, date unknown." |
| applied or screening, replied | "Sent {date}. They replied {date}." |
| interviewing | "{last event title}, {date}." When the last event is more than 14 days old: "Nothing logged since {date}." |
| offer, rejected, no_reply, withdrawn | "{Phase label} on {date of the phase change}." |
| skipped | "Decided not to apply." |

### 2.3 `/applications/[ref]`: the dossier

`ref` is a slug, or a numeric id for legacy rows. The same route is used for both, at `/applications/<slug>`. The `intervous open` command prints this URL.

**Header** (always visible):
- "← Applications", then a 48px company mark and the company name.
- The **role as h1** in serif, 34px.
- A fact line: "London, UK · hybrid · via Ashby · visa needed · $230K–385K".
- The phase pill and the now sentence.
- **A primary action that depends on the phase:**
  - draft: "Mark as sent" (a date popover) and "Drop it"
  - applied or screening: "Log a reply" and "Mark no reply"
  - interviewing: "Log interview" and "Record outcome"
- The next action, as an editable line with a due date.
- **Unconfirmed facts** get a dotted underline and an inline question, for example "Did you send this on 30 Aug? Yes / Different date / No". The tooltip shows `status_evidence`.
- **"Before the interview, check"** is an amber callout. It appears when the phase is interviewing, or when there is an interview within 7 days, and the application has `caution` fit items or uses proof points whose status is not `verified`. Example for ECB 14417: "Your answer says the EBA parser is in production and quotes 84.7% strict F1. It runs in the lab only; 84.7% is level-overlap F1; strict exact-match is 73.8%."

**Stepper.** Five steps: CV built → Sent → First reply → Interviews → Outcome.
- Each step shows its date.
- The space between two steps shows the day count, for example "44 days".
- On load it fills up to the current step in 300ms.
- Steps not yet reached are outlined.

**Tabs.** The open tab is synced to `?tab=`, and keys `1`–`5` switch between them. One panel is visible at a time.

1. **Overview**
   - A timeline, oldest first so the story reads downward, with arrows marking inbound (←) and outbound (→). A gap of more than 7 days between events shows as a spacer: "— 44 days, nothing —".
   - An "Add event" form.
   - A facts grid: salary as written, visa, channel, role family, seniority asked, years required, CV variant, posting live or closed (with the date it was last checked), closes on, and "last updated {n} ago via CLI/web/import".
   - Contacts, then notes. Notes are markdown, edited in place, and autosaved 800ms after typing stops.
   - At the very bottom, a quiet "Delete application" button. It asks you to type the company name to confirm.
2. **CV**
   - The real PDF, rendered page by page at column width inside a 20px-radius frame, with a page count, a version picker, "Open full size" and "Download". Signed URLs are valid for 10 minutes.
   - A badge shows one of:
     - "Exact file you sent", when `submitted = true`.
     - "Rebuilt on 11 Oct; the version you sent on 30 Aug may differ", when `submitted` is null.
     - "No CV on file". The ECB portal applications have no CV file.
3. **Posting**
   - The JD snapshot, rendered from markdown in serif at 18px, wrapped at 68 characters.
   - A banner states where the snapshot came from, choosing one of:
     - "Captured 17 Oct, while building the CV."
     - "Captured 17 Oct, after you applied."
     - "The posting is gone. This snapshot is all that's left."
     - "No snapshot saved. The posting is still online: [open]" (or "…is gone").
   - A JD sentence that contains a fit item's `anchor_text` is underlined: teal for met or partial, amber for gap. Hovering or focusing the underline shows that fit item in a popover.
   - The text starts at 14 lines with a fade and a "Read the full posting" button.
4. **Fit**
   - **"What they asked and what you showed":** each met or partial item, with its evidence and proof-point chips. A chip opens `/proof-points#key`.
   - **"Gaps":** each gap with an inline-editable state chip. The states are: Real gap / Worded around it / Left off on purpose / No longer a gap.
   - **"Claims to check":** the caution items.
5. **Answers**
   - One row per question: the question, a character count against the limit (for example "1,184 / 1,200"), and Copy (key `c`).
   - Expanding a row shows the answer in serif.
   - When `answer` is null, the row says "Given in chat on 1 Oct, not saved" and offers "Paste it", which edits in place.

Layout:
- Desktop: a 720px reading column plus a 280px side column holding the facts and the next action, shown on the Overview tab.
- Tablet: the facts sit under the header.
- Mobile: a single column, with the tabs as a horizontally scrolling segmented control.

### 2.4 `/insights`

- One vertical column. The page opens with a computed intro line, for example: "Based on 11 sent applications, 6 of them old enough to judge. Too few for percentages, so most answers are counts."
- A "Window" toggle switches between "Since 1 Aug 2026" (`campaign_start`, the default) and "All". Older records are always shown in their own block, labelled "incomplete, not comparable".
- Each section has:
  - the question as h2
  - a one-sentence answer
  - one visual
  - a **What to do** line
  - a **How this is counted** disclosure, giving the formula and n
- The definitions are in section 5.

### 2.5 `/companies`

- All current features stay: search, tags, grid or list, the A–Z rail, add and edit, Tavily auto-fill, and the `?company=` deep link.
- The page is restyled with the new primitives.
- The heading becomes "Companies", with the subtitle "Companies you've applied to or are watching".
- The gradient cards become plain cards.
- The detail slide-over lists "Your applications here", joined by `jobs.company_id` with a fallback to the name. Each entry is a row linking to its dossier.
- The logged-out blank page is fixed by the shared auth guard.
- The logo map is fetched only for companies that appear in his jobs, which removes the silent 1000-row truncation.

### 2.6 `/proof-points`

- A table with one row per proof point: name, metric, canonical facts, status (verified / needs care / unverified), caveat, and usage chips (one per application).
- Metric, status and caveat are editable inline.
- Each row expands to **"What you told each company"**: every application with its `detail` wording. A difference is flagged when the same kind of number differs (see insight I7).

### 2.7 `/settings`

Sections:
- **API keys:** the current `KeysPanel` content, inline.
- **Avatar.**
- **AI model for "From link":** moved here from the dashboard filter bar, and stored in `localStorage` under `iv.scrapeModel`.
- **Thresholds:** the `user_settings` row.
- **Command line:**
  - The text: "Run `intervous login` once in Terminal. The CLI acts as you, under the same access rules."
  - The time of the last CLI write: `max(updated_at)` where `source = 'cli'`, or the newest event where `source = 'cli'`.
  - The last 5 CLI events.

### 2.8 Command palette and keys

- **⌘K** opens a Headless UI `Combobox` in a `Dialog`. It searches applications (company, role, slug), companies and actions ("Mark … as sent", "Log a reply for …", "New application", "Go to …").
- **Global keys:** `g t` / `g a` / `g i` / `g c` go to a page, `n` starts a new application, `/` focuses search, `?` opens the shortcut sheet, and `Esc` closes any dialog.
- **In lists:** `j`/`k` move, `Enter` opens, and `m` opens the move menu.

### 2.9 New application (web)

- A sheet with three modes:
  - **From link:** the existing scrape route.
  - **Manual.**
  - **Paste JD:** stores the pasted text as `jd_snapshot`.
- All three write `phase`.
- Errors are parsed from the JSON `{error}`, never shown as raw text.

---

## 3. Visual system

### 3.1 Remove

- Glass classes, the 5 radial-gradient backgrounds, the pulsing blobs, `background.png`, every `backdrop-blur` except the palette scrim, and the blue→indigo gradient buttons.
- `font-black` and `font-extrabold`, 10–11px text, and uppercase tracked labels.
- The dead classes `animate-in*`, `custom-scrollbar` and `border-gradient-futuristic`.
- The packages `daisyui`, `flowbite-react` (with its `@plugin` line, `postinstall` and `.flowbite-react/`), `heroicons`, `react-icons` and `@supabase/ssr`. Icons come from `lucide-react` only. The 117 inline SVGs are replaced.
- The 7 copies of the stage maps, 3 of `formatDate`, 4 of the status helpers, and 2 of the gradient tile. Replace them with `lib/core/phases.mjs`, `lib/core/dates.mjs` and `src/ui/CompanyMark.tsx`.

### 3.2 Fonts

`next/font/google` loads three fonts:
- **Geist** for the UI, variable `--font-geist-sans`.
- **Source Serif 4** for reading surfaces: the dossier h1, the JD and answers. Variable `--font-serif`.
- **Geist Mono** for dates, day counts and numbers, always with `tabular-nums`. Variable `--font-geist-mono`.

The variable classes go on **`<html>`**, not `<body>`. That placement is today's bug: the intended font never loads. Then add:

```css
@theme inline {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui;
  --font-serif: var(--font-serif), Georgia, serif;
  --font-mono: var(--font-geist-mono), ui-monospace;
}
```

Drop Plus Jakarta Sans.

### 3.3 Type scale

| Token | Size / line height (px) | Weight | Use |
|---|---|---|---|
| caption | 13/18 | 500 | Meta, timestamps. **This is the floor**: nothing smaller, nothing uppercase. |
| small | 14/20 | 400 | Rows, controls |
| body | 16/24 | 400 | Default |
| reading | 18/30 | 400, serif | JD, answers; at most 68ch wide |
| h3 | 20/28 | 600 | Section titles |
| h2 | 26/32 | 600 | Insight questions |
| h1 | 34/40 | 600 | Page title; the dossier h1 is serif. Under 640px: 28/34. |
| figure | 44/48 | 600 mono | The single headline number in an insight, when one is allowed |

Only the weights 400, 500 and 600 are used. Text in SVG charts must be at least 13px at its rendered size, so charts are drawn at container width rather than scaled from a fixed viewBox.

### 3.4 Colour tokens

The tokens are defined on `:root` and mapped in `@theme inline`. Dark mode applies under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. `body` gets an explicit `background: var(--bg)`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F6F5F1 | #15140F | Page |
| `--surface` | #FFFFFF | #1D1C17 | Cards, rows, sheets |
| `--surface-2` | #EFEDE7 | #26241E | Hover, inset |
| `--line` | #E2DFD6 | #34322A | Borders |
| `--line-strong` | #CFCABD | #4A473D | Inputs, dividers |
| `--ink` | #1D1B16 | #EDEAE2 | Primary text |
| `--ink-2` | #4A463D | #BEB9AD | Secondary text (8.6:1) |
| `--ink-3` | #6E695E | #9A9588 | Minimum for any text (5.0:1 on bg, 4.66:1 on surface-2) |
| `--accent` | #1A6B6B | #5FB8AE | Links, primary button, focus ring (5.7:1 on bg) |
| `--accent-ink` | #FFFFFF | #15140F | Text on the accent (6.3:1 and 7.9:1) |
| `--accent-soft` | #E3F0EE | #1F3533 | Selected states |
| `--danger` | #A3302A | #F2A49D | Destructive actions |

**Phase pills** are always a word, never colour alone, and pair an 8px dot with text on a tint. These are the computed contrast ratios:

| Phase (label) | Light text / tint | Ratio | Dark text / tint | Ratio |
|---|---|---|---|---|
| draft ("Not sent") | #5B5648 / #EEECE6 | 6.2 | #C9C4B8 / #2A2822 | 8.5 |
| applied ("Sent") | #2F4FA8 / #E8EDFA | 6.4 | #A9BDF5 / #1E2740 | 8.0 |
| screening ("In process") | #5B3A9A / #EFE9F8 | 7.0 | #C9B3F0 / #2B2340 | 7.9 |
| interviewing | #1A6B6B / #E3F0EE | 5.4 | #7FD0C6 / #16302E | 7.9 |
| offer | #2E6B1F / #E6F2DF | 5.6 | #9BD68A / #1D2E18 | 8.5 |
| rejected | #A3302A / #F8E6E4 | 5.8 | #F2A49D / #3A1F1C | 7.6 |
| no_reply, withdrawn, skipped | #6E695E / #EFEDE7 | 4.7 | #B5B0A4 / #2A2822 | 6.8 |
| caution (callouts) | #8A5A00 / #FBF0D9 | 5.2 | #F0C46A / #3A2E12 | 8.1 |

`scripts/contrast.mjs` re-checks every pair and fails `npm run lint` if any falls below 4.5:1.

### 3.5 Shape, spacing, elevation, layers

- **Spacing:** a 4px base, using 4, 8, 12, 16, 24, 32, 48 and 64.
  - The page gutter is 16px on mobile and 32px on desktop.
  - Content is at most 1120px wide, and the reading column is at most 720px.
  - The page never scrolls horizontally at 375px.
- **Radius:** `--r-sm` 8px for chips, inputs and buttons; `--r-md` 12px for rows and cards; `--r-lg` 20px for sheets, dialogs and the PDF frame; and pills fully rounded. Those are the only values.
- **Elevation:** borders do most of the work.
  - `--shadow-1` is `0 0 0 1px var(--line), 0 1px 2px rgb(29 27 22/.06)`.
  - `--shadow-2` is `0 8px 24px rgb(29 27 22/.10)` and is for overlays only.
- **Z-index:** sticky 10, nav 20, popover 30, dialog/sheet 40, palette 50, toast 60.
  - The top bar becomes a normal sticky bar, so the `pt-20`/`pt-24` modal hacks go.
- **Sizes:** buttons are 36px tall (32px for small); list rows 64px; Today items at least 64px; every touch target at least 44px.

### 3.6 Primitives (`src/ui/`, owned by WP5)

Their props are fixed here so that the screen packages can build against them in parallel.

**Controls**

| Primitive | Props and notes |
|---|---|
| `Button` | `{variant:'primary'\|'secondary'\|'quiet'\|'danger', size:'sm'\|'md', icon?, loading?}` |
| `IconButton` | `{label, icon}`. `label` is required and becomes `aria-label`. |
| `Kbd` | Shows a keyboard key. |
| `Field` | `{label, hint?, error?, children}`. Wires `htmlFor` and `aria-describedby`. |
| `Input`, `Textarea` | Plain inputs. |
| `DateInput` | A native `type=date`. |
| `Select` | A Headless UI `Listbox`. It replaces the native `<select>` and `CustomSelect`. |
| `Combobox` | Headless UI. |
| `Menu` | Headless UI. |
| `Popover` | Headless UI. |
| `Tabs` | `{tabs:[{id,label}], value, onChange}`. URL sync is the caller's job. |
| `SegmentedControl` | |

**Overlays and feedback**

| Primitive | Props and notes |
|---|---|
| `Dialog`, `Sheet` | Headless UI `Dialog`: focus trap, Esc, `aria-modal`, scroll lock. Sheets slide in on mobile. |
| `ConfirmDialog` | `{typeToConfirm?: string}`. Only for real deletes. |
| `Toast` | `useToast().show({kind, text, action?: {label, run}})` with `role="status"` and `aria-live="polite"`. Undo is the `action`. |
| `Tooltip` | |
| `EmptyState` | |
| `Skeleton` | |

**Domain display**

| Primitive | Props and notes |
|---|---|
| `PhasePill` | `{phase}` |
| `PhaseDot` | `{phase}` |
| `CompanyMark` | `{name, logoUrl?, size}`. Logo with `object-contain`, else initials on a muted tint. |
| `DotStrip` | `{items:[{state:'yes'\|'waiting'\|'no'\|'recent'\|'unconfirmed', label, href?}]}`. **It has no percentage prop.** Percentages are rendered by `InsightSection` only when `lib/core/stats.mjs` allows them. |
| `AgeBar` | `{days, max=60, ticks=[21,45]}` |
| `RangeBar` | `{low, high, point}` for Wilson intervals. |
| `WeekBars` | `{weeks:[{start, series:{built,sent}}]}` |

### 3.7 Motion

Motion uses the `motion` package. Under `prefers-reduced-motion`, everything becomes an opacity change of 100ms or less. Nothing loops or pulses.

| What | Timing |
|---|---|
| Hover and press | 120ms ease-out |
| Today row resolved | The check fills in 120ms, the row height collapses in 220ms, the rows below slide up, and the counter tweens. |
| List row changes group after a phase change | `layout` animation, spring stiffness 500, damping 40 |
| List to dossier | View Transition (`document.startViewTransition` when available) on the company mark and role title, `view-transition-name: app-{id}` |
| Stepper fill | 300ms on load and on phase change. The new timeline event slides in. |
| Tabs | Underline slides in 200ms, content fades in 120ms |
| Dialog | Fade plus scale from 0.98 to 1 in 160ms |
| Sheet | 280ms |
| DotStrip | Fills dot by dot with a 30ms stagger, once, when it enters the viewport |
| Timeline | The line draws down in 400ms, once; the silence spans fade in after it |
| Fit ↔ JD | Cross-highlight on hover or focus. This is the dossier's main interactive moment. |

---

## 4. Data model

### 4.1 Preflight (Alberto pastes the output back before running the migration)

```sql
select column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema='public' and table_name='jobs' order by ordinal_position;
select relname, relrowsecurity from pg_class
 where relnamespace='public'::regnamespace and relname in ('jobs','companies','keys','profiles');
select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies
 where schemaname in ('public','storage') order by 1,2,3;
select tgname from pg_trigger where tgrelid='public.jobs'::regclass and not tgisinternal;
select id, public from storage.buckets;
select version();
```

What the output decides:
- **`jobs.id`** must be int4 or int8. The child foreign keys are bigint, and bigint → int4 is allowed.
- **`application_date`** may be text, date or timestamptz. The trigger handles all three.
- **NOT NULL columns.** If any column apart from `id` and `user_id` is NOT NULL, the RPC insert must supply it. Today it supplies `location` and `url` as `''`.
- **Existing triggers on `jobs`** must not conflict with the `iv_*` triggers.
- **Postgres version** must be 15 or later, for the `security_invoker` view.

### 4.2 Model

`jobs` is the application. `phase` is the source of truth, with 9 values:

| Phase | Label |
|---|---|
| draft | "Not sent" |
| applied | "Sent" |
| screening | "In process" |
| interviewing | |
| offer | |
| rejected | |
| no_reply | |
| withdrawn | |
| skipped | |

How the pieces fit:
- **Legacy columns.** `status`, `stage` and `application_date` are derived from `phase` and `applied_on`. When the old UI writes `status` or `stage`, that write sets `phase`, so the old UI keeps working until it is replaced.
- **Events move the phase.** Inserting a `job_events` row infers `to_phase` from its `kind`, and the phase moves unless a newer phase-bearing event exists.
- **Direct edits are logged.** A direct edit of `phase` writes an automatic `phase_change` event. The timeline is therefore a real history, and time in each phase can be computed.
- **Child tables:**
  - `job_documents`: the CV PDF and LaTeX source in a private bucket; the JD inline as markdown.
  - `job_answers`
  - `job_requirements` (fit items: met / partial / gap / caution)
  - `proof_points` (his reusable projects with canonical facts) and `job_proof_points` (which ones each application used, and how they were worded)
  - `contacts`
  - `user_settings`
- **One write path.** `iv_upsert_application(jsonb)` writes everything in one transaction for the CLI and the importer.
- **Value checks.** Values are `text` with CHECK constraints, not enums, so a value can be added later with one statement.

### 4.3 Migration: `supabase/migrations/20261017120000_intervous_v2.sql`

Run once in Supabase Dashboard > SQL Editor. It is additive and safe to re-run. The tested copy is at `/private/tmp/claude-501/-Users-albi-Projects/036f0cf7-89ea-4689-aa4f-859cac04e2f2/scratchpad/ivsql2/20261017120000_intervous_v2.sql`. WP1 copies it into the repo byte for byte, and the test harness goes with it (4.4).

```sql
-- InterVous v2: phases, timeline, documents, answers, fit, proof points, settings.
-- Run once in Supabase Dashboard > SQL Editor (paste the whole file, Run).
-- Additive only and safe to re-run. Existing columns, rows and jobs policies are untouched,
-- except that the legacy status/stage/application_date columns are kept in step by a trigger.

begin;

-- ---------------------------------------------------------------------------
-- 0. Guard: refuse to run on top of the abandoned draft migration
--    (supabase/migrations/20261017_application_dossier.sql created a different job_events).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.job_events') is not null and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'job_events' and column_name = 'direction') then
    raise exception 'public.job_events exists with the old draft shape. Stop and tell the agent; do not drop anything yourself.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. jobs: new columns (nullable or defaulted)
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists phase              text,
  add column if not exists slug               text,
  add column if not exists company_id         uuid references public.companies(id) on delete set null,
  add column if not exists team               text,
  add column if not exists work_mode          text,
  add column if not exists country_code       text,
  add column if not exists channel            text,
  add column if not exists channel_detail     text,
  add column if not exists role_family        text,
  add column if not exists seniority          text,
  add column if not exists years_required     smallint,
  add column if not exists visa_needed        boolean,
  add column if not exists salary_text        text,
  add column if not exists salary_min         numeric,
  add column if not exists salary_max         numeric,
  add column if not exists salary_currency    text,
  add column if not exists salary_period      text,
  add column if not exists applied_on         date,
  add column if not exists cv_built_on        date,
  add column if not exists closes_on          date,
  add column if not exists posting_live       boolean,
  add column if not exists posting_checked_at timestamptz,
  add column if not exists next_action        text,
  add column if not exists next_action_due    date,
  add column if not exists cv_variant         text,
  add column if not exists notes              text,
  add column if not exists status_evidence    text,
  add column if not exists uncertain          text[] not null default '{}',
  add column if not exists source             text not null default 'web',
  add column if not exists last_activity_at   timestamptz,
  add column if not exists created_at         timestamptz,
  add column if not exists updated_at         timestamptz;
-- defaults set separately so pre-existing rows keep NULL (unknown) instead of "now"
alter table public.jobs alter column created_at set default now();
alter table public.jobs alter column updated_at set default now();

alter table public.jobs drop constraint if exists jobs_phase_check;
alter table public.jobs add  constraint jobs_phase_check check (phase is null or phase in
  ('draft','applied','screening','interviewing','offer','rejected','no_reply','withdrawn','skipped'));
alter table public.jobs drop constraint if exists jobs_work_mode_check;
alter table public.jobs add  constraint jobs_work_mode_check check (work_mode is null or work_mode in ('onsite','hybrid','remote'));
alter table public.jobs drop constraint if exists jobs_channel_check;
alter table public.jobs add  constraint jobs_channel_check check (channel is null or channel in
  ('ats','portal','referral','recruiter','linkedin','email','other'));
alter table public.jobs drop constraint if exists jobs_salary_period_check;
alter table public.jobs add  constraint jobs_salary_period_check check (salary_period is null or salary_period in ('year','month','day','hour'));
alter table public.jobs drop constraint if exists jobs_source_check;
alter table public.jobs add  constraint jobs_source_check check (source in ('web','cli','import'));
alter table public.jobs drop constraint if exists jobs_slug_check;
alter table public.jobs add  constraint jobs_slug_check check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,80}$');

create unique index if not exists jobs_user_slug_key on public.jobs (user_id, slug);
create index if not exists jobs_user_phase_idx on public.jobs (user_id, phase);
create index if not exists jobs_company_id_idx on public.jobs (company_id);

-- ---------------------------------------------------------------------------
-- 2. phase <-> legacy status/stage mapping (old UI keeps working)
-- ---------------------------------------------------------------------------
create or replace function public.iv_phase_from_legacy(p_status text, p_stage text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when lower(coalesce(p_status, '')) = 'not applied' then 'draft'
    when lower(coalesce(p_status, '')) in ('inactive', 'rejected', 'closed') then 'rejected'
    when lower(coalesce(p_stage, '')) in ('video interview', 'hr interview', 'technical interview', 'final round') then 'interviewing'
    when lower(coalesce(p_stage, '')) = 'coding assessment' then 'screening'
    else 'applied'
  end
$$;

create or replace function public.iv_legacy_status(p_phase text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_phase in ('draft', 'skipped') then 'Not Applied'
    when p_phase in ('applied', 'screening', 'interviewing', 'offer') then 'Active'
    else 'Inactive'
  end
$$;

create or replace function public.iv_legacy_stage(p_phase text, p_old_stage text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_phase
    when 'draft'        then '-'
    when 'skipped'      then '-'
    when 'applied'      then 'Screening'
    when 'screening'    then case when p_old_stage = 'Coding Assessment' then p_old_stage else 'Screening' end
    when 'interviewing' then case when p_old_stage in ('Video Interview','HR Interview','Technical Interview','Final Round')
                                  then p_old_stage else 'Video Interview' end
    when 'offer'        then 'Final Round'
    else coalesce(nullif(p_old_stage, '-'), 'Screening')   -- closed: keep the furthest stage reached
  end
$$;

create or replace function public.iv_parse_date(s text)
returns date language sql immutable set search_path = public, pg_temp as $$
  select case when s ~ '^\d{4}-\d{2}-\d{2}' then left(s, 10)::date end
$$;

-- one-time backfill of rows that predate this migration (re-runs touch nothing: phase is set)
update public.jobs
   set phase      = public.iv_phase_from_legacy(status, stage),
       uncertain  = case when lower(coalesce(status, '')) = 'inactive'
                         then array(select distinct unnest(uncertain || array['phase'])) else uncertain end,
       applied_on = coalesce(applied_on, public.iv_parse_date(application_date::text))
 where phase is null;

create or replace function public.iv_jobs_before_write()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare bulk boolean := coalesce(current_setting('intervous.bulk', true), '') = 'on';
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    if new.phase is null then
      new.phase := public.iv_phase_from_legacy(new.status, new.stage);
    else
      new.status := public.iv_legacy_status(new.phase);
      new.stage  := public.iv_legacy_stage(new.phase, new.stage);
    end if;
    if new.applied_on is null then
      new.applied_on := public.iv_parse_date(new.application_date::text);
    end if;
  else
    if new.phase is distinct from old.phase then
      new.status := public.iv_legacy_status(new.phase);
      new.stage  := public.iv_legacy_stage(new.phase, old.stage);
    elsif new.status is distinct from old.status or new.stage is distinct from old.stage then
      new.phase := public.iv_phase_from_legacy(new.status, new.stage);   -- old UI wrote status/stage
    end if;
    if new.application_date is distinct from old.application_date and new.applied_on is not distinct from old.applied_on then
      new.applied_on := public.iv_parse_date(new.application_date::text);  -- old UI edited the date
    end if;
  end if;
  if new.phase in ('applied','screening','interviewing','offer') and new.applied_on is null and not bulk then
    new.applied_on := current_date;          -- the importer may legitimately not know the date
  end if;
  -- applied_on is the source of truth; the legacy column mirrors it, including NULL
  if tg_op = 'INSERT' or new.applied_on is distinct from old.applied_on then
    new.application_date := new.applied_on;  -- assignment cast works for date, timestamptz or text
  end if;
  return new;
end $$;

drop trigger if exists iv_jobs_before_write on public.jobs;
create trigger iv_jobs_before_write before insert or update on public.jobs
  for each row execute function public.iv_jobs_before_write();

-- ---------------------------------------------------------------------------
-- 3. per-user settings (thresholds used by Today and Insights)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  follow_up_after_days   int  not null default 14,
  no_reply_after_days    int  not null default 45,
  mature_after_days      int  not null default 21,
  draft_stale_after_days int  not null default 7,
  weekly_target          int  not null default 3,
  timezone               text not null default 'Europe/Berlin',
  campaign_start         date not null default '2026-08-01',
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. child tables
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id       bigint references public.jobs(id) on delete set null,
  company_id   uuid references public.companies(id) on delete set null,
  name         text not null,
  role         text,
  email        text,
  linkedin_url text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists contacts_job_idx on public.contacts (job_id);

create table if not exists public.job_events (
  id             bigint generated always as identity primary key,
  job_id         bigint not null references public.jobs(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind           text not null check (kind in
                   ('cv_built','applied','auto_ack','reply','assessment','interview_scheduled','interview_done',
                    'follow_up_sent','rejection','offer','withdrawn','skipped','posting_closed','phase_change','note')),
  direction      text check (direction in ('in','out','self')),
  occurred_on    date not null default current_date,
  occurred_at    timestamptz,
  date_uncertain boolean not null default false,
  from_phase     text,
  to_phase       text check (to_phase is null or to_phase in
                   ('draft','applied','screening','interviewing','offer','rejected','no_reply','withdrawn','skipped')),
  title          text,
  body           text,
  contact_id     uuid references public.contacts(id) on delete set null,
  source         text not null default 'web' check (source in ('web','cli','import','auto')),
  created_at     timestamptz not null default now()
);
create index if not exists job_events_job_idx on public.job_events (job_id, occurred_on);

create table if not exists public.job_documents (
  id           uuid primary key default gen_random_uuid(),
  job_id       bigint not null references public.jobs(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('cv_pdf','cv_source','jd_snapshot','cover_letter','other')),
  label        text,
  storage_path text,      -- object name in bucket intervous-docs: <uid>/<slug>/<kind>/<sha12>-<file>
  content      text,      -- inline text (JD snapshot as Markdown)
  mime_type    text,
  size_bytes   bigint,
  sha256       text not null,
  source_url   text,
  captured_at  timestamptz,
  submitted    boolean,   -- true: this exact file was sent; null: unknown
  created_at   timestamptz not null default now(),
  constraint job_documents_has_body check (storage_path is not null or content is not null)
);
create unique index if not exists job_documents_dedupe on public.job_documents (job_id, kind, sha256);

create table if not exists public.job_answers (
  id          uuid primary key default gen_random_uuid(),
  job_id      bigint not null references public.jobs(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position    int  not null default 0,
  question    text not null,
  answer      text,           -- NULL = given somewhere (portal, chat) but never saved
  char_limit  int,
  submitted   boolean,
  source_path text,           -- file path, or e.g. 'chat 2026-10-01'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists job_answers_job_idx on public.job_answers (job_id, position);

-- "fit items": what the JD asked and how this application answered it
create table if not exists public.job_requirements (
  id          uuid primary key default gen_random_uuid(),
  job_id      bigint not null references public.jobs(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position    int  not null default 0,
  requirement text not null,
  importance  text check (importance is null or importance in ('required','nice')),
  verdict     text not null check (verdict in ('met','partial','gap','caution')),
  evidence    text,                          -- for met/partial: what was shown; for caution: the correct fact
  topic       text,                          -- lowercase snake_case key, e.g. 'years_experience', 'kubernetes'
  gap_state   text check (gap_state is null or gap_state in ('open','worded_around','not_claimed','no_longer_true')),
  anchor_text text,                          -- exact phrase from the JD, for highlighting
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists job_requirements_job_idx on public.job_requirements (job_id, position);
create index if not exists job_requirements_topic_idx on public.job_requirements (user_id, topic);

create table if not exists public.proof_points (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name          text not null,
  summary       text,
  metric        text,
  facts         jsonb  not null default '{}'::jsonb,  -- canonical true numbers, e.g. {"exact_match":"73.8%"}
  aliases       text[] not null default '{}',
  metric_status text not null default 'verified' check (metric_status in ('verified','needs_care','unverified')),
  caveat        text,
  link          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.job_proof_points (
  job_id         bigint not null references public.jobs(id) on delete cascade,
  proof_point_id uuid   not null references public.proof_points(id) on delete cascade,
  user_id        uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  position       int    not null default 0,
  detail         text,  -- how it was worded in THIS application, e.g. "300+ cases, 93%"
  primary key (job_id, proof_point_id)
);

create or replace function public.iv_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists iv_touch on public.job_answers;
create trigger iv_touch before update on public.job_answers for each row execute function public.iv_touch_updated_at();
drop trigger if exists iv_touch on public.proof_points;
create trigger iv_touch before update on public.proof_points for each row execute function public.iv_touch_updated_at();
drop trigger if exists iv_touch on public.user_settings;
create trigger iv_touch before update on public.user_settings for each row execute function public.iv_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. timeline triggers: an event can move the phase; a direct phase edit logs an event
-- ---------------------------------------------------------------------------
create or replace function public.iv_implied_phase(p_kind text, p_current text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_kind
    when 'applied'             then case when p_current is null or p_current in ('draft','skipped') then 'applied' end
    when 'reply'               then case when p_current = 'applied' then 'screening' end
    when 'assessment'          then case when p_current in ('applied','screening') then 'screening' end
    when 'interview_scheduled' then case when p_current in ('applied','screening') then 'interviewing' end
    when 'rejection'           then 'rejected'
    when 'offer'               then 'offer'
    when 'withdrawn'           then 'withdrawn'
    when 'skipped'             then 'skipped'
  end
$$;

create or replace function public.iv_events_before_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare cur text;
begin
  select phase into cur from public.jobs where id = new.job_id;
  if new.to_phase is null and new.kind <> 'phase_change' then
    new.to_phase := public.iv_implied_phase(new.kind, cur);
  end if;
  if new.to_phase is not null and new.from_phase is null then
    new.from_phase := cur;
  end if;
  if new.direction is null then
    new.direction := case
      when new.kind in ('auto_ack','reply','assessment','interview_scheduled','rejection','offer') then 'in'
      when new.kind in ('applied','follow_up_sent','withdrawn') then 'out'
      else 'self' end;
  end if;
  return new;
end $$;

create or replace function public.iv_events_after_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('intervous.bulk', true), '') = 'on' then return null; end if;
  update public.jobs j set
    phase = case
              when new.to_phase is not null and not exists (
                     select 1 from public.job_events e
                      where e.job_id = new.job_id and e.id <> new.id
                        and e.to_phase is not null and e.occurred_on > new.occurred_on)
              then new.to_phase else j.phase end,
    applied_on = case when new.kind = 'applied' then coalesce(j.applied_on, new.occurred_on) else j.applied_on end,
    last_activity_at = greatest(coalesce(j.last_activity_at, '-infinity'::timestamptz),
                                least(now(), coalesce(new.occurred_at, new.occurred_on::timestamptz)))
  where j.id = new.job_id;
  return null;
end $$;

create or replace function public.iv_jobs_log_phase()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() = 1
     and coalesce(current_setting('intervous.bulk', true), '') <> 'on'
     and new.phase is distinct from old.phase then
    insert into public.job_events (job_id, user_id, kind, from_phase, to_phase, occurred_on, source)
    values (new.id, new.user_id, 'phase_change', old.phase, new.phase, current_date, 'auto');
  end if;
  return null;
end $$;

drop trigger if exists iv_events_before_insert on public.job_events;
create trigger iv_events_before_insert before insert on public.job_events
  for each row execute function public.iv_events_before_insert();
drop trigger if exists iv_events_after_insert on public.job_events;
create trigger iv_events_after_insert after insert on public.job_events
  for each row execute function public.iv_events_after_insert();
drop trigger if exists iv_jobs_log_phase on public.jobs;
create trigger iv_jobs_log_phase after update on public.jobs
  for each row execute function public.iv_jobs_log_phase();

-- ---------------------------------------------------------------------------
-- 6. row-level security: every new table is owner-only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- jobs: only add a policy if the live table has none (never loosen existing ones)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'jobs') then
    execute $p$create policy "jobs own rows" on public.jobs for all to authenticated
             using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$;
    execute 'alter table public.jobs enable row level security';
  elsif not (select relrowsecurity from pg_class where oid = 'public.jobs'::regclass) then
    raise notice 'public.jobs has policies but RLS is DISABLED. Review before enabling.';
  end if;

  foreach t in array array['user_settings','proof_points'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  foreach t in array array['job_events','job_documents','job_answers','job_requirements','job_proof_points'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                     using (user_id = (select auth.uid()))
                     with check (user_id = (select auth.uid()) and exists
                       (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid())))$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  alter table public.contacts enable row level security;
  drop policy if exists "own rows" on public.contacts;
  create policy "own rows" on public.contacts for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (job_id is null or exists
      (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid()))));
  grant select, insert, update, delete on public.contacts to authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- 7. read model for Today, Applications, Insights and the CLI (RLS applies: security_invoker)
-- ---------------------------------------------------------------------------
drop view if exists public.job_overview;
create view public.job_overview with (security_invoker = true) as
select j.id, j.slug, j.user_id, j.company_name, j.company_id, j.role, j.location, j.country_code, j.url, j.phase,
       j.stage, j.channel, j.role_family, j.visa_needed, j.years_required, j.applied_on, j.cv_built_on, j.closes_on,
       j.next_action, j.next_action_due, j.posting_live, j.uncertain, j.last_activity_at, j.created_at, j.updated_at,
       j.source,
       (select min(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.direction = 'in' and e.kind <> 'auto_ack')                   as first_response_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.direction = 'in' and e.kind <> 'auto_ack'
           and e.occurred_on <= current_date)                                                      as last_inbound_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.kind = 'follow_up_sent')                                      as last_follow_up_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.kind <> 'phase_change' and e.occurred_on <= current_date)      as last_event_on,
       (select min(coalesce(e.occurred_at, e.occurred_on::timestamptz)) from public.job_events e
         where e.job_id = j.id and e.kind = 'interview_scheduled'
           and coalesce(e.occurred_at, e.occurred_on::timestamptz) >= date_trunc('day', now()))    as next_interview_at,
       (select count(*) from public.job_requirements r
         where r.job_id = j.id and r.verdict = 'gap'
           and coalesce(r.gap_state, 'open') <> 'no_longer_true')                                  as open_gaps,
       (select count(*) from public.job_requirements r
         where r.job_id = j.id and r.verdict = 'caution')                                          as cautions,
       (select count(*) from public.job_answers a where a.job_id = j.id)                           as answer_count,
       (select count(*) from public.job_answers a where a.job_id = j.id and a.answer is null)      as unsaved_answers,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'cv_pdf')      as has_cv,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'cv_pdf'
                 and d.submitted is true)                                                           as has_sent_cv,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'jd_snapshot') as has_jd
  from public.jobs j;
grant select on public.job_overview to authenticated;

-- ---------------------------------------------------------------------------
-- 8. one atomic write for the CLI and the importer
--    Missing key = keep the stored value. Present key = overwrite (null clears).
--    Present list (requirements/answers/proof_points/contacts) = replace that list,
--    but web edits survive: gap_state and answer text are carried over by matching text.
--    events/documents are append-only and de-duplicated.
-- ---------------------------------------------------------------------------
create or replace function public.iv_upsert_application(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_slug text := nullif(trim(p->>'slug'), '');
  v_company text := nullif(trim(p->>'company'), '');
  v_company_id uuid;
  v_company_canon text;
  v_company_created boolean := false;
  v_job public.jobs%rowtype;
  v_created boolean := false;
  v_adopted boolean := false;
  v_old jsonb;
  v_pp uuid;
  r record;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]{1,80}$' then
    raise exception 'slug is required: lowercase letters, digits and dashes' using errcode = '22023';
  end if;
  perform set_config('intervous.bulk', 'on', true);

  -- company: case-insensitive exact match; create unless company_create = false
  if v_company is not null then
    select id, name into v_company_id, v_company_canon from public.companies
     where lower(trim(name)) = lower(v_company) order by created_at limit 1;
    if found then
      v_company := v_company_canon;            -- keep the stored spelling so the name join works
    elsif coalesce((p->>'company_create')::boolean, true) then
      insert into public.companies (name, website, created_by)
      values (v_company, nullif(p->>'company_website', ''), uid)
      returning id into v_company_id;
      v_company_created := true;
    end if;
  end if;

  -- find the job: by slug; else an explicit job_id to adopt; else a slug-less row with the same URL
  select * into v_job from public.jobs where user_id = uid and slug = v_slug;
  if not found and p ? 'job_id' then
    select * into v_job from public.jobs where user_id = uid and id = (p->>'job_id')::bigint;
    if not found then raise exception 'job % not found', p->>'job_id' using errcode = 'P0002'; end if;
    if v_job.slug is not null and v_job.slug <> v_slug then
      raise exception 'job % already has slug %', v_job.id, v_job.slug using errcode = '23505';
    end if;
    v_adopted := true;
  end if;
  if v_job.id is null and nullif(p->>'url', '') is not null then
    select * into v_job from public.jobs
     where user_id = uid and slug is null and coalesce(url, '') <> ''
       and rtrim(split_part(url, '?', 1), '/') = rtrim(split_part(p->>'url', '?', 1), '/')
     order by id limit 1;
    v_adopted := found;
  end if;

  if v_job.id is null then
    if v_company is null or nullif(p->>'role', '') is null then
      raise exception 'company and role are required for a new application' using errcode = '22023';
    end if;
    insert into public.jobs (user_id, slug, company_name, company_id, role, location, url, phase, source)
    values (uid, v_slug, v_company, v_company_id, p->>'role', coalesce(p->>'location', ''), coalesce(p->>'url', ''),
            coalesce(p->>'phase', 'draft'), coalesce(p->>'source', 'cli'))
    returning * into v_job;
    v_created := true;
  end if;

  update public.jobs j set
    slug               = v_slug,
    company_name       = coalesce(v_company, j.company_name),
    company_id         = coalesce(v_company_id, j.company_id),
    role               = case when p ? 'role'            then p->>'role'                       else j.role end,
    location           = case when p ? 'location'        then coalesce(p->>'location', '')     else j.location end,
    url                = case when p ? 'url'             then coalesce(p->>'url', '')          else j.url end,
    phase              = case when p ? 'phase'           then p->>'phase'                      else j.phase end,
    team               = case when p ? 'team'            then p->>'team'                       else j.team end,
    work_mode          = case when p ? 'work_mode'       then p->>'work_mode'                  else j.work_mode end,
    country_code       = case when p ? 'country_code'    then p->>'country_code'               else j.country_code end,
    channel            = case when p ? 'channel'         then p->>'channel'                    else j.channel end,
    channel_detail     = case when p ? 'channel_detail'  then p->>'channel_detail'             else j.channel_detail end,
    role_family        = case when p ? 'role_family'     then p->>'role_family'                else j.role_family end,
    seniority          = case when p ? 'seniority'       then p->>'seniority'                  else j.seniority end,
    years_required     = case when p ? 'years_required'  then (p->>'years_required')::smallint else j.years_required end,
    visa_needed        = case when p ? 'visa_needed'     then (p->>'visa_needed')::boolean     else j.visa_needed end,
    applied_on         = case when p ? 'applied_on'      then (p->>'applied_on')::date         else j.applied_on end,
    cv_built_on        = case when p ? 'cv_built_on'     then (p->>'cv_built_on')::date        else j.cv_built_on end,
    closes_on          = case when p ? 'closes_on'       then (p->>'closes_on')::date          else j.closes_on end,
    cv_variant         = case when p ? 'cv_variant'      then p->>'cv_variant'                 else j.cv_variant end,
    notes              = case when p ? 'notes'           then p->>'notes'                      else j.notes end,
    status_evidence    = case when p ? 'status_evidence' then p->>'status_evidence'            else j.status_evidence end,
    uncertain          = case when p ? 'uncertain' then coalesce(array(select jsonb_array_elements_text(p->'uncertain')), '{}')
                              else j.uncertain end,
    salary_text        = case when p ? 'salary' then p->'salary'->>'text'                      else j.salary_text end,
    salary_min         = case when p ? 'salary' then (p->'salary'->>'min')::numeric            else j.salary_min end,
    salary_max         = case when p ? 'salary' then (p->'salary'->>'max')::numeric            else j.salary_max end,
    salary_currency    = case when p ? 'salary' then p->'salary'->>'currency'                  else j.salary_currency end,
    salary_period      = case when p ? 'salary' then p->'salary'->>'period'                    else j.salary_period end,
    posting_live       = case when p ? 'posting' then (p->'posting'->>'live')::boolean         else j.posting_live end,
    posting_checked_at = case when p ? 'posting' then (p->'posting'->>'checked_at')::timestamptz else j.posting_checked_at end,
    next_action        = case when p ? 'next_action' then p->'next_action'->>'text'            else j.next_action end,
    next_action_due    = case when p ? 'next_action' then (p->'next_action'->>'due')::date     else j.next_action_due end,
    source             = case when v_created then j.source when p->>'source' = 'import' then 'import' else j.source end
  where j.id = v_job.id
  returning * into v_job;

  if p ? 'requirements' then
    select coalesce(jsonb_agg(jsonb_build_object('k', lower(requirement), 'g', gap_state)), '[]'::jsonb)
      into v_old from public.job_requirements where job_id = v_job.id;
    delete from public.job_requirements where job_id = v_job.id;
    insert into public.job_requirements (job_id, user_id, position, requirement, importance, verdict, evidence,
                                         topic, gap_state, anchor_text, note)
    select v_job.id, uid, (x.ord - 1)::int, x.e->>'requirement', x.e->>'importance', x.e->>'verdict', x.e->>'evidence',
           lower(nullif(x.e->>'topic', '')),
           case when x.e->>'verdict' in ('gap','partial') then coalesce(
                  x.e->>'gap_state',
                  (select o->>'g' from jsonb_array_elements(v_old) o where o->>'k' = lower(x.e->>'requirement') limit 1),
                  'open') end,
           x.e->>'anchor_text', x.e->>'note'
      from jsonb_array_elements(p->'requirements') with ordinality as x(e, ord);
  end if;

  if p ? 'answers' then
    select coalesce(jsonb_agg(jsonb_build_object('q', lower(question), 'a', answer, 's', submitted)), '[]'::jsonb)
      into v_old from public.job_answers where job_id = v_job.id;
    delete from public.job_answers where job_id = v_job.id;
    insert into public.job_answers (job_id, user_id, position, question, answer, char_limit, submitted, source_path)
    select v_job.id, uid, (x.ord - 1)::int, x.e->>'question',
           coalesce(x.e->>'answer', (select o->>'a' from jsonb_array_elements(v_old) o where o->>'q' = lower(x.e->>'question') limit 1)),
           (x.e->>'char_limit')::int,
           coalesce((x.e->>'submitted')::boolean,
                    (select (o->>'s')::boolean from jsonb_array_elements(v_old) o where o->>'q' = lower(x.e->>'question') limit 1)),
           x.e->>'source_path'
      from jsonb_array_elements(p->'answers') with ordinality as x(e, ord);
  end if;

  if p ? 'proof_points' then
    delete from public.job_proof_points where job_id = v_job.id;
    for r in select x.e, x.ord from jsonb_array_elements(p->'proof_points') with ordinality as x(e, ord) loop
      insert into public.proof_points (user_id, key, name, summary, metric, facts, metric_status, caveat, link)
      values (uid, r.e->>'key', coalesce(r.e->>'name', r.e->>'key'), r.e->>'summary', r.e->>'metric',
              coalesce(r.e->'facts', '{}'::jsonb), coalesce(r.e->>'metric_status', 'verified'), r.e->>'caveat', r.e->>'link')
      on conflict (user_id, key) do update set
        name          = case when r.e ? 'name' then excluded.name else proof_points.name end,
        summary       = coalesce(excluded.summary, proof_points.summary),
        metric        = coalesce(excluded.metric, proof_points.metric),
        facts         = proof_points.facts || excluded.facts,
        metric_status = case when r.e ? 'metric_status' then excluded.metric_status else proof_points.metric_status end,
        caveat        = coalesce(excluded.caveat, proof_points.caveat),
        link          = coalesce(excluded.link, proof_points.link)
      returning id into v_pp;
      insert into public.job_proof_points (job_id, proof_point_id, user_id, position, detail)
      values (v_job.id, v_pp, uid, (r.ord - 1)::int, r.e->>'detail') on conflict do nothing;
    end loop;
  end if;

  if p ? 'contacts' then
    delete from public.contacts where job_id = v_job.id;
    insert into public.contacts (user_id, job_id, company_id, name, role, email, linkedin_url, notes)
    select uid, v_job.id, v_job.company_id, e->>'name', e->>'role', e->>'email', e->>'linkedin_url', e->>'notes'
      from jsonb_array_elements(p->'contacts') e;
  end if;

  if p ? 'events' then
    insert into public.job_events (job_id, user_id, kind, occurred_on, occurred_at, date_uncertain, to_phase, title, body, source)
    select v_job.id, uid, e->>'kind', (e->>'on')::date, (e->>'at')::timestamptz,
           coalesce((e->>'date_uncertain')::boolean, false), e->>'to_phase', e->>'title', e->>'body',
           coalesce(p->>'source', 'cli')
      from jsonb_array_elements(p->'events') e
     where not exists (select 1 from public.job_events x
                        where x.job_id = v_job.id and x.kind = e->>'kind' and x.occurred_on = (e->>'on')::date
                          and coalesce(x.title, '') = coalesce(e->>'title', ''));
  end if;

  if p ? 'documents' then
    insert into public.job_documents (job_id, user_id, kind, label, storage_path, content, mime_type, size_bytes,
                                      sha256, source_url, captured_at, submitted)
    select v_job.id, uid, e->>'kind', e->>'label', e->>'storage_path', e->>'content', e->>'mime_type',
           (e->>'size_bytes')::bigint, coalesce(e->>'sha256', md5(coalesce(e->>'content', e->>'storage_path'))),
           e->>'source_url', (e->>'captured_at')::timestamptz, (e->>'submitted')::boolean
      from jsonb_array_elements(p->'documents') e
    on conflict (job_id, kind, sha256) do update set
      label = coalesce(excluded.label, job_documents.label),
      submitted = coalesce(excluded.submitted, job_documents.submitted);
  end if;

  -- last activity = newest event so far (bulk mode skipped the per-event trigger)
  update public.jobs j set last_activity_at = (
    select max(least(now(), coalesce(e.occurred_at, e.occurred_on::timestamptz)))
      from public.job_events e where e.job_id = j.id)
   where j.id = v_job.id
  returning * into v_job;

  perform set_config('intervous.bulk', 'off', true);
  return jsonb_build_object('id', v_job.id, 'slug', v_job.slug, 'created', v_created, 'adopted', v_adopted,
                            'phase', v_job.phase, 'company', v_job.company_name, 'company_id', v_job.company_id,
                            'company_created', v_company_created);
end $$;

revoke all on function public.iv_upsert_application(jsonb) from public, anon;
grant execute on function public.iv_upsert_application(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. private bucket for CV PDFs and LaTeX sources (JD snapshots are stored inline)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intervous-docs', 'intervous-docs', false, 10485760,
        array['application/pdf','text/markdown','text/plain','text/html','application/json','application/x-tex'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "intervous-docs own select" on storage.objects;
drop policy if exists "intervous-docs own insert" on storage.objects;
drop policy if exists "intervous-docs own update" on storage.objects;
drop policy if exists "intervous-docs own delete" on storage.objects;
create policy "intervous-docs own select" on storage.objects for select to authenticated
  using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "intervous-docs own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "intervous-docs own update" on storage.objects for update to authenticated
  using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "intervous-docs own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 10. live updates: CLI writes show up in an open browser tab
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['jobs','job_events','job_documents'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
```

If creating policies on `storage.objects` fails with "must be owner" on this project, Alberto creates the same 4 policies in Dashboard > Storage > Policies using the same expressions. The rest of the migration has already committed by then, because the file is one transaction. Re-running after the dashboard step is safe.

**Rollback, if it is ever needed.** Run these in order:
1. `drop view job_overview; drop function iv_upsert_application(jsonb);`
2. Drop the triggers `iv_jobs_before_write` and `iv_jobs_log_phase` on `jobs`, and `iv_events_before_insert` and `iv_events_after_insert` on `job_events`. Then drop the `iv_*` functions.
3. Drop these tables: `job_proof_points`, `proof_points`, `job_requirements`, `job_answers`, `job_documents`, `job_events`, `contacts`, `user_settings`.
4. Drop the 4 storage policies and the bucket.

The added `jobs` columns can stay. They are harmless.

### 4.4 What was tested (2026-10-17, `public.ecr.aws/supabase/postgres:17.11.0.004`)

The harness is in `…/scratchpad/ivsql2/` (`setup.sql`, `test.sql`, `test2.sql`). WP1 moves it to `supabase/tests/` and adds `scripts/test-sql.sh`, which starts the container, applies `setup.sql`, runs the migration twice and runs both test files. `setup.sql` reproduces the live state: an int4 `jobs.id`, a text `application_date`, 3 legacy rows, and 5 rows from the earlier import, including drafts wrongly saved as Active/Screening and rows with empty URLs.

Results:

**Running the migration**
- It ran twice with no errors.
- The guard aborts when a `job_events` table with the old draft shape exists.
- The backfill set legacy Inactive rows to `rejected` and marked `phase` as uncertain.

**Adopting existing rows during import**
- Rows with empty URLs were adopted by explicit `job_id` (133, 134).
- A row was adopted by its URL even though the stored URL had a `?query` and the import URL had a trailing slash.
- Drafts became `draft` with status `Not Applied`, stage `-` and `application_date` NULL.
- ECB TIN kept `applied` with a NULL date and `uncertain = {phase, applied_on}`.
- The import produced **zero** `phase_change` events.

**Company matching**
- Names match case-insensitively ("european central bank" matched the existing row).
- `company_create:false` left `company_id` null.
- A missing company (NVIDIA) was created.

**Web edits surviving a re-push**
- After the web set a gap to `worded_around` and edited an answer's text, a CLI re-push that omitted both kept both. The gap was matched case-insensitively by requirement text.

**Events moving the phase**
- `applied` → applied, then `reply` → screening. The applied event was backdated to 18 Oct and the reply dated 22 Oct. `auto_ack` is not counted as a response.
- A `phase_change` event from the CLI moved the phase and did not produce a duplicate automatic event.

**The old UI**
- A Kanban drag to "Final Round" set the phase to `interviewing` and logged one automatic event.
- The edit form re-saving all 7 fields unchanged left the phase alone.

**Security**
- A second user sees 0 rows in every table and view and cannot insert an event on someone else's job.
- Adopting another user's `job_id` returns "not found". Adopting a row that already has a different slug is refused.
- The `anon` role cannot execute the RPC.
- Storage accepts writes to your own folder and refuses writes to another user's folder.

---

## 5. Today rules and insights (`lib/core/today.mjs`, `lib/core/insights.mjs`, `lib/core/stats.mjs`)

These are pure ESM functions. They take `{apps (job_overview rows), events, requirements, jobProofPoints, proofPoints, settings, today}` and are imported by Next and by the CLI. Tests use `node:test`, with a fixture built from `history.json` (WP2), and pin the expected numbers listed below.

### 5.1 Shared definitions

| Term | Definition |
|---|---|
| today | The date in `settings.timezone` (Europe/Berlin) |
| in window | `coalesce(applied_on, cv_built_on, created_at::date) >= settings.campaign_start` (2026-08-01). Rows outside the window are "older records" and are shown only in their own block. |
| sent | Phase is not draft or skipped |
| dated | Sent, and `applied_on` is not null. Undated sent rows (ECB TIN) are listed by name, never put in a denominator. |
| old enough to judge | Dated, and `today − applied_on ≥ mature_after_days` (21). Alternatively, the row has already responded. |
| responded | `first_response_on` is not null, meaning an event with `direction='in'`, `kind ≠ 'auto_ack'`, on or before today. A row also counts when its phase is screening, interviewing, offer or rejected with no such event; its response date is then unknown. **A rejection counts as a response.** |
| silence days | `today − max(applied_on, last_inbound_on, last_follow_up_on)` |
| unconfirmed | `uncertain` is not empty. These rows are included in counts but drawn as **hollow** dots. A toggle, "Only confirmed", excludes them, and a badge reads "includes n unconfirmed". |

### 5.2 Sample-size rule (in `lib/core/stats.mjs`, the only place it lives)

| n (the denominator) | What may be shown |
|---|---|
| Under 20 | "k of n" plus a `DotStrip`. **No percentage.** |
| 20–29 | "k of n (p%)" plus "likely between a% and b%" as a `RangeBar`, using an 80% Wilson interval with z = 1.2816. Centre `c = (k + z²/2)/(n + z²)`; half-width `h = z·√(k(n−k)/n + z²/4)/(n + z²)`. |
| 30 or more | The percentage leads, still with "k of n" and the range. |
| Comparing groups | A sentence such as "A gets replies more often than B" is allowed only when every group has n ≥ 10 **and** the 80% intervals do not overlap. Otherwise show a dot strip per group and the line "Too few to compare yet." |
| Median | Needs at least 5 values. Below that, list the values. |

### 5.3 Today queue

Items appear in priority order. "Silent" means there has been no inbound event other than an automatic acknowledgement.

| # | Item | Rule | Action button |
|---|---|---|---|
| 1 | Interview soon | An `interview_scheduled` event 0–7 days ahead | Opens the dossier with the "before the interview, check" callout |
| 2 | Interview outcome missing | Phase interviewing, and `last_event_on` 14 or more days ago | Log outcome |
| 3 | Next action due | `next_action_due <= today` | Done / Reschedule |
| 4 | Confirm facts | `uncertain` is not empty. Grouped into one row that starts the one-question flow | Start |
| 5 | Follow up | Sent and silent for at least `follow_up_after_days` (14) and under `no_reply_after_days` (45); no follow-up in the last 14 days; `posting_live ≠ false`; and a contact exists or the channel is referral, recruiter or email | Copy a follow-up line / Mark followed up |
| 6 | Mark as no reply | Phase applied or screening, and silent for at least `no_reply_after_days`, or `posting_live = false` and silent for at least 21 days. Grouped into one row with a review list | Mark no reply (one by one or all) |
| 7 | Closing soon | A draft with `closes_on` within 14 days | Send or drop |
| 8 | Posting closed | A draft with `posting_live = false` | Drop it / Look for a repost |
| 9 | Stale draft | A draft with `today − cv_built_on ≥ draft_stale_after_days` (7) | Send or drop |
| 10 | Fix the base CV | Gaps with `gap_state = 'no_longer_true'`, grouped by topic. Shown only on Mondays, or when there are 2 or more. | Checklist ("add Kubernetes to the base CV") |

**Expected right after the import** (pinned in the WP2 test):
- Item 2: Apple, 44 days.
- Item 4: 16 of the 18 history rows have at least one unconfirmed field. The confirm flow asks status questions first (Anthropic, Cohere, PostHog, ECB TIN, ECB 13745, AI Futures), then dates.
- Item 5: ECB 14417, 16 days. It has contacts on file (his team lead and a colleague). ECB 13745 and PostHog have no contact and no follow-up channel, so they appear only in the Insights silence list (I1).
- Item 6: OpenAI Codex, Anthropic, Cohere, G-Research and LangChain, each silent for 48 days.
- Item 8: OpenAI Digital Natives. Its notes carry the Munich repost.
- Item 9: AI Futures, 32 days.
- Item 10: Kubernetes (G-Research, LangChain) and Terraform (AI Futures).

**Threshold learning.** Once there are 5 or more responses with exact dates, the Insights page offers a one-click change: set `no_reply_after_days` to `max(21, 2 × median)` and `follow_up_after_days` to about the p75.

### 5.4 Insights, in page order

| # | Question | Formula | Minimum n | Expected after import | What it changes |
|---|---|---|---|---|---|
| I1 | Who owes you a reply? | Sent, not responded, sorted by silence days. Buckets: under 14 "wait", 14–44 "follow up if you can", 45 or more "likely closed". Undated rows listed separately. | None (it is a list) | 48 days: Codex, Anthropic\*, Cohere\*, G-Research, LangChain. 16–17 days: ECB 13745\*, ECB 14417, PostHog\*. 6 days: Meta. Undated: ECB TIN\*. (\* = unconfirmed) | Whom to chase and whom to stop counting on. Each row has the actions "Followed up" and "Mark no reply". |
| I2 | Do applications get answers? | responded ÷ old enough to judge (in window) | Rule 5.2 | "1 of 6 applications sent more than 3 weeks ago got a reply (Apple, 4 days)." Dot strip. | Volume versus targeting. Near zero at n ≥ 20 means the CV or the targeting is the problem, not luck. |
| I3 | How far do they get? | Step counts: sent → responded → interview (an `interview_scheduled` event, or phase interviewing/offer, or a legacy `stage` in the interview set) → offer. Counts only, never conversion percentages below n = 20. | Counts | 11 → 1 → 1 → 0. Older records, shown separately: 5 → 4 → 3 → 0. | Where it breaks. Many replies but no interviews: work on screening. No replies: work on the CV or targeting. |
| I4 | How long until they reply? | `first_response_on − applied_on` for each responder, as dots on a 0–60 day axis | Median at 5 or more | One dot: Apple, 4 days | Calibrates the 21/14/45-day thresholds. This is where the one-click suggestion appears. |
| I5 | Am I sending what I build? | Per ISO week for the last 12 weeks: CVs built and applications sent, as two thin bar series. Plus each draft's age, the share of builds sent within 14 days (rule 5.2), and a burst note when one day holds 40% or more of all sends. | Counts | Week of 24 Aug: 6 built, 6 sent ("6 of 11 sent on 30 Aug"). 6 drafts, 3 built today. | Builds far ahead of sends means tailoring has become a way of not sending. Send or drop each draft. |
| I6 | What do JDs keep asking that you lack? | For each `topic` with a gap or partial item whose `gap_state ≠ 'no_longer_true'`: the number of distinct applications, all phases included (a gap comes from the posting). Shown when it appears in 2 or more. Each bar is split by gap state, and the sent ones show their outcome dots. | Counts of documents, not rates | Years or seniority: 7 (Anthropic, AI Futures, Databricks, NVIDIA, OpenAI DN, PostHog, Revolut). Customer-facing or FDE title: 4. Leadership: 3. Kubernetes and Terraform appear struck through under "No longer a gap: update the base CV". The dry run confirms these numbers. | The top gap is time in industry, not a skill: prefer postings with no years gate, or strengthen the summary's bridge. Learn a skill only if 3 or more JDs ask for it. |
| I7 | What did you tell each company? | Group `job_proof_points` by proof point. Count the uses in sent applications. List each `detail`. **Number check**: extract numbers with `/\d+(\.\d+)?\s?%\|\$\d+(\.\d+)?\|\d{2,}\s?(cases\|docs)/g` and flag a proof point when the same metric word ("F1", "exact", "%") carries different values across applications, or a value differs from `proof_points.facts`. Also list every proof point whose `metric_status ≠ 'verified'` that is used by an application in an open phase. | None | Most used (dry run confirms): OpalZero 11, lazy-cat 9, Fiduciary 9, ECB document-pipeline eval 7, EBA parser 6. Flagged: EBA parser as "93%", "93% partial / 73.8% exact", "84.7% strict F1" (wrong), and "precision 86.9% / recall 83.3%". TabFact "72% state of the art" has no evidence. | Before an interview, know exactly which numbers that company read. Stop repeating unverified claims. |
| I8 | Where are you aiming? | Responded ÷ old-enough-to-judge, grouped by `visa_needed`, `role_family`, `channel` and `country_code` | Group rule 5.2 | Every group under 10: "Too few to compare; Apple is the only reply." Visa needed on 7 of the 18 roles. | Once a group (for example UK/US roles that need a visa) reaches n ≥ 10 with no replies, move effort away from it. |
| I9 | Can you trust these numbers? | Rows with `uncertain` not empty, plus sent rows whose CV is not marked as the sent version, plus answers never saved | None | 16 rows with unconfirmed facts; 9 sent applications whose CV on file may not be the version sent; 16 answers that exist only in chat | Every other section is only as good as this. Links to the confirm flow. |
| I10 | Pay you've seen | `salary_text` grouped by currency and period, not converted. Reference only, at the bottom of the page. | None | OpenAI Codex $230K–385K; LangChain $160K–175K; ECB €4,982 net per month (×2); PostHog uses a formula | Reference only. |

---

## 6. CLI contract

### 6.1 Layout and install

**Entry point and modules**
- The entry point stays `cli/intervous.mjs`, already symlinked at `~/.local/bin/intervous`.
- It holds only the command registry and argument parsing (`node:util parseArgs`).
- Commands live in `cli/commands/<name>.mjs` and helpers in `cli/lib/{config,auth,lock,output,files,validate,manifest}.mjs`.
- Shared rules are imported from `../lib/core/*.mjs`, so Today and Insights exist exactly once.

**Commands that stay, change or go**
- The existing generic commands `db`, `storage`, `export`, `jobs` and `companies` move to `cli/commands/legacy.mjs` and stay available for debugging.
- `jobs add` stops writing `status:'Applied'`/`stage:''` and writes `phase` instead.
- The uncommitted commands `schema`, `import`, `feedback` and `events` are deleted.

**Config and dependencies**
- Config comes from env vars `INTERVOUS_URL` and `INTERVOUS_ANON_KEY` first, then `~/.config/intervous/config.json` (`{url, anonKey, appUrl}`), then the app's `.env`.
- `appUrl` defaults to `https://albertobarnabo.it/intervous`.
- The CLI depends only on the app's own `node_modules`: `@supabase/supabase-js`, plus `turndown` for the import.

**Session**
- The file adapter at `~/.config/intervous/session.json` is kept, with the directory at 0700 and the file at 0600, written atomically (write `.tmp`, then rename).
- Client options: `storageKey: 'intervous-cli'`, `autoRefreshToken: false`, `detectSessionInUrl: false`.

**Refresh lock**
- The lock file is `~/.config/intervous/session.lock`.
- It is opened with `fs.openSync(p, 'wx')`, contains the pid and a timestamp, is retried every 50ms for up to 10s, and counts as stale after 30s.
- It is held around `getSession()`, and the session file is re-read after the lock is acquired.
- This stops two processes from spending the same rotated refresh token.

**`login`**
- It refuses unless `process.stdin.isTTY`. It then exits 2 with "Run this yourself in a terminal."
- There is no `--password` flag and no password environment variable.
- The password prompt is hidden.

**Agent rules**, written into the protocol in 6.6:
- Never run `login`.
- Never read `session.json`.
- On exit 2, stop and ask Alberto to run `intervous login`.

### 6.2 Commands

`<ref>` is a slug, a unique slug prefix, or a numeric id.

```
intervous login [--email E] | logout | whoami
intervous doctor                          config, session, migration (probe job_overview + RPC with a bad slug → 22023), bucket list on <uid>/
intervous find --url U | --company C [--role R]      duplicate check before building a CV (URL-normalized; ilike with %,_ escaped)
intervous add <manifest.json> [--dry-run]            whole application in one call (6.3)
intervous show <ref>                                 job + events + documents (signed URLs, 10 min) + answers + fit + proof points + contacts
intervous list [--phase P,P] [--since DATE] [--group G]
intervous sent <ref> [--on DATE] [--cv PDF]          applied event; newest cv_pdf (or --cv, uploaded) marked submitted=true;
                                                     removes phase/applied_on from uncertain
intervous move <ref> <phase> [--on DATE] [--note T]  inserts kind=phase_change, to_phase=<phase>
intervous log <ref> <kind> [--on DATE] [--at ISO] [--title T] [--body B] [--contact NAME]
intervous attach <ref> <file> --kind cv_pdf|cv_source|cover_letter|other [--submitted] [--label L]
intervous jd <ref> <file.md> [--source-url U] [--captured-at ISO]
intervous answer <ref> --question Q (--file F | --text T) [--limit N] [--submitted]
intervous next <ref> "text" [--due DATE] | intervous next <ref> --clear
intervous confirm <ref> <field...>                   removes fields from uncertain, writes a note event
intervous today                                      same queue as /today
intervous insights [--only actions]                  same numbers as /insights, sample-size rule applied
intervous proof list | intervous proof set <key> [--name N] [--metric M] [--status verified|needs_care|unverified]
                                                     [--caveat C] [--fact k=v ...]
intervous import <history.json> --map <adopt.json> [--dry-run] [--only slug,slug] [--emit-fixture FILE]
intervous open <ref>                                 prints <appUrl>/applications/<slug>
```

**Validation, applied to every write:**
- Dates are `YYYY-MM-DD`.
- `phase`, `channel`, `work_mode`, event `kind`, fit `verdict` and `gap_state` use the CHECK values.
- `topic` is lowercase snake_case.
- A slug matches `^[a-z0-9][a-z0-9-]{1,80}$`.
- A phase other than draft or skipped needs `applied_on`. If it is missing, the CLI fills in today and says so.

### 6.3 The manifest and `add`

The agent writes `/Users/albi/Projects/cv/applications/<slug>/intervous.json`. That file on disk is the source of truth and can be pushed again at any time. Its keys are the RPC payload (section 4.3), plus `files` and `answers[].file`. Relative paths resolve against the manifest's folder.

```json
{
  "slug": "databricks-ai-fde-amsterdam",
  "company": "Databricks", "company_website": "https://www.databricks.com",
  "role": "AI Forward Deployed Engineer", "team": null,
  "location": "Amsterdam, NL", "country_code": "NL", "work_mode": "hybrid",
  "url": "https://job-boards.greenhouse.io/databricks/jobs/…",
  "channel": "ats", "channel_detail": "Greenhouse",
  "role_family": "forward_deployed", "seniority": "extensive years in customer-facing roles", "years_required": 3,
  "visa_needed": false,
  "salary": {"text": null, "min": null, "max": null, "currency": null, "period": null},
  "posting": {"live": true, "checked_at": "2026-10-17T12:00:00Z"},
  "phase": "draft", "cv_built_on": "2026-10-17", "applied_on": null, "closes_on": null,
  "cv_variant": "databricks-ai-fde-amsterdam",
  "next_action": {"text": "Send by 24 Oct", "due": "2026-10-24"},
  "notes": "…", "status_evidence": null, "uncertain": [],
  "files": {
    "cv_pdf": "/Users/albi/Projects/cv/pdf/Alberto_Barnabo_Resume_databricks-ai-fde-amsterdam.pdf",
    "cv_source": "/Users/albi/Projects/cv/variants/databricks-ai-fde-amsterdam.tex",
    "jd_md": "jd.md"
  },
  "requirements": [
    {"requirement": "Production LLM systems with customers", "verdict": "met", "importance": "required",
     "evidence": "ECB FM360 agent", "anchor_text": "…exact JD phrase…"},
    {"requirement": "Spark / Databricks platform", "verdict": "gap", "topic": "spark", "gap_state": "not_claimed",
     "anchor_text": "…"},
    {"requirement": "Say 'lab', not 'production', for the EBA parser", "verdict": "caution",
     "evidence": "Lab EKS only; strict exact-match 73.8%"}
  ],
  "proof_points": [{"key": "ecb-eba-parser", "detail": "302 cases, $0.96/doc, lab deployment"}],
  "answers": [{"question": "Why Databricks?", "file": "answers/why-databricks.md", "char_limit": 1200}],
  "contacts": [{"name": "…", "role": "Recruiter"}],
  "events": [{"kind": "cv_built", "on": "2026-10-17", "title": "CV variant built and reviewed"}]
}
```

**What `add` does, in order:**
1. Validate (6.2).
2. For each file in `files`:
   - Compute its sha256.
   - Upload `cv_pdf` and `cv_source` to bucket `intervous-docs` at `<uid>/<slug>/<kind>/<sha256[0:12]>-<basename>`, with an explicit `contentType` (`application/pdf` or `application/x-tex`) and `upsert: false`. "Already exists" counts as success.
   - Append a `documents[]` entry. `jd_md` goes in inline as `content`, with `source_url = url` and `captured_at = now` (or the file's mtime).
3. Read each `answers[].file` into `answer`.
4. Call `rpc('iv_upsert_application', {p})`. That is one transaction.
5. If the RPC fails, the uploaded objects stay. They are harmless, a re-run reuses them because the name comes from the content hash, and `doctor --orphans` lists them.

`--dry-run` resolves everything, writes nothing, and prints `"action": "would_create" | "would_update"` with a field-level diff against the stored row.

**Output with `--json`, or whenever stdout is not a TTY:**

```json
{"ok": true, "data": {"id": 143, "slug": "databricks-ai-fde-amsterdam", "created": false, "adopted": false,
  "phase": "draft", "company": "Databricks", "company_created": false,
  "documents": [{"kind": "cv_pdf", "status": "uploaded", "path": "<uid>/databricks-ai-fde-amsterdam/cv_pdf/ab12cd34ef56-…pdf"},
                {"kind": "jd_snapshot", "status": "stored"}],
  "url": "https://albertobarnabo.it/intervous/applications/databricks-ai-fde-amsterdam", "warnings": []}}
```

Errors go to stderr as `{"ok": false, "error": {"code", "message", "hint"}}`.

### 6.4 Exit codes

| Code | Meaning |
|---|---|
| 0 | OK |
| 1 | Usage or validation error |
| 2 | Not logged in, or refresh failed. Hint: "ask Alberto to run `intervous login`" |
| 3 | Not found |
| 4 | Conflict (ambiguous ref, slug already taken) |
| 5 | Network or server error |
| 6 | Schema missing (PGRST202, 42P01 or 42883). Hint: "run the v2 migration" |

### 6.5 `today` and `insights` output

`intervous insights --only actions --json` returns `{generated_on, actions:[{type, slug, company, role, days, reason, suggested_commands:[…]}]}`.

`suggested_commands` holds ready-to-run commands, for example `intervous log apple-developer-publications rejection --on YYYY-MM-DD`. Without `--only`, the output also carries one object per insight from 5.4, with `n`, `allowed_display` (`counts`, `range` or `percent`) and the numbers.

### 6.6 Agent protocol

This block goes into `/Users/albi/Projects/cv/CLAUDE.md` once Alberto has said yes to the edit (WP11).

1. When a JD link arrives, run `intervous find --url <url>`. If it matches, update that application instead of creating a new one.
2. While building the variant, save the JD text exactly as captured to `applications/<slug>/jd.md`.
3. After the CV passes review, write `applications/<slug>/intervous.json`. Fill in fit items (met, partial, gap or caution, each with `anchor_text` where possible), proof points with the exact wording used, answers and next action. Then run `intervous add …/intervous.json --dry-run` followed by `intervous add …/intervous.json`, and reply with the `url`.
4. When Alberto says he sent it, run `intervous sent <slug> --on <date>`. If the PDF changed since, add `--cv <the exact file sent>`.
5. When a reply, interview or rejection comes in, run `intervous log <slug> reply|interview_scheduled|rejection|offer …`.
6. At the start of a job-hunt session, run `intervous insights --only actions --json` and raise the actions.
7. Before an interview, run `intervous show <slug> --json` and read the cautions and the I7 wording for that company.
8. On exit 2, stop and ask Alberto to run `intervous login` in his terminal. On exit 6, tell him the migration is missing.

---

## 7. History import plan

### 7.1 Inputs

The scratchpad is temporary. Copy these inputs into `/Users/albi/Projects/cv/intervous-import/`. That folder is outside the InterVous repo on purpose: the repo pushes to GitHub, and these files hold personal data.
- `history.json`
- `build_history.py`
- `fetched/` (the ATS JSON for anthropic, apple, cohere, databricks, langchain and openai)

The maps written by WP4 also go in that folder: `adopt.json`, `proof_aliases.json`, `gap_topics.json`, `overrides.json`.

### 7.2 Adopting the 17 rows that already exist

`adopt.json` maps each slug to a live `jobs.id`. The importer passes the id as `job_id`, and the RPC adopts that row.

| slug | id |
|---|---|
| openai-codex-core-agent | 127 |
| apple-developer-publications | 128 |
| anthropic-applied-ai-architect | 129 |
| cohere-fde-agentic-platform | 130 |
| gresearch-applied-ai-engineer | 131 |
| langchain-deployed-engineer | 132 |
| ai-futures-senior-ai-product-engineer-frankfurt | 133 (empty URL) |
| ecb-tin-ssm-governance-operations | 134 (empty URL) |
| ecb-14417-it-application-development-specialists | 135 |
| ecb-13745-data-science-specialist | 136 |
| posthog-product-engineer | 137 |
| openai-applied-ai-digital-natives | 138 |
| meta-swe-ml-integrity | 139 |
| mistral-applied-ai-fde-london | 140 |
| nvidia-applied-ai-munich | 141 |
| revolut-applied-ai-berlin | 142 |
| databricks-ai-fde-amsterdam | 143 |
| ecb-14896-assistant-reserve-list | (new row, phase `skipped`) |

- Use the full slugs as they appear in `history.json`. The table above shortens some of them.
- The dry run re-derives this table: by URL, then by exact case-insensitive company plus role. It refuses to run if the derived table and `adopt.json` disagree.
- The 5 legacy rows (91, 121, 122, 125, 126) are left untouched apart from the backfill in the migration. They show up under "Older records".

### 7.3 Field mapping (`history.json` → payload, `source: "import"`)

| From history | To | Rule |
|---|---|---|
| `id` | `slug` | |
| `company`, `role`, `team`, `location`, `url` | same fields | Leave the AI Futures entry's `company` as the live name with `company_create: false`, because `companies` is global. The three ECB entries resolve to the existing "European Central Bank". |
| `location` | `country_code`, `work_mode` | The location suffix gives the country: US, UK→GB, IT, DE, NL. "Remote…" gives `work_mode = remote` and `country_code = null`. |
| `channel` | `channel` + `channel_detail` | "company ATS (Ashby)" → `ats` / "Ashby"; "ECB portal" → `portal`; "recruiter" → `recruiter` / "AI Futures (Kyle)"; "internal referral" → `referral`; "LinkedIn…" → `linkedin`. When applied on another site, put it in the detail, e.g. "Meta careers". |
| `status` | `phase` | applied → `applied`; interviewing → `interviewing`; draft → `draft`; not_applied → `skipped` |
| `date_applied`, `date_cv_built` | `applied_on`, `cv_built_on` | **Always send `applied_on`, null included.** That clears the wrong dates the earlier import wrote on drafts and on ECB TIN. |
| `uncertain` | `uncertain` | Rename: `status` → `phase`, `date_applied` → `applied_on`, `date_cv_built` → `cv_built_on`. |
| `status_evidence`, `notes`, `cv_variant` | same fields | |
| `role_family` | `role_family` | `forward_deployed_customer_facing` → `forward_deployed`; the rest pass through. |
| `seniority_asked`, `years_required`, `visa_needed` | `seniority`, `years_required`, `visa_needed` | |
| `salary` | `salary` | The text is always kept. Parsed only where unambiguous: OpenAI 230000–385000 USD/year; LangChain 160000–175000 USD/year (text keeps "now 185K"); ECB 4982–4982 EUR/month (text keeps "net"); PostHog: text only. |
| `posting_check` | `posting` | `{live, checked_at}` |
| `requirements_matched[]` | `requirements` | `verdict: met`. The text in parentheses becomes `evidence`. |
| `gaps[]` | `requirements` | `verdict: gap`. Split each entry on ";". "NOT claimed: a, b" becomes one gap per technology with `gap_state: not_claimed`. `topic` comes from `gap_topics.json`: years/senior/5+/seniority → `years_experience`; customer-facing/FDE/pre-sales/client-facing/title → `customer_facing_title`; leading/driving change/ownership → `leadership`; technologies by name (`kubernetes`, `terraform`, `kafka`, `spark`, `csharp`, `grpc`, `clickhouse`, `cuda`, `dspy`, `django`, `scikit_learn`); German → `german`; anything else → `other`. |
| (overrides) | `gap_state: no_longer_true` | Terraform (AI Futures) and Kubernetes (G-Research, LangChain), with the note "uses daily, confirmed 2026-09-23". scikit-learn (Databricks), with the note "added to CV". |
| (overrides) | `verdict: caution` | ECB 14417: "Answer calls the EBA parser 'production' and quotes 84.7% strict F1. It is lab-only; 84.7% is level-overlap F1; strict exact-match is 73.8%." OpenAI Codex: "72% TabFact state-of-the-art claim has no local evidence (checked 2026-10-11)"; "US work authorisation line is still a TODO". |
| `proof_points_used[]` | `proof_points` | Split "Name (metric)" into `key` (via `proof_aliases.json`) and `detail` (the metric as written). Seed facts: `ecb-eba-parser` = `{cases:302, partial_credit:"93%", exact_match:"73.8%", level_overlap_f1:"84.7%", precision:"86.9%", recall:"83.3%", cost_per_doc:"$0.96", deployed:"lab only"}` with `metric_status: needs_care`; `xjtu-tabfact` gets `metric_status: unverified` and caveat "72% SOTA claim has no local evidence". |
| `answers[]` | `answers` | Where `where` is a file that exists, read it into `answer`. There are 4: Codex additional-information, Anthropic why-anthropic (marked as a skeleton in the question), Cohere client-facing, Apple scheduling reply. Otherwise `answer: null`, with `source_path` set to the `where` text, e.g. "given in chat 2026-09-30". That covers 16 answers: ECB 14417 ×8, ECB 13745 ×3, Mistral ×3, PostHog ×2. |
| `contacts[]` | `contacts` | as is |
| `events[]` | `events` | Split on ";". Patterns are tried in this order: "invitation\|invite\|Webex" → `interview_scheduled`; "no longer\|404\|taken down" → `posting_closed`; "closing date\|deadline" → sets `closes_on`, no event; "submitted\|\bapplied\b" → `applied`; "built" → `cv_built`; "submission attempted" → `note`, and `phase` is added to `uncertain`; everything else (recruiter outreach, shortlisting call, republished, reviews) → `note`. When the matching field is unconfirmed, set `date_uncertain: true`. If no event of the kind exists on that date, add a synthetic `cv_built` on `cv_built_on` and a synthetic `applied` on `applied_on`. ECB 14896 is built on 2026-09-08 with `date_uncertain`. |
| `cv_pdf_path` | `files.cv_pdf` | When the file exists (15 of them): `submitted: null`, label "Rebuilt <mtime date>; may differ from what you sent". |
| `~/Projects/cv/variants/<cv_variant>.tex` | `files.cv_source` | When it exists. |
| `fetched/*.json` | `jd_snapshot` | Convert the ATS `descriptionHtml`/`content` to markdown with turndown. `captured_at` is the fetch time, with label "captured after applying". The exception is Databricks, labelled "captured while building", since it was captured the same day. The 12 others get no snapshot. For postings still live, the agent can add one later with `intervous jd`, checking the CV repo's `OPEN_ROLES.md` first. |
| `next_action` (overrides) | `next_action` | Apple: "Record the interview outcome". AI Futures: "Ask Kyle what came of the 17 Sep shortlisting call". OpenAI Digital Natives: "Munich version posted 13 Oct: https://jobs.ashbyhq.com/openai/d039c0ef-ab36-4d40-bc5e-5c70295b2eb7". |

### 7.4 Steps

1. `intervous doctor` reports green, which needs the migration to have been run.
2. `intervous import …/history.json --map …/adopt.json --dry-run` prints a table with one row per application:
   - the action (adopt #id, or create)
   - the phase change (for example "applied → draft (fixes earlier import)")
   - the company (link or create)
   - the fit items and topics assigned
   - the proof-point keys
   - the events derived
   - the files to upload, with sizes
   - the warnings

   Alberto reads it.
3. **One question goes to Alberto before the real run.** Is the "ECB document-pipeline eval" in the August CVs the same project as the EBA parser? If yes, the two merge into `ecb-eba-parser`. If no, they stay as separate keys.
4. Run the import for real (no `--dry-run`). It is idempotent: rows upsert by slug, events and documents are de-duplicated, and a re-run changes nothing.
5. Check the result:
   - `intervous list --json | jq length` returns **23**: 22 existing rows plus ECB 14896.
   - `intervous insights --json` reproduces section 5.4: 11 sent, 10 dated, 6 old enough to judge, 1 responded, 6 drafts, 16 unconfirmed.
   - In the old UI, the 6 drafts now show "Not Applied".
   - Open the dossiers for Apple, ECB 14417 and Databricks.
6. `--emit-fixture /Users/albi/Projects/cv/intervous-import/fixture.json` writes the overview, events, fit and proof rows as JSON for the WP2 tests and the dev fixture mode. It never goes into git.
7. Follow-up task, not a blocker: recover the 16 chat-only answers from session transcripts. Show each recovered text to Alberto, then write it with `intervous answer`, with `source_path` naming the session and date.

---

## 8. Work packages

Each package owns the files listed against it. No other package edits those files. When a package needs a change in a file it does not own, it asks that file's owner. The dependency list below is the only ordering constraint.

**Who does what:** Alberto runs SQL, runs `login`, commits and deploys. The agent never commits.

| WP | Scope | Owns (create or edit) | Depends on | Done when |
|---|---|---|---|---|
| **WP0** (Alberto, ~10 min) | Run the preflight (4.1) and paste the output. Run the migration. Turn off "Allow new users to sign up" in Supabase Auth. | — | WP1's file | `intervous doctor` is green |
| **WP1** Data | Copy the tested migration and harness into the repo. Delete the abandoned draft migration. Adjust the SQL if the preflight surprises, then re-run the harness. Hand-write `lib/database.types.ts` from the SQL. | `supabase/migrations/20261017120000_intervous_v2.sql`, `supabase/tests/**`, `scripts/test-sql.sh`, `lib/database.types.ts`, deletion of `supabase/migrations/20261017_application_dossier.sql` | — | The harness passes twice in a row. Types compile. |
| **WP2** Core logic | Plain ESM with JSDoc and an `index.d.ts`. `phases.mjs` (ids, labels, groups, board columns, legacy maps, CSS token names). `dates.mjs` (local-date parsing of `YYYY-MM-DD`, `daysBetween`, ISO week, `formatShort`). `slug.mjs`. `now.mjs`. `stats.mjs` (Wilson interval, display rule). `today.mjs`. `insights.mjs`. Tests with `node:test` on the fixture, with the numbers in 5.3 and 5.4 pinned. | `lib/core/**` | WP1 column names (fixed in this spec) | `node --test lib/core` passes |
| **WP3** CLI | Everything in section 6 except `import`. Register `import` as a stub that WP4 fills. Tests run against the local container. | `cli/intervous.mjs`, `cli/lib/**`, `cli/commands/*.mjs` except `import.mjs`, `cli/test/**` | WP1, WP2 (`today`/`insights` only) | `add --dry-run` and a real `add` → `sent` → `log` → `move` round trip pass on the container. `doctor` is green live. |
| **WP4** Import | Section 7. | `cli/commands/import.mjs`, `cli/import/` (rule code only), `/Users/albi/Projects/cv/intervous-import/*.json` maps | WP3's `cli/lib`, WP0 | Dry run reviewed by Alberto, real run done, checks in 7.4 step 5 pass |
| **WP5** UI foundation | Tokens and fonts (section 3). `src/ui/**` with the props in 3.6. The `(app)` layout with the single auth guard, the shell and nav. The data layer `lib/data/**`, with these exports: `useApplications()`, `useApplication(ref)`, `useInsightsInput()`, `useSettings()`, `logEvent()`, `movePhase()`, `updateApplication()` (an update that returns 0 rows is an error), `signedUrl(path)`, refetch on `visibilitychange`, and a Realtime subscription. Updates to `lib/types.ts` (`JobEntry` gains the new fields). `lib/api.ts` with `apiUrl()` for the `/intervous/api` paths. Dev-only fixture mode (`NEXT_PUBLIC_FIXTURES=1`, active only when `NODE_ENV=development`), which reads the fixture from step 7.4.6. **All `package.json` changes**: remove the packages in 3.1; add exact pins `motion`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `pdfjs-dist`, `react-markdown`, `remark-gfm`, `turndown` (versions as resolved by `npm i --save-exact` on the day, for example `@dnd-kit/core@6.3.1`, `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `turndown@7.2.4`); add scripts `test` and `check:contrast`. `next.config.mjs` redirects (`/` and `/dashboard` → `/today`). | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(app)/layout.tsx`, `src/ui/**`, `src/components/AppShell.tsx`, `lib/data/**`, `lib/types.ts`, `lib/api.ts`, `package.json`, `package-lock.json`, `next.config.mjs`, `scripts/contrast.mjs`, `postcss.config.mjs` | WP2 (`phases.mjs` for colours) | `npm run build` and `npm run lint` pass. A primitives gallery at `/intervous/dev/ui` (dev only) is screenshotted at 375px and 1280px in light and dark. |
| **WP6** Applications | 2.2 list, board, filters, now sentence, age bar, group motion. | `src/app/(app)/applications/page.tsx`, `src/features/applications/**` | WP5 | Real data (or the fixture) renders. Keyboard drag works. Move with Undo works. |
| **WP7** Dossier | 2.3 header, stepper, callout, inline confirm, all 5 tabs, PDF viewer, JD reader with anchors, fit editing, answers with Copy, delete with typed confirm. Copy `pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs` and set `GlobalWorkerOptions.workerSrc = '/intervous/pdf.worker.min.mjs'`. Fall back to `<iframe src={signedUrl}#view=FitH>`, keeping "Open full size" visible because iOS Safari shows only page 1. `react-markdown` without `rehype-raw`, so JD HTML cannot inject. | `src/app/(app)/applications/[ref]/**`, `src/features/dossier/**`, `public/pdf.worker.min.mjs` | WP5 | The Apple, ECB 14417 (callout visible) and Databricks dossiers are correct. |
| **WP8** Today and Insights | 2.1 and 2.4, using `lib/core/today.mjs` and `insights.mjs` only, with no local re-implementation. Confirm flow, Undo, snooze, insight sections with "How this is counted". | `src/app/(app)/today/**`, `src/app/(app)/insights/**`, `src/features/today/**`, `src/features/insights/**` | WP5, WP2 | The screens show the same numbers as `intervous today --json` and `intervous insights --json`. |
| **WP9** Companies, settings, proof points, palette, auth pages | Move `src/app/companies` to `src/app/(app)/companies` and restyle it, keeping every feature. `/settings`. `/proof-points`. ⌘K palette with search. Restyle `/login` and `/reset-password` with the same tokens: a plain card, no glass, sign-up hidden. A New-application sheet with the 3 modes. **Last step:** delete `TopBar`, `StatsOverview`, `JobsTable`, `KanbanBoard`, `JobDetailPanel`, `EditJobPanel`, `AddJobPanel`, `src/app/dashboard/**` and `.flowbite-react/`, once WP6–8 are merged. | `src/app/(app)/companies/**`, `src/app/(app)/settings/**`, `src/app/(app)/proof-points/**`, `src/app/login/**`, `src/app/reset-password/**`, `src/features/palette/**`, `src/features/new-application/**`, `src/components/{KeysPanel,AvatarUploadModal,LinkCompanyModal,CommandPalette,Toast}.tsx` (port or remove) | WP5 | Company CRUD, tags, Tavily auto-fill, keys, avatar and link-company all still work. |
| **WP10** Hardening | Scrape route: return `{error}` and show the parsed message; an unknown model returns 400. SSRF guard: resolve the host and block private, loopback, link-local and metadata IPs; cap the response at 2 MB; allow at most 3 redirects, each re-checked. Accessibility pass: `aria-sort`, focus-visible, every clickable row is an `<a>` or `<button>`. Check at 375px with no horizontal scroll. Untrack `.env` (it holds only the anon key and URL) and add it to `.gitignore`. | `src/app/api/**`, `lib/backend/**`, `.gitignore` | WP6–9 merged | Checklist signed off, with screenshots in light and dark at 375px and 1280px |
| **WP11** Protocol | Write the 6.6 block into `/Users/albi/Projects/cv/CLAUDE.md`, only after Alberto says yes. Update the `project_cv` memory note. | those two files | WP3 | The next JD goes in via `intervous add` |

**Order.**
1. WP1, WP2 and WP5 start in parallel.
2. WP0 runs as soon as WP1 hands over the file.
3. WP3 starts against the local container immediately. WP4 follows WP0 and WP3.
4. WP6, WP7, WP8 and WP9 run in parallel after WP5.
5. WP10 and WP11 come last.

The data and the CLI are ready before any screen is rebuilt, so the very next CV lands in the tracker even while the UI work is still going on. The old UI keeps working on the migrated schema throughout.

---

## 9. Risks and open points

| Risk | Mitigation |
|---|---|
| The live schema differs from the inferred one (column types, NOT NULL columns, existing triggers) | Preflight first. WP1 adjusts the SQL and re-runs the harness. The migration never loosens existing `jobs` policies. |
| Someone runs the abandoned draft migration | It is deleted in WP1. The guard in v2 refuses to run on top of it. |
| The old UI writes `status`/`stage` while the new UI is being built | The trigger maps both ways (tested). A Kanban drag can move `no_reply` to `rejected`. That is acceptable for the short overlap. |
| Two refreshes race, or the refresh token expires | The lock file. On exit 2, Alberto runs `intervous login`. |
| Creating storage policies fails with "must be owner" | The dashboard fallback in 4.3. |
| `companies` is a global table, so imported names are visible to any account | There is effectively one account (1 profile). AI Futures uses `company_create:false`. WP0 turns off sign-ups, which also limits the scrape SSRF surface and the plaintext `keys` reads. |
| The stored PDFs are not the versions he sent | `submitted: null` plus a label. `intervous sent --cv` records the exact file from now on. |
| Very small samples get read as trends | One rule module (5.2). `DotStrip` has no percentage prop. Tests pin "no percentage below n = 20". |
| The pdf.js worker under `basePath` with Turbopack | The worker is served from `public/`, with an iframe fallback. |
| JD HTML injection | Markdown only, no raw HTML. |
| The tracker drifts out of sync with the CV workflow | The WP11 protocol block, after his OK. `find --url` before every build. |

**Questions for Alberto** (none of them blocks WP1–WP3):
1. Are "ECB document-pipeline eval" and "EBA parser" the same project? (Asked in 7.4 step 3.)
2. Who ran the earlier `intervous import`, the one that wrote rows 127–143? The v2 import repairs it either way, and keeping the uncommitted CLI diff is unnecessary.
3. Is the production URL `albertobarnabo.it/intervous` (as the README says) or `.com` (as the folder name says)? It is used for `appUrl`.

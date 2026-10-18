// What the ⌘K palette can find (spec 2.8): applications (company, role, slug), companies and
// actions ("Mark … as sent", "Log a reply for …", "New application", "Go to …"). Pure: no React.
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Keyboard,
  LayoutList,
  Link2,
  LogOut,
  MessageSquareReply,
  Plus,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Application } from "../../../lib/data";

export type PaletteGroup = "Applications" | "Companies" | "Actions" | "Go to";

export type PaletteCommand =
  | { type: "go"; href: string }
  | { type: "app"; app: Application }
  | { type: "company"; name: string }
  | { type: "sent"; app: Application }
  | { type: "reply"; app: Application }
  | { type: "new"; url?: string; company?: string }
  | { type: "add-company" }
  | { type: "shortcuts" }
  | { type: "sign-out" };

export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  sub?: string;
  icon?: LucideIcon;
  /** Company mark instead of an icon. */
  mark?: { name: string; logoUrl: string | null };
  phase?: string | null;
  /** Right-aligned key hint, e.g. "g t". */
  hint?: string;
  command: PaletteCommand;
};

export const PAGES: Array<{ href: string; label: string; icon: LucideIcon; hint: string; words: string }> = [
  { href: "/today", label: "Today", icon: CalendarCheck, hint: "g t", words: "today home queue needs" },
  { href: "/applications", label: "Applications", icon: LayoutList, hint: "g a", words: "applications list board jobs" },
  { href: "/insights", label: "Insights", icon: BarChart3, hint: "g i", words: "insights stats replies funnel" },
  { href: "/companies", label: "Companies", icon: Building2, hint: "g c", words: "companies organisations" },
  { href: "/proof-points", label: "Proof points", icon: Sparkles, hint: "g p", words: "proof points projects numbers claims" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "g s", words: "settings keys api avatar thresholds model cli" },
];

const ACTIONS: Array<{ id: string; label: string; icon: LucideIcon; hint?: string; words: string; command: PaletteCommand }> = [
  { id: "new", label: "New application", icon: Plus, hint: "n", words: "new add application job track", command: { type: "new" } },
  { id: "add-company", label: "Add company", icon: Building2, words: "add new company create", command: { type: "add-company" } },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, hint: "?", words: "keyboard shortcuts keys help", command: { type: "shortcuts" } },
  { id: "sign-out", label: "Sign out", icon: LogOut, words: "sign out log out logout exit", command: { type: "sign-out" } },
];

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Every word of the query appears somewhere in the haystack. */
function matches(hay: string, words: string[]) {
  const h = fold(hay);
  return words.every((w) => h.includes(w));
}

function appScore(a: Application, words: string[], q: string): number {
  const company = fold(String(a.company_name ?? ""));
  const role = fold(String(a.role ?? ""));
  if (company.startsWith(q)) return 0;
  if (company.split(/\s+/).some((w) => w.startsWith(words[0]))) return 1;
  if (role.startsWith(q)) return 2;
  return 3;
}

const OPEN_FIRST = ["interviewing", "offer", "screening", "applied", "draft"];

function activity(a: Application) {
  return String(a.last_activity_at ?? a.updated_at ?? a.created_at ?? "");
}

const appLabel = (a: Application) => `${a.company_name ?? "?"} · ${a.role ?? "Role not recorded"}`;

function appItem(a: Application): PaletteItem {
  return {
    id: `app-${a.id}`,
    group: "Applications",
    label: String(a.role || "Role not recorded"),
    sub: String(a.company_name ?? ""),
    mark: { name: String(a.company_name ?? "?"), logoUrl: a.company_logo_url },
    phase: a.phase,
    command: { type: "app", app: a },
  };
}

export function looksLikeUrl(q: string) {
  return /^https?:\/\/\S+\.\S+/i.test(q.trim());
}

/**
 * The palette's results for a query. `companies` are company names found remotely for the
 * query (the companies table), merged with the names of his applications.
 */
export function search(q0: string, apps: Application[], companies: Array<{ name: string; logoUrl: string | null }>): PaletteItem[] {
  const q = fold(q0.trim());
  const words = q.split(/\s+/).filter(Boolean);
  const out: PaletteItem[] = [];

  if (!q) {
    out.push(...ACTIONS.slice(0, 2).map((a) => ({ id: a.id, group: "Actions" as const, label: a.label, icon: a.icon, hint: a.hint, command: a.command })));
    const recent = [...apps]
      .filter((a) => OPEN_FIRST.includes(String(a.phase)))
      .sort((a, b) => (activity(a) < activity(b) ? 1 : -1))
      .slice(0, 5);
    out.push(...recent.map(appItem));
    out.push(...PAGES.map((p) => ({ id: `go-${p.href}`, group: "Go to" as const, label: p.label, icon: p.icon, hint: p.hint, command: { type: "go" as const, href: p.href } })));
    return out;
  }

  if (looksLikeUrl(q0)) {
    out.push({
      id: "new-from-link",
      group: "Actions",
      label: "New application from this link",
      sub: q0.trim(),
      icon: Link2,
      command: { type: "new", url: q0.trim() },
    });
  }

  const hits = apps
    .filter((a) => matches(`${a.company_name ?? ""} ${a.role ?? ""} ${a.slug ?? ""} ${a.location ?? ""}`, words))
    .sort((a, b) => appScore(a, words, q) - appScore(b, words, q) || (activity(a) < activity(b) ? 1 : -1));
  out.push(...hits.slice(0, 6).map(appItem));

  // phase actions for the best matches
  for (const a of hits.slice(0, 3)) {
    if (a.phase === "draft") {
      out.push({ id: `sent-${a.id}`, group: "Actions", label: `Mark ${appLabel(a)} as sent`, icon: CheckCircle2, command: { type: "sent", app: a } });
    } else if (a.phase === "applied" || a.phase === "screening") {
      out.push({ id: `reply-${a.id}`, group: "Actions", label: `Log a reply for ${appLabel(a)}`, icon: MessageSquareReply, command: { type: "reply", app: a } });
    }
  }
  if (/^(mark|sent|send)/.test(q) || /^(log|reply)/.test(q)) {
    const wantSent = /^(mark|sent|send)/.test(q);
    const rest = words.slice(1);
    const pool = apps.filter((a) => (wantSent ? a.phase === "draft" : a.phase === "applied" || a.phase === "screening"));
    for (const a of pool.filter((x) => !rest.length || matches(`${x.company_name} ${x.role}`, rest)).slice(0, 5)) {
      const id = `${wantSent ? "sent" : "reply"}-${a.id}`;
      if (out.some((x) => x.id === id)) continue;
      out.push(
        wantSent
          ? { id, group: "Actions", label: `Mark ${appLabel(a)} as sent`, icon: CheckCircle2, command: { type: "sent", app: a } }
          : { id, group: "Actions", label: `Log a reply for ${appLabel(a)}`, icon: MessageSquareReply, command: { type: "reply", app: a } },
      );
    }
  }

  const seen = new Set<string>();
  const names = [
    ...companies,
    ...apps.map((a) => ({ name: String(a.company_name ?? ""), logoUrl: a.company_logo_url })),
  ].filter((c) => {
    const k = fold(c.name.trim());
    if (!k || seen.has(k) || !matches(c.name, words)) return false;
    seen.add(k);
    return true;
  });
  out.push(
    ...names.slice(0, 4).map((c) => ({
      id: `company-${fold(c.name)}`,
      group: "Companies" as const,
      label: c.name,
      mark: { name: c.name, logoUrl: c.logoUrl },
      command: { type: "company" as const, name: c.name },
    })),
  );

  out.push(
    ...PAGES.filter((p) => matches(`${p.label} ${p.words} go to`, words)).map((p) => ({
      id: `go-${p.href}`,
      group: "Go to" as const,
      label: p.label,
      icon: p.icon,
      hint: p.hint,
      command: { type: "go" as const, href: p.href },
    })),
  );
  out.push(
    ...ACTIONS.filter((a) => matches(`${a.label} ${a.words}`, words)).map((a) => ({
      id: a.id,
      group: "Actions" as const,
      label: a.label,
      icon: a.icon,
      hint: a.hint,
      command: a.command,
    })),
  );
  return out;
}

/** Group order in the list: whatever the first result's group is comes first. */
export function grouped(items: PaletteItem[]): Array<{ group: PaletteGroup; items: PaletteItem[] }> {
  const order: PaletteGroup[] = [];
  const by = new Map<PaletteGroup, PaletteItem[]>();
  for (const it of items) {
    if (!by.has(it.group)) {
      by.set(it.group, []);
      order.push(it.group);
    }
    by.get(it.group)!.push(it);
  }
  return order.map((g) => ({ group: g, items: by.get(g)! }));
}

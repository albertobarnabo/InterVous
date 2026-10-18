"use client";

import { Menu as HMenu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  LayoutList,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile } from "../../lib/backend/profiles";
import { FIXTURE_MODE } from "../../lib/data/env";
import { cx } from "@/ui/cx";
import { Kbd } from "@/ui/Kbd";
import { Sheet } from "@/ui/Dialog";
import { Tag } from "@/ui/Chip";
import { AVATAR_CHANGED, isTypingTarget, focusSearch, openNewApplication, openPalette, openShortcuts } from "@/ui/events";

type NavItem = { href: string; label: string; icon: LucideIcon; key: string };

const MAIN_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarCheck, key: "t" },
  { href: "/applications", label: "Applications", icon: LayoutList, key: "a" },
  { href: "/insights", label: "Insights", icon: BarChart3, key: "i" },
  { href: "/companies", label: "Companies", icon: Building2, key: "c" },
];

const MORE_NAV: NavItem[] = [
  { href: "/companies", label: "Companies", icon: Building2, key: "c" },
  { href: "/proof-points", label: "Proof points", icon: Sparkles, key: "p" },
  { href: "/settings", label: "Settings", icon: Settings, key: "s" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark() {
  return (
    <Link href="/today" className="flex h-11 items-center gap-2 rounded-sm pr-2" aria-label="InterVous, go to Today">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-sm bg-accent font-serif text-[15px] font-semibold text-accent-ink">
        iv
      </span>
      <span className="text-body font-semibold text-ink">InterVous</span>
    </Link>
  );
}

function Avatar({ url, label, size = 32 }: { url: string | null; label: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar URL from Supabase storage
      <img src={url} alt="" onError={() => setBroken(true)} className="rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-accent-soft text-small font-medium text-accent"
      style={{ width: size, height: size }}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Global keys (docs/SPEC.md 2.8): g t / g a / g i / g c go to a page, n new application,
 * / focuses the page search, ? the shortcut sheet, ⌘K / Ctrl+K the palette.
 * The palette, the new-application sheet and the shortcut sheet listen for the events in src/ui/events.ts.
 */
function useGlobalKeys() {
  const router = useRouter();
  const pending = useRef<number>(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog][aria-modal=true], [data-headlessui-state~=open][role=dialog]")) return;
      const now = Date.now();
      if (pending.current && now - pending.current < 1200) {
        pending.current = 0;
        const target = [...MAIN_NAV, ...MORE_NAV].find((n) => n.key === e.key.toLowerCase());
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (e.key === "g") {
        pending.current = now;
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        openNewApplication();
      } else if (e.key === "/") {
        e.preventDefault();
        focusSearch();
        const el = document.querySelector<HTMLElement>("[data-page-search]");
        el?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        openShortcuts();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

/**
 * The authenticated shell: a 56px sticky top bar from 768px up (logo, Today · Applications ·
 * Insights · Companies, ⌘K, avatar menu), and a bottom tab bar under 768px
 * (Today, Applications, Insights, More).
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useGlobalKeys();

  useEffect(() => {
    if (!user || FIXTURE_MODE) return;
    let live = true;
    getProfile(user.id)
      .then((p) => live && setAvatarUrl(p?.avatar_url ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user]);

  // /settings saves the avatar; the menu button follows without a reload.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const url = (e as CustomEvent<unknown>).detail;
      setAvatarUrl(typeof url === "string" && url ? url : null);
    };
    window.addEventListener(AVATAR_CHANGED, onChanged);
    return () => window.removeEventListener(AVATAR_CHANGED, onChanged);
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

  const who = FIXTURE_MODE ? "Fixture" : user?.email ?? "You";

  const doSignOut = async () => {
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-60 rounded-sm bg-surface px-3 py-2 text-small text-ink shadow-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-2"
      >
        Skip to content
      </a>

      {/* Top bar: 768px and up */}
      <header className="sticky top-0 z-20 hidden h-14 border-b border-line bg-bg md:block">
        <div className="iv-page flex h-full items-center gap-2 lg:gap-6">
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-0.5">
            {MAIN_NAV.map((n) => {
              const on = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "relative flex h-9 items-center rounded-sm px-2.5 text-small font-medium transition-colors duration-[120ms] ease-out lg:px-3",
                    on ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {FIXTURE_MODE ? <Tag tone="caution" title="NEXT_PUBLIC_FIXTURES=1: reading lib/core/test/fixture.json">Fixture data</Tag> : null}
            <button
              type="button"
              onClick={openPalette}
              className="flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface pl-2.5 pr-1.5 text-small text-ink-3 transition-colors duration-[120ms] ease-out hover:border-ink-3 hover:text-ink-2 lg:w-56"
            >
              <Search aria-hidden size={16} />
              <span className="hidden lg:inline">Search or jump to…</span>
              <span className="sr-only lg:hidden">Search</span>
              <Kbd className="ml-auto">⌘K</Kbd>
            </button>
            <HMenu>
              <MenuButton
                aria-label={`Account menu for ${who}`}
                className="flex size-11 items-center justify-center rounded-full transition-colors duration-[120ms] ease-out hover:bg-surface-2"
              >
                <Avatar url={avatarUrl} label={who} />
              </MenuButton>
              <MenuItems
                anchor={{ to: "bottom end", gap: 4, padding: 8 }}
                transition
                modal={false}
                className="z-30 min-w-56 rounded-md bg-surface p-1 shadow-2 ring-1 ring-line transition duration-[120ms] ease-out focus:outline-none data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100"
              >
                <p className="truncate px-2.5 py-2 text-caption font-normal text-ink-3">{who}</p>
                <MenuSeparator className="my-1 h-px bg-line" />
                {MORE_NAV.slice(1).map((n) => (
                  <MenuItem key={n.href}>
                    <Link
                      href={n.href}
                      className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-small text-ink data-focus:bg-surface-2"
                    >
                      <n.icon aria-hidden size={16} strokeWidth={1.75} className="text-ink-3" />
                      {n.label}
                    </Link>
                  </MenuItem>
                ))}
                <MenuSeparator className="my-1 h-px bg-line" />
                <MenuItem>
                  <button
                    type="button"
                    onClick={doSignOut}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-small text-ink data-focus:bg-surface-2"
                  >
                    <LogOut aria-hidden size={16} strokeWidth={1.75} className="text-ink-3" />
                    Sign out
                  </button>
                </MenuItem>
              </MenuItems>
            </HMenu>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-[calc(var(--tabbar-h)+24px+env(safe-area-inset-bottom))] md:pb-16">
        {children}
      </main>

      {/* Bottom tabs: under 768px */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-14 grid-cols-4">
          {MAIN_NAV.slice(0, 3).map((n) => {
            const on = isActive(pathname, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex h-full flex-col items-center justify-center gap-0.5 text-caption",
                    on ? "text-accent" : "text-ink-3",
                  )}
                >
                  <n.icon aria-hidden size={20} strokeWidth={on ? 2 : 1.75} />
                  {n.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cx(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 text-caption",
                MORE_NAV.some((n) => isActive(pathname, n.href)) ? "text-accent" : "text-ink-3",
              )}
            >
              <MoreHorizontal aria-hidden size={20} strokeWidth={1.75} />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" side="bottom">
        <ul className="-mx-2 flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                openPalette();
              }}
              className="flex h-12 w-full items-center gap-3 rounded-sm px-2 text-left text-body text-ink hover:bg-surface-2"
            >
              <Search aria-hidden size={18} className="text-ink-3" />
              Search or jump to…
            </button>
          </li>
          {MORE_NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={isActive(pathname, n.href) ? "page" : undefined}
                className="flex h-12 items-center gap-3 rounded-sm px-2 text-body text-ink hover:bg-surface-2 aria-[current=page]:text-accent"
              >
                <n.icon aria-hidden size={18} className="text-ink-3" />
                {n.label}
              </Link>
            </li>
          ))}
          <li className="mt-2 border-t border-line pt-2">
            <button
              type="button"
              onClick={doSignOut}
              className="flex h-12 w-full items-center gap-3 rounded-sm px-2 text-left text-body text-ink hover:bg-surface-2"
            >
              <LogOut aria-hidden size={18} className="text-ink-3" />
              Sign out
              <span className="ml-auto truncate text-caption font-normal text-ink-3">{who}</span>
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

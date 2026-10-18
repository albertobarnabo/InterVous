"use client";

import { Menu as HMenu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react";
import { Building2, House, LayoutList, LogOut, Plus, Search, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile } from "../../lib/backend/profiles";
import { FIXTURE_MODE } from "../../lib/data/env";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Kbd } from "@/ui/Kbd";
import { Tag } from "@/ui/Chip";
import { AVATAR_CHANGED, isTypingTarget, focusSearch, openNewApplication, openPalette, openShortcuts } from "@/ui/events";

type NavItem = { href: string; label: string; icon: LucideIcon; key: string; also?: string[] };

/** The only three places in the app. Settings and Sign out live in the avatar menu. */
const MAIN_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: House, key: "h", also: ["/today"] },
  { href: "/applications", label: "Applications", icon: LayoutList, key: "a" },
  { href: "/companies", label: "Companies", icon: Building2, key: "c" },
];

const KEY_NAV: NavItem[] = [...MAIN_NAV, { href: "/settings", label: "Settings", icon: Settings, key: "s" }];

function isActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

function Wordmark() {
  return (
    <Link href="/home" className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-full pr-2" aria-label="InterVous, go to Home">
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold tracking-tight text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(26,107,107,0.35)]"
      >
        iv
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">InterVous</span>
    </Link>
  );
}

/**
 * Global keys: g h / g a / g c / g s go to a page, n adds a job, / focuses the page search,
 * ? the shortcut sheet, ⌘K / Ctrl+K the search palette.
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
        const target = KEY_NAV.find((n) => n.key === e.key.toLowerCase());
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

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] text-ink data-focus:bg-ink/[0.06] pointer-coarse:min-h-11";

/** The avatar button and its menu: who is signed in, Settings, Sign out. */
function AccountMenu({ who, avatarUrl, onSignOut }: { who: string; avatarUrl: string | null; onSignOut: () => void }) {
  return (
    <HMenu>
      <MenuButton
        aria-label={`Account menu for ${who}`}
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color,scale] duration-150 ease-out hover:bg-ink/[0.06] active:scale-95 pointer-coarse:size-11"
      >
        <Avatar url={avatarUrl} label={who} size={32} />
      </MenuButton>
      <MenuItems
        anchor={{ to: "bottom end", gap: 8, padding: 12 }}
        transition
        modal={false}
        className="iv-glass-thick z-30 min-w-60 rounded-[18px] p-1.5 shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_40px_rgba(15,23,42,0.16)] transition duration-150 ease-out focus:outline-none data-closed:scale-[0.98] data-closed:opacity-0 motion-reduce:data-closed:scale-100"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar url={avatarUrl} label={who} size={36} />
          <div className="min-w-0">
            <p className="text-caption text-ink-2">Signed in as</p>
            <p className="truncate text-small font-medium text-ink">{who}</p>
          </div>
        </div>
        <MenuSeparator className="mx-2 my-1 h-px bg-ink/[0.08]" />
        <MenuItem>
          <Link href="/settings" className={menuItemClass}>
            <Settings aria-hidden size={18} strokeWidth={2} className="text-ink-2" />
            Settings
          </Link>
        </MenuItem>
        <MenuItem>
          <button type="button" onClick={onSignOut} className={menuItemClass}>
            <LogOut aria-hidden size={18} strokeWidth={2} className="text-ink-2" />
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </HMenu>
  );
}

/**
 * The authenticated shell.
 *  - 768px and up: a floating glass bar: logo · Home, Applications, Companies · Search (⌘K) · Add a job · avatar menu.
 *  - Under 768px: a slim glass bar on top (logo, search, add, avatar) and a glass tab bar at the bottom
 *    with the same three places.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

  const who = FIXTURE_MODE ? "Sample data" : user?.email ?? "You";

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
        className="sr-only z-60 rounded-full bg-white px-4 py-2 text-small text-ink shadow-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-20 px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="iv-glass mx-auto flex h-14 max-w-[calc(var(--content-max)+40px)] items-center gap-2 rounded-[22px] pr-2 pl-3 md:h-16 md:gap-4 md:pl-4">
          <Wordmark />
          <nav aria-label="Main" className="hidden items-center gap-1 rounded-full bg-ink/[0.05] p-1 md:flex">
            {MAIN_NAV.map((n) => {
              const on = isActive(pathname, n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex h-9 cursor-pointer items-center rounded-full px-4 text-[15px] font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
                    on
                      ? "bg-white text-ink shadow-[0_0_0_0.5px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.1)]"
                      : "text-ink-2 hover:bg-white/60 hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            {FIXTURE_MODE ? (
              <Tag tone="caution" className="hidden lg:inline-flex" title="NEXT_PUBLIC_FIXTURES=1: showing sample data, nothing is saved">
                Sample data
              </Tag>
            ) : null}
            <button
              type="button"
              onClick={openPalette}
              className="hidden h-10 cursor-pointer items-center gap-2 rounded-full bg-white/60 pr-1.5 pl-3.5 text-[15px] text-ink-2 shadow-[0_0_0_0.5px_rgba(15,23,42,0.12)] transition-colors duration-150 ease-out hover:bg-white hover:text-ink md:flex lg:w-60"
            >
              <Search aria-hidden size={17} strokeWidth={2} />
              <span>Search</span>
              <Kbd className="ml-auto">⌘K</Kbd>
            </button>
            <IconButton label="Search" icon={Search} onClick={openPalette} className="md:hidden" />
            <Button variant="primary" icon={Plus} onClick={openNewApplication} className="hidden md:inline-flex">
              Add a job
            </Button>
            <IconButton label="Add a job" icon={Plus} variant="primary" size="sm" onClick={openNewApplication} className="size-9 md:hidden" />
            <AccountMenu who={who} avatarUrl={avatarUrl} onSignOut={doSignOut} />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-[calc(var(--tabbar-h)+32px+env(safe-area-inset-bottom))] md:pb-16">
        {children}
      </main>

      {/* Bottom tabs: under 768px */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden">
        <ul className="iv-glass mx-auto grid h-16 max-w-md grid-cols-3 rounded-[24px] px-1.5">
          {MAIN_NAV.map((n) => {
            const on = isActive(pathname, n);
            return (
              <li key={n.href} className="flex items-center">
                <Link
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex h-[52px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px] text-caption transition-colors duration-150",
                    on ? "bg-white/80 text-accent shadow-[0_0_0_0.5px_rgba(15,23,42,0.06)]" : "text-ink-2",
                  )}
                >
                  <n.icon aria-hidden size={22} strokeWidth={on ? 2.2 : 1.8} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { FIXTURE_MODE } from "../../../lib/data/env";
import AppShell from "@/components/AppShell";
import { GlobalSheets } from "@/features/palette/GlobalSheets";
import { Skeleton, SkeletonRow } from "@/ui/Skeleton";

/**
 * The single auth guard for every authenticated page (src/app/(app)/**):
 * signed out → /login?next=<path>. Dev fixture mode (NEXT_PUBLIC_FIXTURES=1 under
 * `next dev`) skips the guard; FIXTURE_MODE is the constant false in production builds.
 *
 * <GlobalSheets/> mounts the ⌘K palette, the New-application sheet and the shortcut sheet once
 * for every authenticated page; they open on the events in src/ui/events.ts.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = FIXTURE_MODE || !!user;

  useEffect(() => {
    if (FIXTURE_MODE || loading || user) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [loading, user, pathname, router]);

  if (!allowed) {
    return (
      <div className="iv-page pt-10" aria-busy="true" aria-label="Loading">
        <Skeleton className="mb-3 h-8 w-48" />
        <Skeleton className="mb-8 w-72" />
        <div className="flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {children}
      <GlobalSheets />
    </AppShell>
  );
}

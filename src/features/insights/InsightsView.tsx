"use client";
// /insights (spec 2.4, 5.4): one column of questions, each with a one-sentence answer, one visual,
// "What to do" and "How this is counted". Every number is computeInsights() from lib/core/insights.mjs,
// the function behind `intervous insights`; nothing is recomputed here.
import { RotateCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { I1Row, I4 } from "../../../lib/core";
import { computeInsights, formatShort } from "../../../lib/core";
import { updateSettings } from "../../../lib/data";
import { Button, Callout, Chip, SegmentedControl, Skeleton, Tag, useToast } from "@/ui";
import { markFollowedUp, markNoReply } from "../today/actions";
import { useCoreInput } from "../today/useCoreInput";
import { useDeferred } from "../today/useDeferred";
import { Gaps, Told } from "./Content";
import { HowFar, OlderRecords, Sending } from "./Pipeline";
import { AimingGroups, AnswersFigure, OwedList, ReplyAxis } from "./Replies";
import { InsightSection } from "./Section";
import { Pay, TrustCounts } from "./Trust";

type WindowMode = "campaign" | "all";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="iv-page">
      <div className="mx-auto w-full max-w-[720px] pt-8 pb-16 sm:pt-12">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Loading insights">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-3 w-full max-w-lg" lines={2} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-12">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="mt-3 w-full max-w-md" />
            <Skeleton className="mt-6 h-24 w-full" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function InsightsView() {
  const core = useCoreInput();
  const deferred = useDeferred();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const windowMode: WindowMode = params.get("window") === "all" ? "all" : "campaign";
  const onlyConfirmed = params.get("confirmed") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const r = useMemo(
    () => (core.input ? computeInsights(core.input, { window: windowMode, onlyConfirmed }) : null),
    [core.input, windowMode, onlyConfirmed],
  );

  // deep links (#i2 from Today) land after the data renders
  const ready = Boolean(r);
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [ready]);

  if (core.error && !core.input) {
    return (
      <Frame>
        <h1 className="text-h1-sm sm:text-h1">Insights</h1>
        <Callout
          tone="danger"
          title="Insights could not load"
          className="mt-6"
          action={
            <Button size="sm" icon={RotateCw} onClick={() => void core.refetch()}>
              Try again
            </Button>
          }
        >
          {core.error.message}
        </Callout>
      </Frame>
    );
  }
  if (!r || !core.raw) return <Loading />;

  const settings = core.raw.settings;
  const today = core.raw.today;
  const campaignLabel = `Since ${formatShort(settings.campaign_start, { withYear: true })}`;

  const followedUp = (row: I1Row) =>
    deferred.defer({ id: `i1:${row.appId}`, text: `Followed up with ${row.company}`, commit: () => markFollowedUp(row.appId, today) });
  const noReply = (row: I1Row) =>
    deferred.defer({ id: `i1:${row.appId}`, text: `Marked ${row.company} as no reply`, commit: () => markNoReply(row.appId, today) });

  const applyThresholds = (s: NonNullable<I4["suggestion"]>) => {
    const before = { no_reply_after_days: settings.no_reply_after_days, follow_up_after_days: settings.follow_up_after_days };
    void updateSettings(s).then(
      () =>
        toast.show({
          kind: "success",
          text: `No-reply line now ${s.no_reply_after_days} days, follow up after ${s.follow_up_after_days}.`,
          action: { label: "Undo", run: () => void updateSettings(before) },
        }),
      (e: unknown) => toast.show({ kind: "error", text: `Not saved: ${e instanceof Error ? e.message : "something went wrong"}` }),
    );
  };

  return (
    <Frame>
      <header>
        <h1 className="text-h1-sm text-ink sm:text-h1">Insights</h1>
        <p className="mt-3 max-w-[62ch] text-body text-ink-2">{r.intro}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SegmentedControl
            aria-label="Window"
            value={windowMode}
            onChange={(v) => setParam("window", v === "all" ? "all" : null)}
            options={[
              { value: "campaign", label: campaignLabel },
              { value: "all", label: "All" },
            ]}
          />
          <Chip selected={onlyConfirmed} onClick={() => setParam("confirmed", onlyConfirmed ? null : "1")}>
            Only confirmed
          </Chip>
          {r.badge ? (
            <Tag tone="caution" title="Rows with unconfirmed facts are counted and drawn as hollow dots">
              {r.badge}
            </Tag>
          ) : null}
        </div>
        {windowMode === "all" && r.older.count ? (
          <p className="mt-3 text-caption font-normal text-ink-3">
            &ldquo;All&rdquo; mixes in {r.older.count} older records, which are incomplete. Their own block stays at the bottom.
          </p>
        ) : null}
      </header>

      <div className="mt-8 flex flex-col gap-8">
        <InsightSection data={r.i1}>
          <OwedList data={r.i1} hidden={deferred.hidden} onFollowedUp={followedUp} onNoReply={noReply} />
        </InsightSection>

        <InsightSection
          data={r.i2}
          rateBased
          aside={
            r.i2.unconfirmedIncluded ? (
              <Tag title="Drawn as hollow dots">includes {r.i2.unconfirmedIncluded} unconfirmed</Tag>
            ) : null
          }
        >
          <AnswersFigure data={r.i2} />
        </InsightSection>

        <InsightSection data={r.i3} rateBased>
          <HowFar data={r.i3} />
        </InsightSection>

        <InsightSection data={r.i4}>
          <ReplyAxis data={r.i4} settings={settings} onApply={applyThresholds} />
        </InsightSection>

        <InsightSection data={r.i5} rateBased>
          <Sending data={r.i5} today={today} staleAfter={settings.draft_stale_after_days} />
        </InsightSection>

        <InsightSection data={r.i6}>
          <Gaps data={r.i6} />
        </InsightSection>

        <InsightSection data={r.i7}>
          <Told data={r.i7} />
        </InsightSection>

        <InsightSection data={r.i8} rateBased>
          <AimingGroups data={r.i8} />
        </InsightSection>

        <InsightSection data={r.i9}>
          <TrustCounts data={r.i9} />
        </InsightSection>

        <OlderRecords older={r.older} />

        <InsightSection data={r.i10}>
          <Pay data={r.i10} />
        </InsightSection>
      </div>
    </Frame>
  );
}

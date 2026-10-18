import { cx } from "./cx";

export type WeekBarsProps = {
  /** One entry per ISO week, oldest first. `start` is the Monday, 'YYYY-MM-DD'. */
  weeks: { start: string; series: { built: number; sent: number } }[];
  className?: string;
  /** Bar area height in px (default 96). */
  height?: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** '2026-08-24' → '24 Aug' (local date, no time-zone shift). */
function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/**
 * CVs built vs applications sent per week, as two thin bar series.
 * Drawn with HTML at container width (not a scaled SVG), so labels stay at 13px.
 */
export function WeekBars({ weeks, className, height = 96 }: WeekBarsProps) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.series.built, w.series.sent]));
  const labelEvery = weeks.length > 8 ? 3 : 1;
  return (
    <figure className={cx("w-full", className)}>
      <div aria-hidden className="flex items-end gap-1 border-b border-line-strong sm:gap-2" style={{ height }}>
        {weeks.map((w) => (
          <div key={w.start} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`Week of ${shortDate(w.start)}: ${w.series.built} built, ${w.series.sent} sent`}>
            <span className="w-1.5 rounded-t-sm bg-line-strong sm:w-2" style={{ height: `${(w.series.built / max) * 100}%` }} />
            <span className="w-1.5 rounded-t-sm bg-accent sm:w-2" style={{ height: `${(w.series.sent / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex gap-1 sm:gap-2">
        {weeks.map((w, i) => (
          <span
            key={w.start}
            className={cx(
              "iv-num flex min-w-0 flex-1 text-caption font-normal whitespace-nowrap text-ink-3",
              // keep the first and last labels inside the chart so nothing overflows at 375px
              i === 0 ? "justify-start" : i === weeks.length - 1 ? "justify-end" : "justify-center",
            )}
          >
            {i === weeks.length - 1 || (i % labelEvery === 0 && weeks.length - 1 - i >= labelEvery) ? shortDate(w.start) : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 flex gap-4 text-caption font-normal text-ink-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-line-strong" /> CVs built
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent" /> Sent
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>CVs built and applications sent per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Built</th>
            <th scope="col">Sent</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">{shortDate(w.start)}</th>
              <td>{w.series.built}</td>
              <td>{w.series.sent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

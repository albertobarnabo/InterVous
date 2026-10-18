"use client";

import { Eye, EyeOff, FileText, ListChecks, MessagesSquare, type LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { BrandMark, IconButton, cx } from "@/ui";
import { controlClass } from "@/ui/Field";

const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ListChecks, title: "What to do today", text: "One short list: who to follow up, what to send, what to update." },
  { icon: FileText, title: "The CV you sent", text: "Every application keeps the exact CV and job post it went with." },
  { icon: MessagesSquare, title: "Who answered", text: "Replies, interviews and silences, so nothing slips." },
];

/**
 * The sign-in and reset pages share this frame: one large glass panel with the brand and
 * what InterVous does on the left, the form on the right. Under 900px it stacks: a compact
 * brand header, then the form, then the three points.
 */
export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* the mark, very large and faint, so the page has a shape behind the glass */}
      <BrandMark
        size={760}
        strokeWidth={3}
        className="pointer-events-none absolute -right-48 -top-40 hidden text-accent/[0.07] min-[900px]:block"
      />
      <main className="iv-glass relative grid w-full max-w-[980px] overflow-hidden rounded-[32px] min-[900px]:grid-cols-[1.05fr_1fr]">
        <section className="relative flex flex-col justify-between gap-10 p-8 sm:p-10 min-[900px]:p-12">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size={44} strokeWidth={8} />
              <span className="text-[24px] font-semibold tracking-tight text-ink">InterVous</span>
            </div>
            <h2 className="mt-10 max-w-[18ch] text-[34px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[40px]">
              Every job application, in one calm place.
            </h2>
            <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-ink-2">
              Track what you sent, hear what happened, and always know the next step.
            </p>
          </div>
          <ul className="hidden flex-col gap-5 min-[900px]:flex">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white/70 text-accent shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_8px_rgba(15,23,42,0.06)]">
                  <Icon aria-hidden size={20} strokeWidth={2} />
                </span>
                <span>
                  <span className="block text-body font-semibold text-ink">{t}</span>
                  <span className="block text-small text-ink-2">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="iv-glass-solid m-2 flex flex-col justify-center rounded-[26px] p-7 sm:p-10 min-[900px]:m-3">
          <h1 className="text-h2 text-ink">{title}</h1>
          {lead ? <p className="mt-2 text-body text-ink-2">{lead}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-center text-body text-ink-2">{footer}</div> : null}
        </section>
      </main>
    </div>
  );
}

/** A password input with a show/hide button. */
export function PasswordInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cx(controlClass, "h-12 pr-12", className)} {...rest} />
      <span className="absolute inset-y-0 right-1.5 flex items-center">
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          icon={visible ? EyeOff : Eye}
          size="sm"
          onClick={() => setVisible((v) => !v)}
          className="size-9 pointer-coarse:size-10"
        />
      </span>
    </div>
  );
}

/** Where to go after signing in: ?next= when it is a path inside the app, else Home. */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/home";
  try {
    const n = decodeURIComponent(next);
    if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return "/home";
    if (/^\/(login|reset-password)(\/|$|\?)/.test(n)) return "/home";
    return n;
  } catch {
    return "/home";
  }
}

/** Supabase auth messages, said plainly. */
export function authMessage(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/invalid login credentials/i.test(m)) return "That email and password do not match.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first: the link is in your inbox.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute, then try again.";
  if (/network|fetch/i.test(m)) return "No connection to the server. Check your internet and try again.";
  if (/same.*password|different from the old/i.test(m)) return "Choose a password you have not used here before.";
  return m || fallback;
}

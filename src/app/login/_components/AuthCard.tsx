"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { GlassCard, IconButton, cx } from "@/ui";
import { controlClass } from "@/ui/Field";

/** The glass card the sign-in and reset pages share: logo, one title, one line, the form. */
export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-[14px] bg-accent text-[19px] font-semibold tracking-tight text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_rgba(26,107,107,0.35)]"
          >
            iv
          </span>
          <span className="text-h3 tracking-tight text-ink">InterVous</span>
        </div>
        <GlassCard radius="sheet" padding="lg">
          <h1 className="text-h2 text-ink">{title}</h1>
          {lead ? <p className="mt-2 text-body text-ink-2">{lead}</p> : null}
          <div className="mt-7">{children}</div>
        </GlassCard>
        {footer ? <div className="mt-5 text-center text-body text-ink-2">{footer}</div> : null}
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

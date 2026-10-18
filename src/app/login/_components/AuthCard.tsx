"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { IconButton, cx } from "@/ui";
import { controlClass } from "@/ui/Field";

/** The plain card the sign-in and reset pages share: wordmark, one title, one line, the form. */
export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-sm bg-accent font-serif text-[16px] font-semibold text-accent-ink">
            iv
          </span>
          <span className="text-body font-semibold text-ink">InterVous</span>
        </div>
        <div className="rounded-lg bg-surface p-6 shadow-1 sm:p-8">
          <h1 className="text-h3 text-ink">{title}</h1>
          {lead ? <p className="mt-1 text-small text-ink-2">{lead}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-small text-ink-2">{footer}</div> : null}
      </main>
    </div>
  );
}

/** A password input with a show/hide button. */
export function PasswordInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cx(controlClass, "h-11 pr-11 text-body", className)} {...rest} />
      <span className="absolute inset-y-0 right-1.5 flex items-center">
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          icon={visible ? EyeOff : Eye}
          size="sm"
          onClick={() => setVisible((v) => !v)}
          className="pointer-coarse:size-9"
        />
      </span>
    </div>
  );
}

/** Where to go after signing in: ?next= when it is a path inside the app, else Today. */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/today";
  try {
    const n = decodeURIComponent(next);
    if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return "/today";
    if (/^\/(login|reset-password)(\/|$|\?)/.test(n)) return "/today";
    return n;
  } catch {
    return "/today";
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

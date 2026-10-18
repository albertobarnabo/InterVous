"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { appUrl } from "../../../../lib/api";
import { supabase } from "../../../../lib/supbaseClient";
import { Button, Field, Input } from "@/ui";
import { AuthCard, PasswordInput, authMessage, safeNext } from "./AuthCard";

type Mode = "signin" | "forgot";

/** Sign in (sign-up is off: one account), or ask for a reset link. Honours ?next=. */
export default function LoginForm() {
  const { user, loading: authLoading, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<Mode>(params.get("mode") === "forgot" ? "forgot" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) router.replace(next);
  }, [authLoading, user, next, router]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        router.replace(next);
        return;
      }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${appUrl("reset-password")}`,
      });
      if (err) throw err;
      setSent(email.trim());
    } catch (err) {
      setError(authMessage(err, mode === "signin" ? "You were not signed in. Try again." : "The link was not sent. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (mode === "forgot") {
    return (
      <AuthCard
        title="Reset your password"
        lead="We email you a link. It opens a page where you choose a new one."
        footer={
          <button type="button" onClick={() => switchTo("signin")} className="text-accent underline-offset-4 hover:underline">
            Back to sign in
          </button>
        }
      >
        {sent ? (
          <p role="status" className="rounded-sm bg-accent-soft px-3 py-2.5 text-small text-ink">
            If <span className="font-medium">{sent}</span> has an account, the link is on its way. Check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate={false}>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                className="h-11 text-body"
              />
            </Field>
            {error ? (
              <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-small text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" loading={busy} className="h-11 w-full">
              Send the reset link
            </Button>
          </form>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Sign in" lead="Your applications, and what needs you today.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="h-11 text-body"
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="password" className="text-small font-medium text-ink">
              Password
            </label>
            <button type="button" onClick={() => switchTo("forgot")} className="text-small text-accent underline-offset-4 hover:underline">
              Forgot it?
            </button>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
        </div>
        {error ? (
          <p id="signin-error" role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-small text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={busy} disabled={!email.trim() || !password} className="h-11 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}

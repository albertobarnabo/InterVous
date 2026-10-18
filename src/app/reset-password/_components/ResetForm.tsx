"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../../../lib/supbaseClient";
import { Button, ButtonLink, Skeleton } from "@/ui";
import { AuthCard, PasswordInput, authMessage } from "../../login/_components/AuthCard";

const MIN = 8;

/** The page the reset email links to. The link signs you in through the URL; then you choose a new password. */
export default function ResetForm() {
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) {
        settled = true;
        setSession(true);
      } else if (event === "SIGNED_OUT") setSession(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setSession(true);
        return;
      }
      // The recovery token in the URL hash can take a moment to be exchanged.
      setTimeout(() => {
        if (!settled) setSession(false);
      }, 1500);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const tooShort = password.length > 0 && password.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords are different.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      router.replace("/home");
    } catch (err) {
      setError(authMessage(err, "The password was not changed. Try again."));
      setBusy(false);
    }
  };

  if (session === null) {
    return (
      <AuthCard title="Set a new password">
        <div aria-busy="true" aria-label="Checking the link" className="flex flex-col gap-4">
          <Skeleton className="h-12 rounded-[12px]" />
          <Skeleton className="h-12 rounded-[12px]" />
          <Skeleton className="h-12 rounded-full" />
        </div>
      </AuthCard>
    );
  }

  if (session === false) {
    return (
      <AuthCard
        title="This link has expired"
        lead="Reset links work once and for a short time. Ask for a new one."
        footer={
          <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <ButtonLink href="/login?mode=forgot" variant="primary" size="lg" className="w-full">
          Send a new link
        </ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" lead={`At least ${MIN} characters.`}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-small font-medium text-ink">
            New password
          </label>
          <PasswordInput
            id="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
            minLength={MIN}
            aria-invalid={tooShort || undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-small font-medium text-ink">
            The same again
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? "confirm-hint" : undefined}
          />
          {mismatch ? (
            <p id="confirm-hint" className="text-small text-danger">
              Not the same yet.
            </p>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-[14px] bg-danger-soft px-4 py-3 text-small text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!password || !confirm} className="mt-1 w-full">
          Save the new password
        </Button>
      </form>
    </AuthCard>
  );
}

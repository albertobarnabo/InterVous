import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./_components/LoginForm";

export const metadata: Metadata = { title: "Sign in · InterVous" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

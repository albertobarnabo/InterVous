import type { Metadata } from "next";
import ResetForm from "./_components/ResetForm";

export const metadata: Metadata = { title: "New password · InterVous" };

export default function ResetPasswordPage() {
  return <ResetForm />;
}

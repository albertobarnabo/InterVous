import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "../../contexts/AuthContext";
import { ToastProvider } from "@/ui/Toast";

// One family everywhere (globals.css maps font-sans, font-serif and font-mono to it).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "InterVous",
  description: "Your job applications in one place: what to do next, the CV you sent, and what happened.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#F4F6FA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable} style={{ colorScheme: "light" }}>
      <body className="min-h-dvh font-sans text-body text-ink antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

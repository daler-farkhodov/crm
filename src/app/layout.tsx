import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeBootScript } from "@/components/ThemeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TutorCRM",
  description: "Tutor center operations, billing, and payroll.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden bg-slate-100 antialiased dark:bg-slate-950 dark:text-slate-100`}
      >
        {/* First in body: runs before React hydrates (Next may inject a hidden marker above). */}
        <ThemeBootScript />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Timesheets", template: "%s · Timesheets" },
  description: "Daily work log for IT QI Group",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("tl_theme")?.value === "dark" ? "dark" : "light";
  const sidebar = jar.get("tl_sidebar")?.value === "locked" ? "locked" : "rail";
  return (
    <html lang="en" data-theme={theme} data-sidebar={sidebar} suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans`}>{children}</body>
    </html>
  );
}

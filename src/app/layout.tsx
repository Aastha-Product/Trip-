import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Plan Pakka · Plan a group trip in minutes",
  description: "Share one link, everyone adds their preferences, and get the trips that work for the whole group.",
};

export const viewport: Viewport = { themeColor: "#6d28d9" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-5">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-stone-900">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-base text-white shadow-md shadow-violet-600/30">✈</span>
            Plan Pakka
          </Link>
          <Link href="/new" className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
            + New trip
          </Link>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
        <footer className="px-4 pb-8 text-center text-xs text-stone-500">
          Plan Pakka suggests. Your group decides. Prices are estimates from Google.
        </footer>
      </body>
    </html>
  );
}

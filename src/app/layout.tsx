import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Plan Pakka · Group trip planner",
  description: "One link for everyone's preferences. Get the 3 trips that work for your group, and a plan to bring everyone along.",
};

export const viewport: Viewport = { themeColor: "#f97316" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="h-1.5 bg-[repeating-linear-gradient(90deg,#f97316_0_24px,#14b8a6_24px_48px,#ec4899_48px_72px,#facc15_72px_96px)]" />
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight text-stone-900">
            Plan <span className="text-orange-500">Pakka</span> 🧳
          </Link>
          <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50">
            + New trip
          </Link>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="px-4 py-8 text-center text-xs text-stone-500">
          Plan Pakka recommends. Your group decides and books. Prices are estimates from Google search.
        </footer>
      </body>
    </html>
  );
}

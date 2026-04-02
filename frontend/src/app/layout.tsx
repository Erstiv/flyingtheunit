import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Unit",
  description: "Cross-platform social intelligence & entity mapping",
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/topics", label: "Topics" },
  { href: "/entities", label: "Entities" },
  { href: "/graph", label: "Graph" },
  { href: "/search", label: "Search" },
  { href: "/alerts", label: "Alerts" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-56 border-r border-[var(--border)] p-4 flex flex-col gap-1 shrink-0">
            <div className="text-lg font-bold text-white mb-6 px-3">
              THE UNIT
            </div>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-white hover:bg-[var(--card)] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </aside>

          {/* Main */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

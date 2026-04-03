"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "\u25A3" },
  { href: "/topics", label: "Topics", icon: "#" },
  { href: "/memes", label: "Meme Lab", icon: "\u26A1" },
  { href: "/queue", label: "Queue", icon: "\u2192" },
  { href: "/characters", label: "Characters", icon: "\u263A" },
  { href: "/graph", label: "Graph", icon: "\u25CB" },
  { href: "/search", label: "Search", icon: "\u2315" },
  { href: "/entities", label: "Entities", icon: "\u2302" },
  { href: "/alerts", label: "Alerts", icon: "\u25B2" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <title>The Unit</title>
        <meta name="description" content="Cross-platform social intelligence & meme response" />
      </head>
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-56 border-r border-[var(--border)] p-4 flex flex-col gap-0.5 shrink-0">
            <div className="text-lg font-bold text-white mb-6 px-3 tracking-wider">
              THE UNIT
            </div>
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                    isActive
                      ? "bg-[var(--card)] text-white border border-[var(--border)]"
                      : "text-[var(--muted)] hover:text-white hover:bg-[var(--card)]"
                  }`}
                >
                  <span className="text-xs opacity-60 w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}

            {/* Bottom section */}
            <div className="mt-auto pt-4 border-t border-[var(--border)]">
              <Link href="/settings"
                className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-white hover:bg-[var(--card)] transition-colors flex items-center gap-2.5">
                <span className="text-xs opacity-60 w-4 text-center">{"\u2699"}</span>
                Settings
              </Link>
              <div className="px-3 py-2 text-[10px] text-[var(--muted)]">
                flyingtheunit v0.1
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

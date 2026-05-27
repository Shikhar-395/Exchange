"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CandlestickChart, Home } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const BRAND_LOGO_URL =
  "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center";

const navItems = [
  { href: "/", label: "Home", icon: Home, match: "/" },
  {
    href: "/trade/SOL_USDC",
    label: "Trade",
    icon: CandlestickChart,
    match: "/trade",
  },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full px-3 md:px-4 py-2 bg-[color-mix(in_srgb,var(--exchange-bg)_80%,transparent)] text-[var(--exchange-text)] backdrop-blur-xl border-none">
      <div className="relative flex h-11 w-full items-center justify-between">
        {/* Left: Brand Logo & Name */}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-[var(--exchange-text)] mac-app-hover"
          >
            <img
              src={BRAND_LOGO_URL}
              alt="Exchange logo"
              className="size-7 rounded-full object-cover shadow-sm bg-white/5"
              loading="eager"
            />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Exchange
            </span>
          </Link>
        </div>

        {/* Center: Clean Center Navigation bar (macOS Pill style with pop up hover) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <nav
            className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.match === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.match);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold tracking-tight text-[var(--exchange-text-muted)] mac-app-hover",
                    "hover:bg-black/5 dark:hover:bg-white/8 hover:text-[var(--exchange-text)]",
                    isActive &&
                      "bg-white dark:bg-white/12 text-[var(--exchange-text)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Controls in the far right corner with macOS pop up hover */}
        <div className="flex items-center gap-1.5 ml-auto">
          <UserMenu />
          <div className="mac-app-hover">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const BRAND_LOGO_URL =
  "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center";

export function Navbar() {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur",
        "border-[var(--auth-border)] bg-[var(--auth-base)]/95 text-[var(--auth-text)]",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={BRAND_LOGO_URL}
              alt="Exchange logo"
              className="size-7 rounded-full border border-[var(--auth-border)] object-cover"
              loading="eager"
            />
            <span className="text-lg font-bold tracking-tight">Exchange</span>
          </Link>
          <Link
            href="/markets"
            className="text-sm text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
          >
            Markets
          </Link>
          <Link
            href="/trade/SOL_USDC"
            className="text-sm text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
          >
            Trade
          </Link>
        </div>
        <nav className="flex items-center gap-2">
          <UserMenu />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

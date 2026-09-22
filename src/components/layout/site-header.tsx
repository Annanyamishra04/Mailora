import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] font-medium text-ink-soft md:flex">
          <Link href="/#product" className="transition-colors hover:text-ink">
            Product
          </Link>
          <Link href="/#how-it-works" className="transition-colors hover:text-ink">
            How it works
          </Link>
          <Link href="/login" className="transition-colors hover:text-ink">
            Log in
          </Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <ThemeToggle className="hidden md:inline-flex" />
          <Button asChild size="sm" variant="teal">
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

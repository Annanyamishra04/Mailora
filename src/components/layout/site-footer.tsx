import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <Logo className="text-[16px]" />
        <p className="text-[13px] text-ink-faint">
          &copy; {new Date().getFullYear()} AI Mail Studio. Built for people who
          would rather send than stare at a blank draft.
        </p>
        <nav className="flex items-center gap-5 text-[13px] text-ink-faint">
          <Link href="/login" className="transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="transition-colors hover:text-ink">
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col px-6 py-6 md:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">
            <p className="text-[13px] font-medium text-teal">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[26px] font-medium tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-[14px] text-ink-soft">{description}</p>

            <div className="mt-8">{children}</div>

            <p className="mt-6 text-[13.5px] text-ink-faint">{footer}</p>
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 items-center justify-center border-l border-line bg-paper-raised lg:flex">
        <div className="max-w-sm px-10 text-center">
          <p className="font-display text-[22px] leading-snug text-ink">
            &ldquo;I used to draft the same follow-up four different ways
            before sending it. Now I write one sentence and pick the
            tone.&rdquo;
          </p>
          <p className="mt-4 text-[13px] text-ink-faint">
            A note from an early AI Mail Studio user
          </p>
        </div>
      </div>
    </div>
  );
}

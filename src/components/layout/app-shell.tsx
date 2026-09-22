import Link from "next/link";
import {
  LayoutGrid,
  PenSquare,
  Reply,
  Clock,
  FileStack,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/reply", label: "Reply", icon: Reply },
  { href: "/templates", label: "Templates", icon: FileStack },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  active,
  title,
  description,
  actions,
}: {
  children: React.ReactNode;
  active: (typeof NAV_ITEMS)[number]["href"];
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper-raised md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
                  isActive
                    ? "bg-teal-tint text-teal-strong"
                    : "text-ink-soft hover:bg-paper hover:text-ink",
                )}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <UserMenu />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5 md:px-8">
          <div>
            <h1 className="font-display text-[19px] font-medium text-ink">{title}</h1>
            {description ? (
              <p className="text-[13px] text-ink-faint">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-5 py-6 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-paper-raised py-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-teal-strong" : "text-ink-faint",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

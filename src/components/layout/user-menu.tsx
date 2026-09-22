"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { markIntentionalSignOut } from "@/lib/api-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function initialsFor(name: string | undefined, email: string | undefined): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Sidebar profile block. Shows the authenticated Supabase user's display
 * name (from `user_metadata.full_name`, if set at signup) and email, with
 * sign-out in a dropdown. This is the one piece of the app shell that
 * needs to be a client component — everything else in `AppShell` stays
 * server-renderable.
 */
export function UserMenu() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      markIntentionalSignOut();
      await supabase.auth.signOut();
    } catch {
      // Best effort — still redirect to /login even if the network call
      // failed, since the client-side session state is cleared either way.
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) || undefined;
  const email = user?.email;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 border-t border-line px-5 py-4">
        <Avatar className="h-8 w-8">
          <AvatarFallback>…</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink-faint">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 border-t border-line px-5 py-4 text-left transition-colors hover:bg-paper">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initialsFor(displayName, email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{displayName || email || "Account"}</p>
          <p className="truncate text-[12px] text-ink-faint">{email ?? ""}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium text-ink">{displayName || "Account"}</p>
          <p className="truncate text-[12px] text-ink-faint">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} disabled={isSigningOut}>
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

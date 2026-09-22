"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/hooks/use-preferences";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_LENGTHS, EMAIL_TONES } from "@/lib/types";
import type { EmailLength, EmailTone } from "@/lib/types";
import { PreviewNote } from "@/components/shared/preview-note";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 py-8 first:pt-0 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">{description}</p>
      </div>
      <div className="max-w-md space-y-4">{children}</div>
    </section>
  );
}

export function SettingsWorkspace() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { preferences, isLoaded, update } = usePreferences();
  const [mounted, setMounted] = React.useState(false);
  const [signatureDraft, setSignatureDraft] = React.useState("");
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const displayName = (user?.user_metadata?.full_name as string | undefined) || "";
  const email = user?.email ?? "";
  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast({ title: "Signed out", variant: "success" });
    } catch (error) {
      toast({
        title: "Couldn't sign out",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR-safe mount check for theme-dependent UI
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing a local edit buffer from storage once it loads
      setSignatureDraft(preferences.signatureName);
    }
  }, [isLoaded, preferences.signatureName]);

  function handleToneChange(value: EmailTone) {
    update({ defaultTone: value });
    toast({ title: "Default tone updated", variant: "success" });
  }

  function handleLengthChange(value: EmailLength) {
    update({ defaultLength: value });
    toast({ title: "Default length updated", variant: "success" });
  }

  function handleAutoSignOffChange(checked: boolean) {
    update({ autoSignOff: checked });
    toast({
      title: checked ? "Sign-off enabled" : "Sign-off disabled",
      variant: "success",
    });
  }

  function handleSignatureBlur() {
    if (signatureDraft === preferences.signatureName) return;
    update({ signatureName: signatureDraft });
    toast({ title: "Signature updated", variant: "success" });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PreviewNote>
        Your account and writing preferences are saved to your signed-in
        account. Password changes and account deletion aren&apos;t available
        yet.
      </PreviewNote>

      <div className="divide-y divide-line">
        <SettingsSection title="Profile" description="Your name and email as they appear across AI Mail Studio.">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-[15px]">{initials}</AvatarFallback>
            </Avatar>
            <Button type="button" disabled variant="outline" size="sm">
              Change photo
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" value={displayName || "Not set"} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email} disabled />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </SettingsSection>

        <SettingsSection title="Appearance" description="How AI Mail Studio looks on this device.">
          <div className="space-y-1.5">
            <Label htmlFor="theme">Theme</Label>
            <Select value={mounted ? theme : undefined} onValueChange={setTheme}>
              <SelectTrigger id="theme" className="max-w-xs">
                <SelectValue placeholder="System" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">Match system</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Writing preferences"
          description="Defaults applied to every new email you compose."
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default-tone">Default tone</Label>
              <Select value={preferences.defaultTone} onValueChange={handleToneChange}>
                <SelectTrigger id="default-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default-length">Default length</Label>
              <Select value={preferences.defaultLength} onValueChange={handleLengthChange}>
                <SelectTrigger id="default-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_LENGTHS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-line px-3.5 py-3">
            <div>
              <p className="text-[13.5px] font-medium text-ink">
                Sign a closing line automatically
              </p>
              <p className="text-[12.5px] text-ink-faint">
                Adds your name to the end of generated drafts.
              </p>
            </div>
            <Switch
              checked={preferences.autoSignOff}
              onCheckedChange={handleAutoSignOffChange}
              aria-label="Sign a closing line automatically"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signature-name">Signature name</Label>
            <Input
              id="signature-name"
              placeholder="e.g. Jordan"
              value={signatureDraft}
              onChange={(e) => setSignatureDraft(e.target.value)}
              onBlur={handleSignatureBlur}
              disabled={!preferences.autoSignOff}
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Password" description="Change the password used to log in.">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" disabled />
          </div>
          <Button type="button" disabled variant="outline" size="sm">
            Update password
          </Button>
        </SettingsSection>

        <SettingsSection
          title="Danger zone"
          description="Permanently delete your account and saved emails."
        >
          <div className="rounded-md border border-danger/30 bg-danger-tint px-4 py-3.5">
            <p className="text-[13.5px] font-medium text-danger">Delete account</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-danger/80">
              This removes your profile and every saved email. It can&apos;t be undone.
            </p>
            <Button type="button" disabled variant="destructive" size="sm" className="mt-3">
              Delete my account
            </Button>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

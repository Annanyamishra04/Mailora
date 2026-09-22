import { AppShell } from "@/components/layout/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default function SettingsPage() {
  return (
    <AppShell
      active="/settings"
      title="Settings"
      description="Manage your profile and preferences"
    >
      <SettingsWorkspace />
    </AppShell>
  );
}

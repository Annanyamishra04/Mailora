import { AppShell } from "@/components/layout/app-shell";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";

export default function DashboardPage() {
  return (
    <AppShell
      active="/dashboard"
      title="Dashboard"
      description="A quick look at your writing"
    >
      <DashboardWorkspace />
    </AppShell>
  );
}

import { AppShell } from "@/components/layout/app-shell";
import { HistoryWorkspace } from "@/components/history/history-workspace";

export default function HistoryPage() {
  return (
    <AppShell
      active="/history"
      title="History"
      description="Every email you've generated or saved"
    >
      <HistoryWorkspace />
    </AppShell>
  );
}

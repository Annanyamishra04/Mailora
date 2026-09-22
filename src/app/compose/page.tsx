import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ComposeWorkspace } from "@/components/compose/compose-workspace";
import { PageLoading } from "@/components/shared/page-loading";

export default function ComposePage() {
  return (
    <AppShell
      active="/compose"
      title="Compose"
      description="Describe the email, then edit the draft"
    >
      <Suspense fallback={<PageLoading label="Loading composer…" />}>
        <ComposeWorkspace />
      </Suspense>
    </AppShell>
  );
}

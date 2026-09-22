import { AppShell } from "@/components/layout/app-shell";
import { TemplatesWorkspace } from "@/components/templates/templates-workspace";

export default function TemplatesPage() {
  return (
    <AppShell
      active="/templates"
      title="Templates"
      description="Starter templates and your own reusable drafts"
    >
      <TemplatesWorkspace />
    </AppShell>
  );
}

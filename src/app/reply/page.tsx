import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ReplyWorkspace } from "@/components/reply/reply-workspace";
import { PageLoading } from "@/components/shared/page-loading";

export default function ReplyPage() {
  return (
    <AppShell
      active="/reply"
      title="Reply"
      description="Paste an email you received, then generate a reply to edit"
    >
      {/* ReplyWorkspace reads ?id= via useSearchParams, which must sit inside a
          Suspense boundary or `next build` fails while prerendering this page. */}
      <Suspense fallback={<PageLoading label="Loading reply workspace…" />}>
        <ReplyWorkspace />
      </Suspense>
    </AppShell>
  );
}

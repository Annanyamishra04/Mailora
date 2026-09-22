"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenSquare, Inbox, Star, Clock, CalendarDays, Reply, FileEdit, FileStack } from "lucide-react";
import { useEmails } from "@/hooks/use-emails";
import { useTemplates } from "@/hooks/use-templates";
import { useToast } from "@/hooks/use-toast";
import { EmailListItem } from "@/components/history/email-list-item";
import { TemplateCard } from "@/components/templates/template-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AiLoadingState } from "@/components/shared/ai-loading-state";
import { AiErrorState } from "@/components/shared/ai-error-state";
import { Button } from "@/components/ui/button";

const RECENT_LIMIT = 5;
const FAVORITES_LIMIT = 4;
const DRAFTS_LIMIT = 4;
const TEMPLATES_LIMIT = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function DashboardWorkspace() {
  const router = useRouter();
  const { emails, isLoaded, error, toggleFavorite, deleteEmail, refresh } = useEmails();
  const { templates } = useTemplates();
  const { toast } = useToast();

  if (!isLoaded) {
    return <AiLoadingState label="Loading your dashboard…" />;
  }

  if (error) {
    return <AiErrorState message={error} onRetry={refresh} />;
  }

  const favorites = emails.filter((e) => e.favorite);
  const drafts = emails.filter((e) => e.type === "draft");
  const replies = emails.filter((e) => e.type === "reply");
  const createdThisWeek = emails.filter((e) => {
    // eslint-disable-next-line react-hooks/purity -- rough "this week" bucket for a dashboard stat, doesn't need to be render-pure
    const ageMs = Date.now() - new Date(e.createdAt).getTime();
    return ageMs <= WEEK_MS;
  });

  const stats = [
    { label: "Saved emails", value: emails.length, icon: Inbox },
    { label: "Drafts", value: drafts.length, icon: FileEdit },
    { label: "Replies", value: replies.length, icon: Reply },
    { label: "Favorited", value: favorites.length, icon: Star },
    { label: "This week", value: createdThisWeek.length, icon: CalendarDays },
  ];

  async function handleToggleFavorite(id: string) {
    try {
      const updated = await toggleFavorite(id);
      if (updated) {
        toast({
          title: updated.favorite ? "Added to favorites" : "Removed from favorites",
          variant: "success",
        });
      }
    } catch (err) {
      toast({
        title: "Couldn't update favorite",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEmail(id);
      toast({ title: "Deleted", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't delete",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 rounded-lg border border-line bg-paper-raised px-6 py-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-[19px] font-medium text-ink">
            Ready when you are
          </h2>
          <p className="mt-1 text-[14px] text-ink-faint">
            Describe the email you need and AI Mail Studio will draft it —
            subject line included.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="lg" variant="outline">
            <Link href="/reply">
              <Reply className="h-4 w-4" strokeWidth={1.75} />
              Quick reply
            </Link>
          </Button>
          <Button asChild size="lg" variant="teal">
            <Link href="/compose">
              <PenSquare className="h-4 w-4" strokeWidth={1.75} />
              Compose an email
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-line bg-paper-raised px-5 py-5">
            <Icon className="h-[18px] w-[18px] text-ink-faint" strokeWidth={1.75} />
            <p className="mt-3 font-display text-[26px] font-medium text-ink">{value}</p>
            <p className="text-[13px] text-ink-faint">{label}</p>
          </div>
        ))}
      </section>

      {drafts.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-ink">Continue a draft</h2>
            <Link href="/history" className="text-[13px] font-medium text-teal hover:underline">
              View all
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-paper-raised px-5">
            {drafts.slice(0, DRAFTS_LIMIT).map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">Recent activity</h2>
          {emails.length > 0 ? (
            <Link href="/history" className="text-[13px] font-medium text-teal hover:underline">
              View all
            </Link>
          ) : null}
        </div>
        {emails.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing drafted yet"
            description="Emails you generate or save will show up here, most recent first."
            action={
              <Button asChild variant="outline">
                <Link href="/compose">Write your first email</Link>
              </Button>
            }
          />
        ) : (
          <div className="rounded-lg border border-line bg-paper-raised px-5">
            {emails.slice(0, RECENT_LIMIT).map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">Favorites</h2>
          {favorites.length > 0 ? (
            <Link
              href="/history"
              className="text-[13px] font-medium text-teal hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
        {favorites.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No favorites yet"
            description="Star an email you'll reuse often — a client update, an intro, a follow-up — to pin it here."
          />
        ) : (
          <div className="rounded-lg border border-line bg-paper-raised px-5">
            {favorites.slice(0, FAVORITES_LIMIT).map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">Templates</h2>
          <Link href="/templates" className="text-[13px] font-medium text-teal hover:underline">
            Browse all
          </Link>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="No templates yet"
            description="Save a reusable template to start Compose from a ready-made draft."
            action={
              <Button asChild variant="outline">
                <Link href="/templates">Create a template</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.slice(0, TEMPLATES_LIMIT).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => router.push(`/compose?template=${encodeURIComponent(template.id)}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

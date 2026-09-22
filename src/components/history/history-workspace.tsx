"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Inbox, SlidersHorizontal } from "lucide-react";
import { useEmails } from "@/hooks/use-emails";
import { useToast } from "@/hooks/use-toast";
import type { EmailType, SavedEmail } from "@/lib/types";
import { EmailListItem } from "@/components/history/email-list-item";
import { EmptyState } from "@/components/shared/empty-state";
import { AiLoadingState } from "@/components/shared/ai-loading-state";
import { AiErrorState } from "@/components/shared/ai-error-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type TypeFilter = "all" | EmailType;
type FavoriteFilter = "all" | "favorites" | "not-favorites";
type SortOrder = "newest" | "oldest";

interface Filters {
  type: TypeFilter;
  favorite: FavoriteFilter;
  sort: SortOrder;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  type: "all",
  favorite: "all",
  sort: "newest",
  dateFrom: "",
  dateTo: "",
};

function matchesQuery(email: SavedEmail, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    email.subject.toLowerCase().includes(q) ||
    email.recipient.toLowerCase().includes(q) ||
    email.body.toLowerCase().includes(q)
  );
}

function matchesFilters(email: SavedEmail, filters: Filters): boolean {
  if (filters.type !== "all" && email.type !== filters.type) return false;
  if (filters.favorite === "favorites" && !email.favorite) return false;
  if (filters.favorite === "not-favorites" && email.favorite) return false;

  const createdAt = new Date(email.createdAt).getTime();
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    if (!Number.isNaN(from) && createdAt < from) return false;
  }
  if (filters.dateTo) {
    // End-of-day for the "to" bound so the selected day is included.
    const to = new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (!Number.isNaN(to) && createdAt > to) return false;
  }

  return true;
}

function countActiveFilters(filters: Filters): number {
  let count = 0;
  if (filters.type !== "all") count += 1;
  if (filters.favorite !== "all") count += 1;
  if (filters.dateFrom || filters.dateTo) count += 1;
  return count;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "generated", label: "Generated" },
  { value: "reply", label: "Reply" },
  { value: "draft", label: "Draft" },
];

const FAVORITE_OPTIONS: { value: FavoriteFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "not-favorites", label: "Not favorites" },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function FilterFields({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="filter-type">Type</Label>
        <Select value={filters.type} onValueChange={(v) => onChange({ type: v as TypeFilter })}>
          <SelectTrigger id="filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-favorite">Favorite</Label>
        <Select
          value={filters.favorite}
          onValueChange={(v) => onChange({ favorite: v as FavoriteFilter })}
        >
          <SelectTrigger id="filter-favorite">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FAVORITE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-sort">Sort</Label>
        <Select value={filters.sort} onValueChange={(v) => onChange({ sort: v as SortOrder })}>
          <SelectTrigger id="filter-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="date-from">From</Label>
          <Input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-to">To</Label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function HistoryWorkspace() {
  const { emails, isLoaded, error, deleteEmail, toggleFavorite, refresh } = useEmails();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  function patchFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  const filtered = React.useMemo(() => {
    const result = emails
      .filter((email) => matchesQuery(email, query))
      .filter((email) => matchesFilters(email, filters));

    result.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return filters.sort === "newest" ? -diff : diff;
    });

    return result;
  }, [emails, query, filters]);

  const activeFilterCount = countActiveFilters(filters);

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

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
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

  if (!isLoaded) {
    return <AiLoadingState label="Loading your history…" />;
  }

  if (error) {
    return <AiErrorState message={error} onRetry={refresh} />;
  }

  const hasAnyEmails = emails.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <Input
            placeholder="Search by subject, recipient, or content"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!hasAnyEmails}
            aria-label="Search saved emails"
          />
        </div>

        {/* Mobile / narrow: filters collapse into a single dialog trigger. */}
        <div className="sm:hidden">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filters
            {activeFilterCount > 0 ? <Badge variant="teal">{activeFilterCount}</Badge> : null}
          </Button>
        </div>

        {/* Desktop / wide: filters shown inline. */}
        <div className="hidden items-center gap-2 sm:flex">
          <Select value={filters.type} onValueChange={(v) => patchFilters({ type: v as TypeFilter })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.favorite}
            onValueChange={(v) => patchFilters({ favorite: v as FavoriteFilter })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAVORITE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => patchFilters({ sort: v as SortOrder })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            Dates
            {filters.dateFrom || filters.dateTo ? <Badge variant="teal">1</Badge> : null}
          </Button>
          {activeFilterCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {!hasAnyEmails ? (
        <EmptyState
          icon={Inbox}
          title="No saved emails yet"
          description="Once you save a draft, reply, or generated email, it will show up here and stay searchable."
          action={
            <Button asChild variant="outline">
              <Link href="/compose">Write your first email</Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          description="Try a different search term, or adjust your filters."
          action={
            activeFilterCount > 0 || query ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setFilters(DEFAULT_FILTERS);
                }}
              >
                Clear search and filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-paper-raised px-5">
          {filtered.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              onToggleFavorite={handleToggleFavorite}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter history</DialogTitle>
            <DialogDescription>Narrow down your saved emails, replies, and drafts.</DialogDescription>
          </DialogHeader>
          <FilterFields filters={filters} onChange={patchFilters} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="teal">
                Done
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this email?</DialogTitle>
            <DialogDescription>
              This removes it from your saved history. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

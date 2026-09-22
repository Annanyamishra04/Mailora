"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileStack, Plus } from "lucide-react";
import { useTemplates } from "@/hooks/use-templates";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATE_CATEGORIES, type EmailTemplate, type NewEmailTemplate, type TemplateCategory } from "@/lib/types";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

type CategoryFilter = "all" | TemplateCategory;

function matchesQuery(template: EmailTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    template.name.toLowerCase().includes(q) ||
    (template.description ?? "").toLowerCase().includes(q) ||
    template.subject.toLowerCase().includes(q) ||
    template.body.toLowerCase().includes(q)
  );
}

export function TemplatesWorkspace() {
  const router = useRouter();
  const { templates, customTemplates, isLoaded, error, saveTemplate, updateTemplate, deleteTemplate, refresh } =
    useTemplates();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryFilter>("all");
  const [previewing, setPreviewing] = React.useState<EmailTemplate | null>(null);
  const [editing, setEditing] = React.useState<EmailTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const filtered = templates.filter(
    (t) => matchesQuery(t, query) && (category === "all" || t.category === category),
  );

  function handleUse(template: EmailTemplate) {
    router.push(`/compose?template=${encodeURIComponent(template.id)}`);
  }

  function openCreate() {
    setEditing(null);
    setIsFormOpen(true);
  }

  function openEdit(template: EmailTemplate) {
    setEditing(template);
    setIsFormOpen(true);
  }

  async function handleSubmit(values: NewEmailTemplate) {
    setIsSubmitting(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, values);
        toast({ title: "Template updated", variant: "success" });
      } else {
        await saveTemplate(values);
        toast({ title: "Template created", variant: "success" });
      }
      setIsFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast({
        title: "Couldn't save template",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await deleteTemplate(id);
      toast({ title: "Template deleted", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't delete template",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  if (error) {
    return (
      <EmptyState
        icon={FileStack}
        title="Couldn't load your templates"
        description={error}
        action={
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              strokeWidth={1.75}
            />
            <Input
              placeholder="Search templates"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search templates"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="teal" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={templates.length === 0 ? "No templates yet" : "Nothing matches"}
          description={
            templates.length === 0
              ? "Create your first custom template, or check back after starter templates load."
              : "Try a different search term or category."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const isCustom = !template.isBuiltin;
            return (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={() => setPreviewing(template)}
                onUse={() => handleUse(template)}
                onEdit={isCustom ? () => openEdit(template) : undefined}
                onDelete={isCustom ? () => setPendingDeleteId(template.id) : undefined}
              />
            );
          })}
        </div>
      )}

      {!isLoaded && customTemplates.length === 0 ? (
        <p className="text-center text-[12.5px] text-ink-faint">Loading your custom templates…</p>
      ) : null}

      {/* Preview dialog */}
      <Dialog open={previewing !== null} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewing?.name}</DialogTitle>
            <DialogDescription>{previewing?.description || "Template preview"}</DialogDescription>
          </DialogHeader>
          {previewing ? (
            <div className="space-y-3">
              <div>
                <p className="text-[12px] font-medium text-ink-faint">Subject</p>
                <p className="mt-0.5 text-[13.5px] text-ink">{previewing.subject || "—"}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-faint">Body</p>
                <pre className="mt-0.5 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink-soft">
                  {previewing.body || "—"}
                </pre>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="teal"
              onClick={() => previewing && handleUse(previewing)}
            >
              Use this template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditing(null);
        }}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                subject: editing.subject,
                body: editing.body,
                category: editing.category,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
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

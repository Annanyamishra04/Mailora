"use client";

import { Eye, PenSquare, Sparkles, Trash2 } from "lucide-react";
import type { EmailTemplate } from "@/lib/types";
import { TEMPLATE_CATEGORIES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TemplateCard({
  template,
  onPreview,
  onUse,
  onEdit,
  onDelete,
}: {
  template: EmailTemplate;
  onPreview?: () => void;
  onUse: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const categoryLabel =
    TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label ?? template.category;

  return (
    <div className="flex flex-col rounded-lg border border-line bg-paper-raised p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-medium text-ink">{template.name}</h3>
        <Badge variant={template.isBuiltin ? "neutral" : "gold"} className="shrink-0">
          {template.isBuiltin ? categoryLabel : "Custom"}
        </Badge>
      </div>
      {template.description ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-faint">
          {template.description}
        </p>
      ) : (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-faint">
          {categoryLabel}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {onPreview ? (
          <Button type="button" variant="ghost" size="sm" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            Preview
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onUse}>
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
          Use
        </Button>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="ml-auto"
            aria-label={`Edit template: ${template.name}`}
            title="Edit template"
          >
            <PenSquare className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete template: ${template.name}`}
            title="Delete template"
            className={onEdit ? "text-danger hover:bg-danger-tint hover:text-danger" : "ml-auto text-danger hover:bg-danger-tint hover:text-danger"}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

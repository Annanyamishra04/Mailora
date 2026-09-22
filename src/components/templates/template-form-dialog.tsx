"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { TEMPLATE_CATEGORIES, type NewEmailTemplate, type TemplateCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUES: NewEmailTemplate = {
  name: "",
  description: "",
  subject: "",
  body: "",
  category: "other",
};

export function TemplateFormDialog({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing custom template; absent when creating. */
  initialValues?: NewEmailTemplate;
  onSubmit: (values: NewEmailTemplate) => void;
  isSubmitting: boolean;
}) {
  const [values, setValues] = React.useState<NewEmailTemplate>(initialValues ?? EMPTY_VALUES);
  const isEditing = Boolean(initialValues);

  // Reset the form each time the dialog opens (not on every change to
  // `initialValues`' identity). Adjusting state during render, keyed on the
  // `open` transition, is React's recommended alternative to an effect here.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues(initialValues ?? EMPTY_VALUES);
  }

  function patch(next: Partial<NewEmailTemplate>) {
    setValues((current) => ({ ...current, ...next }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    onSubmit({ ...values, name: values.name.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this template. Changes only apply to you."
              : "Save a reusable starting point for Compose."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={values.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Client check-in"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-category">Category</Label>
              <Select
                value={values.category}
                onValueChange={(v) => patch({ category: v as TemplateCategory })}
              >
                <SelectTrigger id="template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">
              Description <span className="text-ink-faint">(optional)</span>
            </Label>
            <Input
              id="template-description"
              value={values.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What this template is for"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={values.subject}
              onChange={(e) => patch({ subject: e.target.value })}
              placeholder="Subject line"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-body">Body</Label>
            <Textarea
              id="template-body"
              rows={8}
              value={values.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Write the template body. Use {{placeholders}} for details to fill in later."
              className="leading-relaxed"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="teal" disabled={isSubmitting || !values.name.trim()}>
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : null}
              {isEditing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

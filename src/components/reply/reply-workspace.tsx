"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateReply, generateSubject, rewriteEmail } from "@/lib/ai-client";
import type { RewriteAction } from "@/lib/ai/types";
import type { EmailLength, EmailTone, EmailType, NewSavedEmail } from "@/lib/types";
import { DraftSync, type DraftPersistence } from "@/lib/drafts/draft-sync";
import { isApiRequestError } from "@/lib/api-client";
import { validateReplyForm } from "@/lib/validation/reply";
import { isEmailContentEmpty } from "@/lib/validation/email";
import { useEmails } from "@/hooks/use-emails";
import { usePreferences } from "@/hooks/use-preferences";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/hooks/use-toast";
import { GenerationControls } from "@/components/reply/generation-controls";
import { ReplyResultPanel } from "@/components/reply/reply-result-panel";
import type { AutosaveStatus } from "@/components/shared/autosave-indicator";

const ORIGINAL_EMAIL_PREVIEW_LENGTH = 160;

interface ReplySnapshot {
  subject: string;
  body: string;
  tone: EmailTone;
  length: EmailLength;
  instructions: string;
  /** "Reply to: <preview of the original email>" — what History shows as the purpose. */
  purpose: string;
}

type StoreFns = {
  saveEmail: (input: NewSavedEmail) => Promise<{ id: string }>;
  updateEmail: (id: string, patch: Partial<NewSavedEmail>) => Promise<unknown>;
  deleteEmail: (id: string) => Promise<void>;
};

function replyFields(s: ReplySnapshot) {
  return {
    subject: s.subject,
    body: s.body,
    tone: s.tone,
    length: s.length,
    purpose: s.purpose,
    additionalInstructions: s.instructions,
  };
}

function isNotFound(error: unknown): boolean {
  return isApiRequestError(error) && error.status === 404;
}

/** Adapts the `useEmails` store functions to what DraftSync needs. */
function replyPersistence(store: StoreFns): DraftPersistence<ReplySnapshot> {
  return {
    async create(snapshot, type, favorite) {
      const saved = await store.saveEmail({ recipient: "", ...replyFields(snapshot), favorite, type });
      return { id: saved.id };
    },
    async update(id, patch) {
      const update: Partial<NewSavedEmail> = {};
      if (patch.snapshot) Object.assign(update, replyFields(patch.snapshot));
      if (patch.type) update.type = patch.type;
      if (patch.favorite !== undefined) update.favorite = patch.favorite;
      try {
        return Boolean(await store.updateEmail(id, update));
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },
    async remove(id) {
      try {
        await store.deleteEmail(id);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}

function replyPurpose(originalEmail: string): string {
  const preview = originalEmail.trim().replace(/\s+/g, " ").slice(0, ORIGINAL_EMAIL_PREVIEW_LENGTH);
  return preview ? `Reply to: ${preview}` : "Reply";
}

export function ReplyWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const { emails, isLoaded: emailsLoaded, saveEmail, updateEmail, deleteEmail } = useEmails();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();
  const { copy, isCopying } = useClipboard();
  const { toast } = useToast();

  const [originalEmail, setOriginalEmail] = React.useState("");
  const [tone, setTone] = React.useState<EmailTone>("professional");
  const [length, setLength] = React.useState<EmailLength>("medium");
  const [instructions, setInstructions] = React.useState("");

  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [savedType, setSavedType] = React.useState<EmailType | null>(null);

  const [errors, setErrors] = React.useState<ReturnType<typeof validateReplyForm>["errors"]>({});
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [activeRewrite, setActiveRewrite] = React.useState<RewriteAction | null>(null);
  const [isGeneratingSubject, setIsGeneratingSubject] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");

  // All writes for the reply on screen are serialized through one controller,
  // so "Save" and "Save draft" can't race each other into duplicate records
  // (see `lib/drafts/draft-sync.ts`).
  const [sync] = React.useState(
    () =>
      new DraftSync<ReplySnapshot>({
        equals: (a, b) =>
          a.subject === b.subject &&
          a.body === b.body &&
          a.tone === b.tone &&
          a.length === b.length &&
          a.instructions === b.instructions &&
          a.purpose === b.purpose,
        isEmpty: (s) => !s.subject.trim() && !s.body.trim(),
        onChange: (view) => {
          setSavedId(view.id);
          setSavedType(view.type);
        },
        onStatus: setAutosaveStatus,
      }),
  );

  React.useEffect(() => {
    sync.setPersistence(replyPersistence({ saveEmail, updateEmail, deleteEmail }));
  }, [sync, saveEmail, updateEmail, deleteEmail]);

  // Reopening a saved reply from History/Dashboard via /reply?id=... Only the
  // generated subject/body, tone, and length are restored — the original
  // email text itself isn't stored in full (see README, "known limitations").
  const loadedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!emailsLoaded) return;
    if (!editId) {
      loadedIdRef.current = null;
      return;
    }
    if (loadedIdRef.current === editId) return;
    const existing = emails.find((e) => e.id === editId && (e.type === "reply" || e.type === "draft"));
    if (existing) {
      /* eslint-disable react-hooks/set-state-in-effect -- loading a saved reply into editable form state when navigating here via ?id= */
      setTone(existing.tone);
      setLength(existing.length);
      setSubject(existing.subject);
      setBody(existing.body);
      setInstructions(existing.additionalInstructions ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
      sync.load({
        id: existing.id,
        type: existing.type,
        snapshot: {
          subject: existing.subject,
          body: existing.body,
          tone: existing.tone,
          length: existing.length,
          instructions: existing.additionalInstructions ?? "",
          purpose: existing.purpose ?? "",
        },
      });
      loadedIdRef.current = editId;
    }
  }, [editId, emailsLoaded, emails, sync]);

  // Seed tone/length from writing preferences once, on first load.
  const preferencesAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (!prefsLoaded || preferencesAppliedRef.current) return;
    if (!editId) {
      /* eslint-disable react-hooks/set-state-in-effect -- seeding form defaults from stored preferences once, on first mount */
      setTone(preferences.defaultTone);
      setLength(preferences.defaultLength);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    preferencesAppliedRef.current = true;
  }, [prefsLoaded, preferences, editId]);

  const hasResult = Boolean(subject.trim() || body.trim());

  function handleGenerate() {
    if (isGenerating) return;
    const { valid, errors: nextErrors } = validateReplyForm({ originalEmail });
    setErrors(nextErrors);
    if (!valid) {
      toast({
        title: "Add the original email first",
        description: "Paste or type the message you're replying to.",
        variant: "error",
      });
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    generateReply({
      originalEmail,
      tone,
      length,
      instructions: instructions || undefined,
    })
      .then((result) => {
        setSubject(result.subject);
        setBody(result.body);
        toast({ title: hasResult ? "Reply regenerated" : "Reply generated", variant: "success" });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Please try again.";
        setGenerateError(message);
        toast({ title: "Couldn't generate a reply", description: message, variant: "error" });
      })
      .finally(() => setIsGenerating(false));
  }

  function handleRewrite(action: RewriteAction) {
    if (isEmailContentEmpty(body)) {
      toast({ title: "Nothing to rewrite yet", description: "Generate a reply first.", variant: "error" });
      return;
    }
    if (activeRewrite) return;

    setActiveRewrite(action);
    rewriteEmail({ body, action })
      .then((result) => {
        setBody(result.body);
        toast({ title: "Rewrite applied", description: "Edit freely before sending.", variant: "success" });
      })
      .catch((error: unknown) => {
        toast({
          title: "Rewrite failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      })
      .finally(() => setActiveRewrite(null));
  }

  function handleGenerateSubject() {
    if (isEmailContentEmpty(body)) {
      toast({
        title: "Add some context first",
        description: "Generate a reply so a subject can be generated from it.",
        variant: "error",
      });
      return;
    }
    if (isGeneratingSubject) return;

    const preview = originalEmail.trim().replace(/\s+/g, " ").slice(0, ORIGINAL_EMAIL_PREVIEW_LENGTH);
    setIsGeneratingSubject(true);
    generateSubject({ body, purpose: preview ? `Reply regarding: ${preview}` : undefined })
      .then((result) => {
        setSubject(result.subject);
        toast({ title: "Subject updated", variant: "success" });
      })
      .catch((error: unknown) => {
        toast({
          title: "Couldn't generate a subject",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      })
      .finally(() => setIsGeneratingSubject(false));
  }

  async function handleCopy() {
    if (!hasResult) {
      toast({ title: "Nothing to copy yet", variant: "error" });
      return;
    }
    const ok = await copy(`Subject: ${subject}\n\n${body}`);
    if (ok) {
      toast({ title: "Copied to clipboard", variant: "success" });
    } else {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access — copy the text manually.",
        variant: "error",
      });
    }
  }

  function handleClear() {
    setOriginalEmail("");
    setInstructions("");
    setSubject("");
    setBody("");
    sync.reset();
    setErrors({});
    setGenerateError(null);
    setTone(preferences.defaultTone);
    setLength(preferences.defaultLength);
    loadedIdRef.current = null;
    router.replace("/reply");
  }

  function currentSnapshot(): ReplySnapshot {
    return { subject, body, tone, length, instructions, purpose: replyPurpose(originalEmail) };
  }

  async function handleSave() {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Generate a reply first", variant: "error" });
      return;
    }
    if (isSaving) return;

    const wasDraft = savedType === "draft";
    setIsSaving(true);
    try {
      const { created } = await sync.finalize(currentSnapshot(), "reply");
      toast({
        title: created ? "Saved to history" : wasDraft ? "Reply saved to history" : "Reply updated",
        variant: "success",
      });
      setAutosaveStatus("idle");
    } catch (error) {
      toast({
        title: "Couldn't save",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!subject.trim() && !body.trim()) {
      toast({ title: "Nothing to save yet", variant: "error" });
      return;
    }
    if (isSavingDraft) return;

    setIsSavingDraft(true);
    try {
      const { created } = await sync.saveDraft(currentSnapshot());
      toast({ title: created ? "Draft saved" : "Draft updated", variant: "success" });
    } catch (error) {
      toast({
        title: "Couldn't save draft",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!savedId) return;
    if (isDeletingDraft) return;

    setIsDeletingDraft(true);
    try {
      await sync.discard();
      toast({ title: "Draft deleted", variant: "success" });
      handleClear();
    } catch (error) {
      toast({
        title: "Couldn't delete draft",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsDeletingDraft(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <GenerationControls
        originalEmail={originalEmail}
        onOriginalEmailChange={setOriginalEmail}
        tone={tone}
        onToneChange={setTone}
        length={length}
        onLengthChange={setLength}
        instructions={instructions}
        onInstructionsChange={setInstructions}
        errors={errors}
        isGenerating={isGenerating}
        hasResult={hasResult}
        onGenerate={handleGenerate}
      />

      <ReplyResultPanel
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        isGenerating={isGenerating}
        error={generateError}
        onRetry={handleGenerate}
        onRewrite={handleRewrite}
        activeRewrite={activeRewrite}
        onGenerateSubject={handleGenerateSubject}
        isGeneratingSubject={isGeneratingSubject}
        onCopy={handleCopy}
        isCopying={isCopying}
        onClear={handleClear}
        onSave={handleSave}
        isSaving={isSaving}
        recordType={savedType}
        onSaveDraft={handleSaveDraft}
        isSavingDraft={isSavingDraft}
        onDeleteDraft={savedId && savedType === "draft" ? handleDeleteDraft : undefined}
        isDeletingDraft={isDeletingDraft}
        autosaveStatus={autosaveStatus}
      />
    </div>
  );
}

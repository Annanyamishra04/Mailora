"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { generateEmail, generateSubject, rewriteEmail } from "@/lib/ai-client";
import type { RewriteAction } from "@/lib/ai/types";
import type { EmailLength, EmailTone, EmailType, NewSavedEmail } from "@/lib/types";
import { DraftSync, type DraftPersistence } from "@/lib/drafts/draft-sync";
import { isApiRequestError } from "@/lib/api-client";
import { validateComposeForm, isEmailContentEmpty } from "@/lib/validation/email";
import { useEmails } from "@/hooks/use-emails";
import { useTemplates } from "@/hooks/use-templates";
import { usePreferences } from "@/hooks/use-preferences";
import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/hooks/use-toast";
import { PromptPanel } from "@/components/compose/prompt-panel";
import { EmailEditor } from "@/components/compose/email-editor";
import { Button } from "@/components/ui/button";
import type { AutosaveStatus } from "@/components/shared/autosave-indicator";

/** How long to wait, idle, before autosaving a draft. */
const AUTOSAVE_DEBOUNCE_MS = 2500;

/** After a failed autosave, how long before trying again on its own. */
const AUTOSAVE_RETRY_MS = 10_000;

/** Errors where retrying the same content is pointless until something changes. */
const FATAL_AUTOSAVE_STATUSES = new Set([400, 401, 403, 413]);

interface ComposeSnapshot {
  recipient: string;
  purpose: string;
  tone: EmailTone;
  length: EmailLength;
  additionalInstructions: string;
  subject: string;
  body: string;
}

function snapshotEqual(a: ComposeSnapshot, b: ComposeSnapshot): boolean {
  return (
    a.recipient === b.recipient &&
    a.purpose === b.purpose &&
    a.tone === b.tone &&
    a.length === b.length &&
    a.additionalInstructions === b.additionalInstructions &&
    a.subject === b.subject &&
    a.body === b.body
  );
}

function isSnapshotEmpty(s: ComposeSnapshot): boolean {
  return !(s.recipient.trim() || s.purpose.trim() || s.subject.trim() || s.body.trim());
}

type StoreFns = {
  saveEmail: (input: NewSavedEmail) => Promise<{ id: string }>;
  updateEmail: (id: string, patch: Partial<NewSavedEmail>) => Promise<unknown>;
  deleteEmail: (id: string) => Promise<void>;
};

function snapshotFields(s: ComposeSnapshot) {
  return {
    recipient: s.recipient,
    subject: s.subject,
    body: s.body,
    tone: s.tone,
    length: s.length,
    purpose: s.purpose,
    additionalInstructions: s.additionalInstructions,
  };
}

function isNotFound(error: unknown): boolean {
  return isApiRequestError(error) && error.status === 404;
}

/** Adapts the `useEmails` store functions to what DraftSync needs. */
function composePersistence(store: StoreFns): DraftPersistence<ComposeSnapshot> {
  return {
    async create(snapshot, type, favorite) {
      const saved = await store.saveEmail({ ...snapshotFields(snapshot), favorite, type });
      return { id: saved.id };
    },
    async update(id, patch) {
      const update: Partial<NewSavedEmail> = {};
      if (patch.snapshot) Object.assign(update, snapshotFields(patch.snapshot));
      if (patch.type) update.type = patch.type;
      if (patch.favorite !== undefined) update.favorite = patch.favorite;
      try {
        // The local store resolves `undefined` for a missing record; the
        // API store throws a 404. Both mean "it's gone".
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
        if (!isNotFound(error)) throw error; // already deleted elsewhere: goal achieved
      }
    },
  };
}

export function ComposeWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const templateId = searchParams.get("template");

  const { emails, isLoaded: emailsLoaded, saveEmail, updateEmail, deleteEmail } = useEmails();
  const { templates, isLoaded: templatesLoaded } = useTemplates();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();
  const { copy, isCopying } = useClipboard();
  const { toast } = useToast();

  const [recipient, setRecipient] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [tone, setTone] = React.useState<EmailTone>("professional");
  const [length, setLength] = React.useState<EmailLength>("medium");
  const [additionalInstructions, setAdditionalInstructions] = React.useState("");

  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");

  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [favorite, setFavorite] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [savedType, setSavedType] = React.useState<EmailType | null>(null);

  const [errors, setErrors] = React.useState<ReturnType<typeof validateComposeForm>["errors"]>({});
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isGeneratingSubject, setIsGeneratingSubject] = React.useState(false);
  const [activeRewrite, setActiveRewrite] = React.useState<RewriteAction | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");

  const [savedSnapshot, setSavedSnapshot] = React.useState<ComposeSnapshot | null>(null);

  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSnapshotRef = React.useRef<ComposeSnapshot | null>(null);
  const failedSnapshotRef = React.useRef<ComposeSnapshot | null>(null);
  const failureIsFatalRef = React.useRef(false);
  const favoriteBusyRef = React.useRef(false);

  /**
   * All writes for the draft on screen go through this one controller (see
   * `lib/drafts/draft-sync.ts` for the race conditions it exists to prevent).
   */
  const [sync] = React.useState(
    () =>
      new DraftSync<ComposeSnapshot>({
        equals: snapshotEqual,
        isEmpty: isSnapshotEmpty,
        onChange: (view) => {
          setSavedId(view.id);
          setSavedType(view.type);
          setSavedSnapshot(view.savedSnapshot);
        },
        onStatus: (status) => {
          if (status === "saved") failureIsFatalRef.current = false;
          setAutosaveStatus(status);
        },
        onError: (error) => {
          failedSnapshotRef.current = latestSnapshotRef.current;
          failureIsFatalRef.current = isApiRequestError(error) && FATAL_AUTOSAVE_STATUSES.has(error.status);
        },
      }),
  );

  function currentSnapshot(): ComposeSnapshot {
    return { recipient, purpose, tone, length, additionalInstructions, subject, body };
  }

  // The store functions change identity when auth state changes, and
  // DraftSync outlives those renders — so hand it the current ones.
  React.useEffect(() => {
    sync.setPersistence(composePersistence({ saveEmail, updateEmail, deleteEmail }));
  }, [sync, saveEmail, updateEmail, deleteEmail]);

  // Lets timers and the unmount flush read what's on screen NOW, not what
  // was on screen when they were scheduled.
  React.useEffect(() => {
    latestSnapshotRef.current = { recipient, purpose, tone, length, additionalInstructions, subject, body };
  });

  // Load a saved draft when arriving via /compose?id=... (from History or Dashboard).
  const loadedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!emailsLoaded) return;
    if (!editId) {
      loadedIdRef.current = null;
      return;
    }
    if (loadedIdRef.current === editId) return;
    const existing = emails.find((e) => e.id === editId);
    if (existing) {
      /* eslint-disable react-hooks/set-state-in-effect -- loading a saved draft from local storage into editable form state when navigating here via ?id= */
      setRecipient(existing.recipient);
      setPurpose(existing.purpose ?? "");
      setAdditionalInstructions(existing.additionalInstructions ?? "");
      setTone(existing.tone);
      setLength(existing.length);
      setSubject(existing.subject);
      setBody(existing.body);
      setFavorite(existing.favorite);
      /* eslint-enable react-hooks/set-state-in-effect */
      sync.load({
        id: existing.id,
        type: existing.type,
        snapshot: {
          recipient: existing.recipient,
          purpose: existing.purpose ?? "",
          tone: existing.tone,
          length: existing.length,
          additionalInstructions: existing.additionalInstructions ?? "",
          subject: existing.subject,
          body: existing.body,
        },
      });
      loadedIdRef.current = editId;
    }
  }, [editId, emailsLoaded, emails, sync]);

  // Load a template when arriving via /compose?template=... (from Templates).
  const loadedTemplateRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!templatesLoaded) return;
    if (!templateId || editId) {
      loadedTemplateRef.current = null;
      return;
    }
    if (loadedTemplateRef.current === templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      /* eslint-disable react-hooks/set-state-in-effect -- populating Compose from a chosen template on arrival via ?template= */
      setSubject(template.subject);
      setBody(template.body);
      setFavorite(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      sync.reset();
      loadedTemplateRef.current = templateId;
      toast({ title: `Using "${template.name}"`, description: "Fill in the placeholders before sending.", variant: "info" });
      router.replace("/compose");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast/router are stable-enough helpers, not reactive state this effect should re-run for
  }, [templateId, editId, templatesLoaded, templates, sync]);

  // Seed tone/length from writing preferences once, for a fresh (non-edit) draft.
  const preferencesAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (!prefsLoaded || preferencesAppliedRef.current) return;
    if (!editId) {
      /* eslint-disable react-hooks/set-state-in-effect -- seeding form defaults from stored preferences once, on first mount of a fresh draft */
      setTone(preferences.defaultTone);
      setLength(preferences.defaultLength);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    preferencesAppliedRef.current = true;
  }, [prefsLoaded, preferences, editId]);

  // Autosave: only for drafts-in-progress (never overwrites a record the
  // user finalized), debounced so typing is never interrupted, and only when
  // something actually changed. The timer only *requests* a save; DraftSync
  // decides what to write when its turn comes (always the newest content),
  // so an edit made while a save is in flight is never dropped.
  React.useEffect(() => {
    if (isGenerating || isSaving || isSavingDraft || isDeletingDraft || activeRewrite) return;
    if (!sync.isAutosavable) return;

    const snapshot = { recipient, purpose, tone, length, additionalInstructions, subject, body };
    if (isSnapshotEmpty(snapshot)) return;
    if (savedSnapshot && snapshotEqual(snapshot, savedSnapshot)) return;

    // After a failure, retry on its own (transient network errors shouldn't
    // need the user to type again) — unless the same content already failed
    // in a way retrying can't fix, e.g. a signed-out session.
    const hasFailed = autosaveStatus === "error";
    if (
      hasFailed &&
      failureIsFatalRef.current &&
      failedSnapshotRef.current &&
      snapshotEqual(snapshot, failedSnapshotRef.current)
    ) {
      return;
    }

    autosaveTimerRef.current = setTimeout(
      () => {
        void sync.autosave(() => latestSnapshotRef.current ?? snapshot);
      },
      hasFailed ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS,
    );

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    recipient,
    purpose,
    tone,
    length,
    additionalInstructions,
    subject,
    body,
    savedSnapshot,
    autosaveStatus,
    isGenerating,
    isSaving,
    isSavingDraft,
    isDeletingDraft,
    activeRewrite,
    sync,
  ]);

  // Leaving the page (in-app navigation) inside the debounce window must
  // not lose the last few seconds of typing: flush once on unmount. It is a
  // no-op when nothing changed, the draft is blank, or it was finalized.
  React.useEffect(() => {
    return () => {
      const latest = latestSnapshotRef.current;
      if (latest && sync.isAutosavable) void sync.autosave(() => latest);
    };
  }, [sync]);

  // A hard reload / tab close can't wait for a network round trip, so while
  // there are unsaved autosavable changes, ask the browser to confirm.
  const hasUnsavedChanges =
    sync.isAutosavable &&
    !isSnapshotEmpty({ recipient, purpose, tone, length, additionalInstructions, subject, body }) &&
    !(
      savedSnapshot &&
      snapshotEqual({ recipient, purpose, tone, length, additionalInstructions, subject, body }, savedSnapshot)
    );
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  function handleGenerate() {
    if (isGenerating) return;
    const { valid, errors: nextErrors } = validateComposeForm({ recipient, purpose });
    setErrors(nextErrors);
    if (!valid) {
      toast({
        title: "Add a few more details",
        description: "Fill in who it's for and what it needs to say.",
        variant: "error",
      });
      return;
    }

    setIsGenerating(true);
    generateEmail({
      recipient,
      purpose,
      tone,
      length,
      additionalInstructions,
      signatureName: preferences.autoSignOff ? preferences.signatureName : "",
    })
      .then((result) => {
        setSubject(result.subject);
        setBody(result.body);
        setFavorite(false);
        toast({ title: "Draft generated", variant: "success" });
      })
      .catch((error: unknown) => {
        toast({
          title: "Couldn't generate a draft",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      })
      .finally(() => setIsGenerating(false));
  }

  function handleRewrite(action: RewriteAction) {
    if (isEmailContentEmpty(body)) {
      toast({
        title: "Nothing to rewrite yet",
        description: "Generate or write a draft first.",
        variant: "error",
      });
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
    if (isEmailContentEmpty(body) && !purpose.trim()) {
      toast({
        title: "Add some context first",
        description: "Write a draft or describe the purpose so a subject can be generated.",
        variant: "error",
      });
      return;
    }
    if (isGeneratingSubject) return;

    setIsGeneratingSubject(true);
    generateSubject({ body, purpose })
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
    if (isEmailContentEmpty(body) && !subject.trim()) {
      toast({ title: "Nothing to copy yet", variant: "error" });
      return;
    }
    const parts = [];
    if (cc.trim()) parts.push(`Cc: ${cc.trim()}`);
    if (bcc.trim()) parts.push(`Bcc: ${bcc.trim()}`);
    parts.push(`Subject: ${subject}`, "", body);

    const ok = await copy(parts.join("\n"));
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

  async function handleSave() {
    if (isEmailContentEmpty(body) || !subject.trim()) {
      toast({ title: "Add a subject and body first", variant: "error" });
      return;
    }
    if (isSaving) return;

    const wasDraft = savedType === "draft";
    setIsSaving(true);
    try {
      const { created } = await sync.finalize(currentSnapshot(), "generated", favorite);
      toast({
        title: created ? "Saved to history" : wasDraft ? "Draft saved to history" : "Draft updated",
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
    const snapshot = currentSnapshot();
    if (isSnapshotEmpty(snapshot)) {
      toast({ title: "Nothing to save yet", variant: "error" });
      return;
    }
    if (isSavingDraft) return;

    setIsSavingDraft(true);
    try {
      const { created } = await sync.saveDraft(snapshot, favorite);
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
      // Serialized behind any save still in flight, and permanently stops
      // autosave from touching this record (so it can't be resurrected).
      await sync.discard();
      toast({ title: "Draft deleted", variant: "success" });
      handleNewDraft();
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

  async function handleToggleFavorite() {
    const hadRecord = Boolean(savedId);
    if (!hadRecord && (isEmailContentEmpty(body) || !subject.trim())) {
      toast({ title: "Add a subject and body first", variant: "error" });
      return;
    }
    if (favoriteBusyRef.current) return;

    favoriteBusyRef.current = true;
    const next = !favorite;
    try {
      await sync.setFavorite(next, currentSnapshot(), "generated");
      setFavorite(next);
      toast({
        title: !hadRecord ? "Saved and favorited" : next ? "Added to favorites" : "Removed from favorites",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: hadRecord ? "Couldn't update favorite" : "Couldn't save",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      favoriteBusyRef.current = false;
    }
  }

  function handleNewDraft() {
    // If the current draft has typing that autosave hasn't caught up with,
    // it is written to that draft first (see DraftSync.reset) — starting a
    // new one must not silently discard the last few seconds of work.
    sync.reset(sync.isAutosavable ? currentSnapshot() : undefined);
    setRecipient("");
    setPurpose("");
    setAdditionalInstructions("");
    setCc("");
    setBcc("");
    setShowCcBcc(false);
    setSubject("");
    setBody("");
    setFavorite(false);
    setErrors({});
    setTone(preferences.defaultTone);
    setLength(preferences.defaultLength);
    loadedIdRef.current = null;
    loadedTemplateRef.current = null;
    router.replace("/compose");
  }

  // "Saved" is only true while what's on screen matches what was saved;
  // once the user types again the indicator clears until the next save.
  const displayedAutosaveStatus: AutosaveStatus =
    autosaveStatus === "saved" && savedSnapshot && !snapshotEqual(currentSnapshot(), savedSnapshot)
      ? "idle"
      : autosaveStatus;

  return (
    <div className="space-y-5">
      {(savedId || subject || body || recipient || purpose) && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleNewDraft} className="shrink-0">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            New draft
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <PromptPanel
          recipient={recipient}
          onRecipientChange={setRecipient}
          purpose={purpose}
          onPurposeChange={setPurpose}
          tone={tone}
          onToneChange={setTone}
          length={length}
          onLengthChange={setLength}
          additionalInstructions={additionalInstructions}
          onAdditionalInstructionsChange={setAdditionalInstructions}
          errors={errors}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />

        <EmailEditor
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          cc={cc}
          onCcChange={setCc}
          bcc={bcc}
          onBccChange={setBcc}
          showCcBcc={showCcBcc}
          onToggleCcBcc={() => setShowCcBcc((v) => !v)}
          onRewrite={handleRewrite}
          activeRewrite={activeRewrite}
          onGenerateSubject={handleGenerateSubject}
          isGeneratingSubject={isGeneratingSubject}
          onCopy={handleCopy}
          isCopying={isCopying}
          onSave={handleSave}
          isSaving={isSaving}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={favorite}
          recordType={savedType}
          onSaveDraft={handleSaveDraft}
          isSavingDraft={isSavingDraft}
          onDeleteDraft={savedId && savedType === "draft" ? handleDeleteDraft : undefined}
          isDeletingDraft={isDeletingDraft}
          autosaveStatus={displayedAutosaveStatus}
        />
      </div>
    </div>
  );
}

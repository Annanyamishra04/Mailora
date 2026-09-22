/**
 * DraftSync — the single writer for one email record while it's being
 * edited (autosave, "Save draft", "Save to history", favorite, delete).
 *
 * WHY THIS EXISTS. Phase 5 kept the "which record am I editing" state in
 * React state and guarded autosave with an in-flight flag. That has holes
 * that lose or corrupt data:
 *
 *  1. Edit while a save is in flight → the debounce timer fires, sees
 *     "in flight", returns without rescheduling → the newest text is never
 *     saved until the user types again.
 *  2. First save (create) in flight + user clicks "Save draft" → both see
 *     "no id yet" → two records.
 *  3. Autosave (PATCH type=draft) in flight + user clicks "Save" (PATCH
 *     type=generated) → the requests can land in either order and the
 *     record is silently demoted back to a draft.
 *  4. "New draft" during an in-flight create → completion handler writes
 *     the OLD record's id into the NEW blank form, so typing overwrites it.
 *
 * THE MODEL. Every write goes through ONE promise chain, so there is never
 * more than one request in flight and they land in the order issued.
 * Operations read the record's id/type from a per-draft `Session` object
 * at the moment they RUN (not when they were scheduled), so a create that
 * just finished is visible to the next operation. Autosave reads the
 * *latest* editor content when it runs and skips if it's already saved, so
 * however many autosaves are queued, the final state always gets written.
 * Starting a new draft (or loading another) swaps in a fresh Session;
 * operations still queued for the old one keep writing to the old record
 * and never touch the new form.
 *
 * Pure TypeScript with no React or network code: persistence is injected,
 * so the race scenarios above are unit-tested in `tests/draft-sync.test.ts`.
 */

export type DraftType = "generated" | "reply" | "draft";

export interface DraftPersistence<S> {
  /** Creates a record; resolves with its new id. */
  create(snapshot: S, type: DraftType, favorite: boolean): Promise<{ id: string }>;
  /** Updates a record. Resolves `false` if it no longer exists (deleted elsewhere). */
  update(
    id: string,
    patch: { snapshot?: S; type?: DraftType; favorite?: boolean },
  ): Promise<boolean>;
  /** Deletes a record. */
  remove(id: string): Promise<void>;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DraftView<S> {
  id: string | null;
  type: DraftType | null;
  /** The content last confirmed written to the server (for "unsaved changes" checks). */
  savedSnapshot: S | null;
}

export interface DraftSyncOptions<S> {
  /**
   * Where records are written. Optional at construction because in React
   * the store functions only exist after render; supply them (and refresh
   * them whenever they change) with `setPersistence()`.
   */
  persistence?: DraftPersistence<S>;
  equals(a: S, b: S): boolean;
  /** True if there's nothing worth saving yet (autosave never creates blank drafts). */
  isEmpty(snapshot: S): boolean;
  /** Called after a change to the CURRENT session (never for a superseded one). */
  onChange?(view: DraftView<S>): void;
  /** Autosave status transitions for the CURRENT session. */
  onStatus?(status: SaveStatus): void;
  /** The error behind an "error" status (current session only), e.g. to decide whether retrying is pointless. */
  onError?(error: unknown): void;
}

interface Session<S> {
  id: string | null;
  type: DraftType | null;
  lastSaved: S | null;
  /** Set by `discard()`; later queued operations for this session become no-ops. */
  dead: boolean;
}

const NOT_READY = () => Promise.reject(new Error("Draft storage isn't ready yet. Please try again."));

export class DraftSync<S> {
  private readonly options: DraftSyncOptions<S>;
  private persistence: DraftPersistence<S>;
  private session: Session<S>;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(options: DraftSyncOptions<S>) {
    this.options = options;
    this.persistence = options.persistence ?? { create: NOT_READY, update: NOT_READY, remove: NOT_READY };
    this.session = DraftSync.blank<S>();
  }

  /** Swap in the current store functions. Safe at any time: operations read this when they RUN. */
  setPersistence(persistence: DraftPersistence<S>): void {
    this.persistence = persistence;
  }

  private static blank<T>(): Session<T> {
    return { id: null, type: null, lastSaved: null, dead: false };
  }

  /** Runs `task` after everything already queued, whether or not that succeeded. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private isCurrent(session: Session<S>): boolean {
    return this.session === session;
  }

  private emit(session: Session<S>) {
    if (!this.isCurrent(session)) return;
    this.options.onChange?.({
      id: session.id,
      type: session.type,
      savedSnapshot: session.lastSaved,
    });
  }

  private status(session: Session<S>, status: SaveStatus) {
    if (this.isCurrent(session)) this.options.onStatus?.(status);
  }

  get view(): DraftView<S> {
    return { id: this.session.id, type: this.session.type, savedSnapshot: this.session.lastSaved };
  }

  /** True if autosave would currently be allowed to write this record. */
  get isAutosavable(): boolean {
    const { dead, type } = this.session;
    return !dead && (type === null || type === "draft");
  }

  // -------------------------------------------------------------------
  // Session lifecycle (synchronous — safe to call from event handlers)
  // -------------------------------------------------------------------

  /** Begin editing an existing record. */
  load(record: { id: string; type: DraftType; snapshot: S }): void {
    this.session = { id: record.id, type: record.type, lastSaved: record.snapshot, dead: false };
    this.emit(this.session);
  }

  /**
   * Begin a blank draft. If the old session has unsaved autosavable
   * changes, `flush` (the editor content at click time) is written to the
   * OLD record first — "New draft" must not silently drop the last few
   * seconds of typing.
   */
  reset(flush?: S): void {
    const previous = this.session;
    this.session = DraftSync.blank<S>();
    if (flush !== undefined) {
      void this.enqueue(() => this.persistDraft(previous, flush, { force: false })).catch(
        () => undefined,
      );
    }
    this.emit(this.session);
    this.options.onStatus?.("idle");
  }

  // -------------------------------------------------------------------
  // Operations (serialized)
  // -------------------------------------------------------------------

  /**
   * Debounced autosave entry point. `readLatest` is called WHEN THE
   * OPERATION RUNS, so it sees whatever the user typed while earlier
   * saves were in flight. Errors are reported through `onStatus`, not thrown.
   */
  autosave(readLatest: () => S): Promise<void> {
    const session = this.session;
    return this.enqueue(async () => {
      if (!this.isCurrent(session)) return; // superseded; `reset` flushed it
      await this.persistDraft(session, readLatest(), { force: false }).catch(() => undefined);
    });
  }

  /**
   * Manual "Save draft": always writes, and (re)marks the record a draft.
   * `favorite` is applied when given; `undefined` leaves an existing
   * record's favorite flag untouched.
   */
  saveDraft(snapshot: S, favorite?: boolean): Promise<{ created: boolean }> {
    const session = this.session;
    return this.enqueue(() => this.persistDraft(session, snapshot, { force: true, favorite }));
  }

  /** "Save to history": writes the content and finalizes the record as `type`. */
  finalize(snapshot: S, type: Exclude<DraftType, "draft">, favorite = false): Promise<{ created: boolean }> {
    const session = this.session;
    return this.enqueue(async () => {
      this.assertAlive(session);
      let created = false;
      if (session.id) {
        const ok = await this.persistence.update(session.id, { snapshot, type, favorite: undefined });
        if (!ok) {
          session.id = null; // vanished elsewhere: recreate below rather than lose the content
        }
      }
      if (!session.id) {
        const { id } = await this.persistence.create(snapshot, type, favorite);
        session.id = id;
        created = true;
      }
      session.type = type;
      session.lastSaved = snapshot;
      this.emit(session);
      return { created };
    });
  }

  /**
   * Sets the favorite flag. With no record yet, the content is saved as
   * `fallbackType` first (favoriting something unsaved implies saving it).
   */
  setFavorite(
    favorite: boolean,
    snapshot: S,
    fallbackType: Exclude<DraftType, "draft">,
  ): Promise<void> {
    const session = this.session;
    return this.enqueue(async () => {
      this.assertAlive(session);
      if (session.id) {
        const ok = await this.persistence.update(session.id, { favorite });
        if (ok) return;
        session.id = null;
      }
      const { id } = await this.persistence.create(snapshot, fallbackType, favorite);
      session.id = id;
      session.type = fallbackType;
      session.lastSaved = snapshot;
      this.emit(session);
    });
  }

  /** Deletes the record (if it exists) and permanently stops writes for this session. */
  discard(): Promise<void> {
    const session = this.session;
    return this.enqueue(async () => {
      if (session.id) await this.persistence.remove(session.id);
      session.dead = true;
    });
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private assertAlive(session: Session<S>) {
    if (session.dead) throw new Error("This draft was deleted.");
  }

  private async persistDraft(
    session: Session<S>,
    snapshot: S,
    { force, favorite }: { force: boolean; favorite?: boolean },
  ): Promise<{ created: boolean }> {
    const { equals, isEmpty } = this.options;
    const persistence = this.persistence;

    if (!force) {
      if (session.dead) return { created: false };
      // Never demote a finalized (generated/reply) record back to a draft.
      if (session.type !== null && session.type !== "draft") return { created: false };
      if (isEmpty(snapshot)) return { created: false };
      if (session.lastSaved !== null && equals(snapshot, session.lastSaved)) return { created: false };
    } else {
      this.assertAlive(session);
    }

    this.status(session, "saving");
    try {
      let created = false;
      if (session.id) {
        const ok = await persistence.update(session.id, { snapshot, type: "draft", favorite });
        if (!ok) session.id = null; // deleted elsewhere: fall through and recreate
      }
      if (!session.id) {
        const { id } = await persistence.create(snapshot, "draft", favorite ?? false);
        session.id = id;
        created = true;
      }
      session.type = "draft";
      session.lastSaved = snapshot;
      this.emit(session);
      this.status(session, "saved");
      return { created };
    } catch (error) {
      if (this.isCurrent(session)) this.options.onError?.(error);
      this.status(session, "error");
      throw error;
    }
  }
}

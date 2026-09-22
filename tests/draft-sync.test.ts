import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftSync, type DraftPersistence, type SaveStatus } from "../src/lib/drafts/draft-sync.ts";

type Snap = { subject: string; body: string };
const eq = (a: Snap, b: Snap) => a.subject === b.subject && a.body === b.body;
const isEmpty = (s: Snap) => !s.subject.trim() && !s.body.trim();

interface Call {
  op: "create" | "update" | "remove";
  id?: string;
  snapshot?: Snap;
  type?: string;
  favorite?: boolean;
}

/** In-memory "server" whose requests each stay pending until the test releases them. */
function makeServer() {
  const records = new Map<string, { snapshot: Snap; type: string; favorite: boolean }>();
  const calls: Call[] = [];
  const gates: (() => void)[] = [];
  let nextId = 1;
  let hold = false;
  let failNext = 0;

  const gate = () =>
    hold
      ? new Promise<void>((resolve) => {
          gates.push(resolve);
        })
      : Promise.resolve();

  const persistence: DraftPersistence<Snap> = {
    async create(snapshot, type, favorite) {
      calls.push({ op: "create", snapshot, type, favorite });
      await gate();
      if (failNext > 0) {
        failNext -= 1;
        throw new Error("network");
      }
      const id = `id-${nextId++}`;
      records.set(id, { snapshot, type, favorite });
      return { id };
    },
    async update(id, patch) {
      calls.push({ op: "update", id, snapshot: patch.snapshot, type: patch.type, favorite: patch.favorite });
      await gate();
      if (failNext > 0) {
        failNext -= 1;
        throw new Error("network");
      }
      const record = records.get(id);
      if (!record) return false;
      if (patch.snapshot) record.snapshot = patch.snapshot;
      if (patch.type) record.type = patch.type;
      if (patch.favorite !== undefined) record.favorite = patch.favorite;
      return true;
    },
    async remove(id) {
      calls.push({ op: "remove", id });
      await gate();
      records.delete(id);
    },
  };

  return {
    persistence,
    records,
    calls,
    hold() {
      hold = true;
    },
    /** Let every currently-pending request finish, and stop holding new ones. */
    releaseAll() {
      hold = false;
      gates.splice(0).forEach((release) => release());
    },
    /** Let exactly the oldest pending request finish. */
    releaseOne() {
      gates.shift()?.();
    },
    failNext(count = 1) {
      failNext = count;
    },
  };
}

function makeSync(server: ReturnType<typeof makeServer>) {
  const statuses: SaveStatus[] = [];
  const sync = new DraftSync<Snap>({
    persistence: server.persistence,
    equals: eq,
    isEmpty,
    onStatus: (s) => statuses.push(s),
  });
  return { sync, statuses };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("the latest edit made while a save is in flight is still persisted", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  let editor: Snap = { subject: "A", body: "one" };

  server.hold();
  const first = sync.autosave(() => editor); // create request now pending
  await settle();
  editor = { subject: "A", body: "one two" }; // user keeps typing
  const second = sync.autosave(() => editor); // timer fired while still in flight
  editor = { subject: "A", body: "one two three" }; // ...and again
  const third = sync.autosave(() => editor);

  server.releaseAll();
  await Promise.all([first, second, third]);

  // Exactly one record, holding the newest text, and no wasted duplicate writes.
  assert.equal(server.records.size, 1);
  assert.deepEqual([...server.records.values()][0].snapshot, { subject: "A", body: "one two three" });
  assert.deepEqual(
    server.calls.map((c) => c.op),
    ["create", "update"],
  );
});

test("manual Save draft during an in-flight first save does not create a duplicate", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  const editor: Snap = { subject: "Hi", body: "hello" };

  server.hold();
  const auto = sync.autosave(() => editor);
  await settle();
  const manual = sync.saveDraft(editor);
  server.releaseAll();
  await Promise.all([auto, manual]);

  assert.equal(server.records.size, 1);
  assert.equal(server.calls.filter((c) => c.op === "create").length, 1);
});

test("finalizing while an autosave is in flight is never demoted back to a draft", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  let editor: Snap = { subject: "S", body: "b1" };

  await sync.autosave(() => editor); // record exists as a draft
  editor = { subject: "S", body: "b2" };

  server.hold();
  const auto = sync.autosave(() => editor); // PATCH type=draft in flight
  await settle();
  const save = sync.finalize(editor, "generated"); // user clicks Save
  editor = { subject: "S", body: "b3 typed after clicking save" };
  const lateAuto = sync.autosave(() => editor); // timer fires afterwards
  server.releaseAll();
  await Promise.all([auto, save, lateAuto]);

  const record = [...server.records.values()][0];
  assert.equal(record.type, "generated");
  assert.equal(record.snapshot.body, "b2"); // late edit must not overwrite a finalized email
  assert.equal(sync.isAutosavable, false);
});

test("New draft while the first save is in flight does not re-attach the old id", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  const editor: Snap = { subject: "Old", body: "old text" };

  server.hold();
  const auto = sync.autosave(() => editor); // create in flight
  await settle();
  sync.reset(); // user clicks "New draft"
  server.releaseAll();
  await auto;

  assert.equal(sync.view.id, null, "the fresh draft must not inherit the old record's id");
  assert.equal(sync.view.type, null);
  assert.equal(server.records.size, 1, "the old content was still saved once");
});

test("New draft flushes the last unsaved typing to the old record", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);

  await sync.autosave(() => ({ subject: "S", body: "saved" }));
  sync.reset({ subject: "S", body: "typed just before clicking New draft" });
  await settle();
  await settle();

  const record = [...server.records.values()][0];
  assert.equal(record.snapshot.body, "typed just before clicking New draft");
  assert.equal(server.records.size, 1);
});

test("delete stops all further autosaves for that draft", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  let editor: Snap = { subject: "S", body: "x" };
  await sync.autosave(() => editor);

  const removal = sync.discard();
  editor = { subject: "S", body: "typed while deleting" };
  const stray = sync.autosave(() => editor); // queued behind the delete
  await Promise.all([removal, stray]);

  assert.equal(server.records.size, 0);
  assert.equal(server.calls.filter((c) => c.op === "create").length, 1, "no resurrection");
  assert.equal(sync.isAutosavable, false);
});

test("a failed autosave is reported, and the next attempt saves the latest content", async () => {
  const server = makeServer();
  const { sync, statuses } = makeSync(server);
  const editor: Snap = { subject: "S", body: "content" };

  server.failNext(1);
  await sync.autosave(() => editor);
  assert.equal(statuses.at(-1), "error");
  assert.equal(server.records.size, 0);

  await sync.autosave(() => editor); // retry
  assert.equal(statuses.at(-1), "saved");
  assert.equal(server.records.size, 1);
});

test("an unchanged snapshot is not re-sent, and empty drafts are never created", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);

  await sync.autosave(() => ({ subject: "", body: "   " }));
  assert.equal(server.calls.length, 0);

  const editor: Snap = { subject: "S", body: "b" };
  await sync.autosave(() => editor);
  await sync.autosave(() => ({ ...editor }));
  assert.equal(server.calls.length, 1);
});

test("if the record was deleted elsewhere, autosave recreates it rather than losing the text", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  await sync.autosave(() => ({ subject: "S", body: "v1" }));
  server.records.clear(); // deleted from another tab

  await sync.autosave(() => ({ subject: "S", body: "v2" }));

  assert.equal(server.records.size, 1);
  assert.equal([...server.records.values()][0].snapshot.body, "v2");
});

test("Save draft keeps an existing favorite flag; favoriting an unsaved email saves it first", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  const editor: Snap = { subject: "S", body: "b" };

  await sync.setFavorite(true, editor, "generated"); // nothing saved yet → creates it
  assert.equal([...server.records.values()][0].favorite, true);
  assert.equal([...server.records.values()][0].type, "generated");

  await sync.saveDraft({ subject: "S", body: "b2" }); // favorite param omitted
  assert.equal([...server.records.values()][0].favorite, true);
  assert.equal([...server.records.values()][0].type, "draft");
});

test("loading an existing draft does not immediately re-save unchanged content", async () => {
  const server = makeServer();
  const { sync } = makeSync(server);
  const loaded: Snap = { subject: "S", body: "b" };
  server.records.set("existing", { snapshot: loaded, type: "draft", favorite: false });
  sync.load({ id: "existing", type: "draft", snapshot: loaded });

  await sync.autosave(() => ({ ...loaded }));
  assert.equal(server.calls.length, 0);

  await sync.autosave(() => ({ subject: "S", body: "edited" }));
  assert.deepEqual(server.calls.map((c) => [c.op, c.id]), [["update", "existing"]]);
});

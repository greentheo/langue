import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { opensNewDay } from "./days";
import { cleanProps, isBot, TRACKED_PATHS } from "./props";
import { createTracker, type EventRow } from "./tracker";
import { clientAddress, createVisitorHasher } from "./visitor";
import { chooseVisit } from "./visits";
import { runRules } from "../housekeeping-rules";

const ID = "cmgsd9z4k0000qz8l2v6x1abc";
const TOKEN = "0123456789abcdef0123456789abcdef";

describe("event props", () => {
  test("keeps ids, tracked paths, tokens and counts", () => {
    assert.deepEqual(cleanProps({ path: "/register", inviteCodeId: ID, visit: TOKEN, exercises: 12, challenge: 0 }), {
      path: "/register",
      inviteCodeId: ID,
      visit: TOKEN,
      exercises: 12,
      challenge: 0,
    });
  });

  test("drops free text, unknown keys and anything malformed", () => {
    assert.deepEqual(
      cleanProps({ answer: "io sono stanco", email: "a@b.c", path: "/login", inviteCodeId: "Sam's code", visit: "abc", exercises: -1, ms: 1.5 }),
      {},
    );
  });

  test("only the front page and the register page are counted", () => {
    assert.deepEqual([...TRACKED_PATHS], ["/", "/register"]);
  });
});

describe("track", () => {
  test("writes the cleaned event", async () => {
    const rows: EventRow[] = [];
    const track = createTracker(async (row) => void rows.push(row), () => undefined);
    await track("step.started", { userId: ID, props: { exercises: 9, challenge: 0, note: "free text" } });
    assert.deepEqual(rows, [{ type: "step.started", userId: ID, visitor: null, props: { exercises: 9, challenge: 0 } }]);
  });

  test("never throws, whatever the database does", async () => {
    const track = createTracker(async () => {
      throw new Error("database down");
    }, () => undefined);
    const quiet = console.error;
    console.error = () => {};
    try {
      await assert.doesNotReject(track("app.opened", { userId: ID }));
    } finally {
      console.error = quiet;
    }
  });

  test("EVENTS_OFF=1 writes nothing", async () => {
    let writes = 0;
    const track = createTracker(async () => void writes++, () => "1");
    await track("app.opened", { userId: ID });
    assert.equal(writes, 0);
  });
});

describe("the daily visitor hash", () => {
  const morning = new Date("2026-10-19T08:00:00Z");
  const evening = new Date("2026-10-19T21:00:00Z");
  const tomorrow = new Date("2026-10-20T08:00:00Z");

  test("is the same for one browser all day", () => {
    const hash = createVisitorHasher();
    assert.equal(hash("203.0.113.7", "Safari", morning), hash("203.0.113.7", "Safari", evening));
    assert.notEqual(hash("203.0.113.7", "Safari", morning), hash("203.0.113.8", "Safari", morning));
  });

  test("changes the next day, and can't be rebuilt after a restart", () => {
    const hash = createVisitorHasher();
    const today = hash("203.0.113.7", "Safari", morning);
    assert.notEqual(hash("203.0.113.7", "Safari", tomorrow), today, "a new salt each day");
    // A restart is a new process: a new salt, so a stored hash can't be recomputed.
    assert.notEqual(createVisitorHasher()("203.0.113.7", "Safari", morning), today);
  });

  test("holds nothing of the address", () => {
    const hash = createVisitorHasher()("203.0.113.7", "Safari", morning);
    assert.match(hash, /^[0-9a-f]{32}$/);
    assert.ok(!hash.includes("203"));
  });

  test("the salt is never stored: the hasher writes nowhere, and events have no address column", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "events", "visitor.ts"), "utf8");
    // Code, not comments: no database, no files, no cookies, no browser storage.
    assert.doesNotMatch(source, /from "@\/lib\/db"|from "node:fs"|prisma\.|writeFile|localStorage|document\.cookie|cookies\(|set-cookie/i);
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const event = schema.match(/^model Event \{([\s\S]*?)^\}/m)![1];
    const fields = [...event.matchAll(/^\s+(\w+)\s+\w/gm)].map(([, field]) => field);
    assert.deepEqual(fields, ["id", "userId", "user", "visitor", "type", "props", "at"]);
  });

  test("uses the first address the proxy reports", () => {
    assert.equal(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" })), "203.0.113.7");
    assert.equal(clientAddress(new Headers()), "");
  });
});

describe("the register form's visit token", () => {
  let n = 0;
  const fresh = () => `token-${++n}`;

  test("a first open is recorded with a new token", () => {
    assert.deepEqual(chooseVisit(null, fresh), { visit: "token-1", record: true });
  });

  test("a refresh before signing up reuses the open and its token", () => {
    assert.deepEqual(chooseVisit({ visit: "token-1", signedUp: false }, fresh), { visit: "token-1", record: false });
  });

  test("three signups on one device: three opens, three tokens", () => {
    const opens: { visit: string; signedUp: boolean }[] = [];
    const signups: string[] = [];
    for (let person = 0; person < 3; person++) {
      const choice = chooseVisit(opens.at(-1) ?? null, fresh);
      if (choice.record) opens.push({ visit: choice.visit, signedUp: false });
      opens.at(-1)!.signedUp = true;
      signups.push(choice.visit);
    }
    assert.equal(opens.length, 3);
    assert.equal(new Set(signups).size, 3, "no token is shared");
  });
});

describe("days and visitors", () => {
  test("app.opened once per day", () => {
    const now = new Date("2026-10-19T09:00:00Z");
    assert.equal(opensNewDay(null, now), true);
    assert.equal(opensNewDay(new Date("2026-10-19T00:10:00Z"), now), false);
    assert.equal(opensNewDay(new Date("2026-10-18T23:50:00Z"), now), true);
  });

  test("crawlers and link previews aren't visitors", () => {
    assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(isBot("WhatsApp/2.23 link preview"), true);
    assert.equal(isBot("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1"), false);
  });
});

describe("housekeeping", () => {
  test("a failing rule is logged and the others still run", async () => {
    const lines: string[] = [];
    await runRules(
      [
        { name: "first", run: async () => "done" },
        { name: "broken", run: async () => { throw new Error("no table"); } },
        { name: "last", run: async () => "done too" },
      ],
      new Date(),
      (line) => lines.push(line),
    );
    assert.deepEqual(lines, [
      "[langue] housekeeping: first: done",
      "[langue] housekeeping: broken failed: no table",
      "[langue] housekeeping: last: done too",
    ]);
  });
});

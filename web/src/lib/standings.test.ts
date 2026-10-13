import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { liveStreak, rankStandings, weekStart, type Standing } from "./standings";
import { activate, MAX_ACCOUNTS, parseTokenList, serializeTokenList } from "./auth/account-list";

describe("weekStart", () => {
  test("a Wednesday maps to the Monday before it", () => {
    assert.equal(weekStart(new Date("2026-10-14T15:30:00Z")).toISOString(), "2026-10-12T00:00:00.000Z");
  });

  test("Monday itself starts the week", () => {
    assert.equal(weekStart(new Date("2026-10-12T00:00:00Z")).toISOString(), "2026-10-12T00:00:00.000Z");
  });

  test("Sunday still belongs to the week that began six days earlier", () => {
    assert.equal(weekStart(new Date("2026-10-18T23:59:00Z")).toISOString(), "2026-10-12T00:00:00.000Z");
  });
});

describe("liveStreak", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  test("practised today or yesterday keeps the streak", () => {
    assert.equal(liveStreak(5, new Date("2026-10-14T08:00:00Z"), now), 5);
    assert.equal(liveStreak(5, new Date("2026-10-13T23:00:00Z"), now), 5);
  });

  test("a missed day breaks it", () => {
    assert.equal(liveStreak(5, new Date("2026-10-12T20:00:00Z"), now), 0);
  });
});

describe("rankStandings", () => {
  const row = (displayName: string, weekPoints: number, totalPoints: number): Standing => ({
    userId: displayName,
    displayName,
    weekPoints,
    totalPoints,
    streak: 0,
    lessonsCompleted: 0,
  });
  const rows = [row("Ada", 40, 100), row("Ben", 90, 90), row("Cal", 40, 500), row("Dee", 0, 10)];

  test("ranks by this week's points, ties sharing a rank", () => {
    const ranked = rankStandings(rows, "week");
    assert.deepEqual(
      ranked.map((r) => `${r.rank} ${r.displayName}`),
      ["1 Ben", "2 Ada", "2 Cal", "4 Dee"],
    );
  });

  test("all-time uses total points", () => {
    assert.deepEqual(
      rankStandings(rows, "all").map((r) => r.displayName),
      ["Cal", "Ada", "Ben", "Dee"],
    );
  });
});

describe("account list", () => {
  const t = (n: number) => `token${String(n).padStart(20, "0")}`;

  test("round-trips and drops junk and duplicates", () => {
    assert.deepEqual(parseTokenList(serializeTokenList([t(1), t(2)])), [t(1), t(2)]);
    assert.deepEqual(parseTokenList(`${t(1)}.not a token.${t(1)}`), [t(1)]);
    assert.deepEqual(parseTokenList(undefined), []);
  });

  test("activating a new token keeps the previous one waiting, most recent first", () => {
    const { waiting, evicted } = activate(t(3), t(2), [t(1)]);
    assert.deepEqual(waiting, [t(2), t(1)]);
    assert.deepEqual(evicted, []);
  });

  test("switching to a waiting token removes it from the waiting list", () => {
    const { waiting } = activate(t(1), t(2), [t(1), t(3)]);
    assert.deepEqual(waiting, [t(2), t(3)]);
  });

  test("beyond the limit, the longest-waiting account is signed out", () => {
    const many = Array.from({ length: MAX_ACCOUNTS }, (_, i) => t(i + 10));
    const { waiting, evicted } = activate(t(1), t(2), many);
    assert.equal(waiting.length, MAX_ACCOUNTS - 1);
    assert.equal(waiting[0], t(2));
    assert.deepEqual(evicted, many.slice(MAX_ACCOUNTS - 2));
  });
});

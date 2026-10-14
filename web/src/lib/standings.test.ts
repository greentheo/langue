import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { daysAway, levelBadges, liveStreak, nextStreak, rankStandings, weekStart, type Standing } from "./standings";
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

  test("missed days never take it away: the streak waits", () => {
    assert.equal(liveStreak(5, new Date("2026-10-12T20:00:00Z"), now), 5);
    assert.equal(liveStreak(5, new Date("2026-09-01T20:00:00Z"), now), 5);
  });

  test("a new day adds one, after a break too; the same day changes nothing", () => {
    assert.equal(nextStreak(new Date("2026-10-14T08:00:00Z"), 5, now), 5);
    assert.equal(nextStreak(new Date("2026-10-13T08:00:00Z"), 5, now), 6);
    assert.equal(nextStreak(new Date("2026-09-01T08:00:00Z"), 5, now), 6);
    assert.equal(nextStreak(new Date("2026-10-14T08:00:00Z"), 0, now), 1);
  });

  test("days away counts calendar days", () => {
    assert.equal(daysAway(new Date("2026-10-14T01:00:00Z"), now), 0);
    assert.equal(daysAway(new Date("2026-10-13T23:00:00Z"), now), 1);
    assert.equal(daysAway(new Date("2026-10-11T12:00:00Z"), now), 3);
  });
});

describe("rankStandings", () => {
  const row = (displayName: string, weekPoints: number, totalPoints: number): Standing => ({
    userId: displayName,
    displayName,
    weekPoints,
    totalPoints,
    streak: 0,
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

describe("levelBadges", () => {
  test("the highest finished level per language", () => {
    assert.deepEqual(
      levelBadges(["level:italian:a1", "level:italian:a2", "level:french:a1", "streak:7", "level:spanish:zz"]),
      ["FR A1", "IT A2"],
    );
    assert.deepEqual(levelBadges([]), []);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { localDay, localHour, reminderDue, reminderMessage, type ReminderLearner } from "./reminders";

const ROME = "Europe/Rome";
/** 6pm in Rome on 14 October (UTC+2). */
const EVENING = new Date("2026-10-14T16:00:00Z");

function learner(overrides: Partial<ReminderLearner> = {}): ReminderLearner {
  return {
    streakDays: 12,
    lastActiveAt: new Date("2026-10-12T09:00:00Z"),
    reminderCount: 0,
    lastRemindedAt: null,
    ...overrides,
  };
}

describe("reminderDue", () => {
  test("two days without practice, in the evening: the first reminder", () => {
    assert.equal(reminderDue(learner(), EVENING, ROME), 0);
  });

  test("never after just one day — no daily nagging", () => {
    assert.equal(reminderDue(learner({ lastActiveAt: new Date("2026-10-13T09:00:00Z") }), EVENING, ROME), null);
  });

  test("only in the evening where the learner is", () => {
    assert.equal(reminderDue(learner(), new Date("2026-10-14T08:00:00Z"), ROME), null, "10am in Rome");
    assert.equal(reminderDue(learner(), new Date("2026-10-14T19:30:00Z"), ROME), null, "9:30pm in Rome");
    // 6pm in Denver is midnight in Rome.
    assert.equal(reminderDue(learner(), new Date("2026-10-15T00:00:00Z"), "America/Denver"), 0);
  });

  test("then at five and twelve days, then no more", () => {
    const fiveDays = new Date("2026-10-17T16:00:00Z");
    assert.equal(reminderDue(learner({ reminderCount: 1 }), EVENING, ROME), null, "only two days yet");
    assert.equal(reminderDue(learner({ reminderCount: 1 }), fiveDays, ROME), 1);
    assert.equal(reminderDue(learner({ reminderCount: 2 }), fiveDays, ROME), null);
    assert.equal(reminderDue(learner({ reminderCount: 2 }), new Date("2026-10-24T16:00:00Z"), ROME), 2);
    assert.equal(reminderDue(learner({ reminderCount: 3 }), new Date("2026-11-30T16:00:00Z"), ROME), null);
  });

  test("at most one a day, and none for someone who never practised", () => {
    assert.equal(reminderDue(learner({ lastRemindedAt: new Date("2026-10-14T15:10:00Z") }), EVENING, ROME), null);
    assert.equal(reminderDue(learner({ streakDays: 0 }), EVENING, ROME), null);
  });

  test("an unknown time zone falls back to UTC rather than failing", () => {
    assert.equal(localHour(new Date("2026-10-14T18:00:00Z"), "Not/AZone"), 18);
    assert.equal(localDay(new Date("2026-10-14T23:30:00Z"), ROME), localDay(new Date("2026-10-15T12:00:00Z"), "UTC"));
  });
});

describe("reminderMessage", () => {
  test("names the learner and the streak, a little more urgent each time", () => {
    assert.equal(reminderMessage("Ari", 12, 0, "Italian").title, "Ari, your 12-day streak needs you");
    assert.match(reminderMessage("Ari", 12, 1, "Italian").title, /slip/);
    assert.match(reminderMessage("Ari", 1, 2, "French").title, /^Ari, your streak/);
    assert.match(reminderMessage("Ari", 12, 2, "French").body, /French/);
  });
});

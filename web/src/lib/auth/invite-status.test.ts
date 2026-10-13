import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inviteStatus, parseInviteUses, remainingUses } from "./invite-status";

const NOW = new Date("2026-10-13T12:00:00Z");
const LATER = new Date("2026-10-20T12:00:00Z");
const EARLIER = new Date("2026-10-01T12:00:00Z");

describe("inviteStatus", () => {
  test("a fresh single-use code is active", () => {
    assert.equal(inviteStatus({ maxUses: 1, useCount: 0, expiresAt: null }, NOW), "active");
  });

  test("a code with uses left stays active after some are spent", () => {
    assert.equal(inviteStatus({ maxUses: 5, useCount: 4, expiresAt: LATER }, NOW), "active");
  });

  test("a code is used up once useCount reaches maxUses", () => {
    assert.equal(inviteStatus({ maxUses: 3, useCount: 3, expiresAt: null }, NOW), "used-up");
  });

  test("a code past its expiry is expired", () => {
    assert.equal(inviteStatus({ maxUses: 3, useCount: 1, expiresAt: EARLIER }, NOW), "expired");
  });

  test("a code expiring exactly now is expired", () => {
    assert.equal(inviteStatus({ maxUses: 3, useCount: 0, expiresAt: NOW }, NOW), "expired");
  });

  test("used up takes precedence over expired", () => {
    assert.equal(inviteStatus({ maxUses: 2, useCount: 2, expiresAt: EARLIER }, NOW), "used-up");
  });
});

describe("remainingUses", () => {
  test("counts what is left and never goes negative", () => {
    assert.equal(remainingUses({ maxUses: 5, useCount: 2, expiresAt: null }), 3);
    assert.equal(remainingUses({ maxUses: 1, useCount: 1, expiresAt: null }), 0);
    assert.equal(remainingUses({ maxUses: 1, useCount: 4, expiresAt: null }), 0);
  });
});

describe("parseInviteUses", () => {
  test("accepts a number in range", () => {
    assert.equal(parseInviteUses("8"), 8);
    assert.equal(parseInviteUses(1), 1);
  });

  test("falls back to single-use for missing or invalid input", () => {
    assert.equal(parseInviteUses(""), 1);
    assert.equal(parseInviteUses(undefined), 1);
    assert.equal(parseInviteUses("lots"), 1);
    assert.equal(parseInviteUses("0"), 1);
    assert.equal(parseInviteUses("-3"), 1);
  });

  test("caps at 100 and drops fractions", () => {
    assert.equal(parseInviteUses("5000"), 100);
    assert.equal(parseInviteUses("2.9"), 2);
  });
});

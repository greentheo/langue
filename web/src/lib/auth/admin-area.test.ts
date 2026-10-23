import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_CONFIRM_MS, adminConfirmationLive, confirmPath, createWrongTries, safeReturnTo } from "./admin-area";
import { isAdminPath } from "@/lib/admin-paths";

describe("the admin password confirmation (#119)", () => {
  const at = new Date("2026-10-23T10:00:00Z");
  const later = (ms: number) => new Date(at.getTime() + ms);

  test("lasts a fixed 15 minutes from confirming", () => {
    assert.equal(ADMIN_CONFIRM_MS, 15 * 60 * 1000);
    assert.equal(adminConfirmationLive(at, later(0)), true);
    assert.equal(adminConfirmationLive(at, later(14 * 60 * 1000)), true);
    assert.equal(adminConfirmationLive(at, later(15 * 60 * 1000)), false, "not extended by activity");
    assert.equal(adminConfirmationLive(null, at), false, "never confirmed");
  });

  test("the admin pages: one list (lib/admin-paths.ts), the password prompt included", () => {
    for (const path of ["/learn/admin", "/learn/admin/stats", "/learn/admin/confirm", "/learn/invites"]) assert.equal(isAdminPath(path), true, path);
    for (const path of ["/learn", "/learn/path", "/learn/lessons/x", "/learn/administer", "/learn/invitesx", "/accounts", null]) {
      assert.equal(isAdminPath(path), false, String(path));
    }
  });

  test("after confirming it returns to where you were, and only to an admin page", () => {
    assert.equal(confirmPath("/learn/admin/stats"), "/learn/admin/confirm?next=%2Flearn%2Fadmin%2Fstats");
    assert.equal(safeReturnTo("/learn/invites"), "/learn/invites");
    assert.equal(safeReturnTo("/learn/admin/stats"), "/learn/admin/stats");
    for (const next of ["https://evil.example/learn/invites", "//evil.example/learn/admin", "/learn", "/learn/admin/confirm", null, 42]) {
      assert.equal(safeReturnTo(next), "/learn", String(next));
    }
  });

  test("five wrong passwords in 15 minutes, then wait", () => {
    const tries = createWrongTries(5, ADMIN_CONFIRM_MS);
    for (let i = 0; i < 5; i++) {
      assert.equal(tries.blocked("owner", later(i)), false);
      tries.fail("owner", later(i));
    }
    assert.equal(tries.blocked("owner", later(10)), true);
    assert.equal(tries.blocked("someone-else", later(10)), false, "per account");
    assert.equal(tries.blocked("owner", later(ADMIN_CONFIRM_MS + 10)), false, "the window passes");
    tries.fail("owner", later(0));
    tries.clear("owner");
    assert.equal(tries.blocked("owner", later(1)), false, "a right password clears the count");
  });
});

/**
 * The admin confirmation against a real database (#119), with the session
 * functions given a stand-in for the browser's cookies. Only with DB_TESTS=1:
 *
 *   DB_TESTS=1 node --env-file=.env --conditions=react-server --import tsx --test src/lib/auth/admin.db.test.ts
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { TokenJar } from "./session";

const skip = process.env.DB_TESTS !== "1";

/** One browser's cookies. */
function device(): TokenJar {
  const jar = new Map<string, string>();
  return {
    get: (name) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name, value) => void jar.set(name, value),
    delete: (name) => void jar.delete(name),
  };
}

describe("the admin confirmation on a shared device", { skip }, () => {
  let prisma: typeof import("@/lib/db").prisma;
  let session: typeof import("./session");
  const tag = randomBytes(4).toString("hex");
  const users: string[] = [];

  const user = async (name: string, isAdmin = false) => {
    const row = await prisma.user.create({ data: { email: `${name}-${tag}@example.test`, displayName: name, passwordHash: "x", isAdmin } });
    users.push(row.id);
    return row.id;
  };
  /** The active session's confirmation time, as the server sees it. */
  const confirmedAt = async (jar: TokenJar) => (await session.activeSession(jar))?.adminConfirmedAt ?? null;

  before(async () => {
    ({ prisma } = await import("@/lib/db"));
    session = await import("./session");
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  test("switching into the owner's account always asks again", async () => {
    const [owner, child] = [await user("owner", true), await user("child")];
    const ipad = device();
    await session.createSession(owner, "iPad", ipad);
    await session.confirmAdminSession(new Date(), ipad);
    assert.ok(await confirmedAt(ipad), "the owner confirmed");

    await session.createSession(child, "iPad", ipad); // the child signs in too: the owner waits
    assert.equal(await session.switchSession(owner, ipad), true); // and taps back into the owner
    assert.equal(await confirmedAt(ipad), null, "switching in cleared it");
  });

  test("a confirmation is for that session only: not the owner's other devices", async () => {
    const owner = await user("owner2", true);
    const [ipad, phone] = [device(), device()];
    await session.createSession(owner, "iPad", ipad);
    await session.createSession(owner, "phone", phone);
    await session.confirmAdminSession(new Date(), phone);
    assert.ok(await confirmedAt(phone));
    assert.equal(await confirmedAt(ipad), null);
  });

  test("leaving the admin pages clears it, and signing out takes it with the session", async () => {
    const owner = await user("owner3", true);
    const ipad = device();
    await session.createSession(owner, "iPad", ipad);
    await session.confirmAdminSession(new Date(), ipad);
    await session.clearAdminConfirmation(ipad);
    assert.equal(await confirmedAt(ipad), null);
    await session.confirmAdminSession(new Date(), ipad);
    await session.destroySession(ipad);
    assert.equal(await session.activeSession(ipad), null);
  });
});

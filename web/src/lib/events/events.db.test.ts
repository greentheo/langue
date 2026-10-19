/**
 * Events against a real database (#109). CI has no database, so these run only
 * with DB_TESTS=1 against a local one:
 *
 *   DB_TESTS=1 node --env-file=.env --conditions=react-server --import tsx --test src/lib/events/events.db.test.ts
 *
 * Everything they make is removed afterwards.
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const skip = process.env.DB_TESTS !== "1";

describe("events in the database", { skip }, () => {
  // Imported here so the suite costs nothing when skipped.
  let prisma: typeof import("@/lib/db").prisma;
  let openInvite: typeof import("./invites").openInvite;
  let trackSignup: typeof import("./invites").trackSignup;
  let trackAppOpened: typeof import("./app-opened").trackAppOpened;
  let RULES: typeof import("../housekeeping").RULES;
  const tag = randomBytes(4).toString("hex");
  let codeId = "";
  const users: string[] = [];

  async function user(name: string): Promise<string> {
    const row = await prisma.user.create({
      data: { email: `${name}-${tag}@example.test`, displayName: name, passwordHash: "x", inviteCodeId: codeId },
    });
    users.push(row.id);
    return row.id;
  }

  const events = (type: string) => prisma.event.findMany({ where: { type, props: { path: ["inviteCodeId"], equals: codeId } }, orderBy: { at: "asc" } });

  before(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ openInvite, trackSignup } = await import("./invites"));
    ({ trackAppOpened } = await import("./app-opened"));
    ({ RULES } = await import("../housekeeping"));
    codeId = (await prisma.inviteCode.create({ data: { code: `TEST-${tag}`.toUpperCase(), maxUses: 10 } })).id;
  });

  after(async () => {
    await prisma.event.deleteMany({ where: { OR: [{ userId: { in: users } }, { props: { path: ["inviteCodeId"], equals: codeId } }, { visitor: { startsWith: tag } }] } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.inviteCode.deleteMany({ where: { id: codeId } });
    await prisma.$disconnect();
  });

  test("three people sign up one after another on one device: three joins, nothing shared", async () => {
    const device = `${tag}-ipad`;
    for (const name of ["ada", "ben", "cy"]) {
      const visit = await openInvite(device, codeId);
      assert.equal(await openInvite(device, codeId), visit, "a refresh reuses the open");
      await trackSignup(await user(name), codeId, visit);
    }
    const opens = await events("invite.opened");
    const signups = await events("signup");
    assert.equal(opens.length, 3, "one open per person, refreshes not counted");
    assert.equal(signups.length, 3);
    const visits = signups.map((signup) => (signup.props as { visit: string }).visit);
    assert.equal(new Set(visits).size, 3, "three tokens");
    for (const visit of visits) {
      assert.equal(opens.filter((open) => (open.props as { visit: string }).visit === visit).length, 1, "each signup joins one open");
    }
    // Nothing ties the three accounts together: the converted opens no longer carry the device's hash.
    assert.deepEqual(opens.map((open) => open.visitor), [null, null, null]);
    assert.deepEqual(signups.map((signup) => signup.visitor), [null, null, null]);
  });

  test("a token joins one signup only", async () => {
    const visit = await openInvite(`${tag}-laptop`, codeId);
    await trackSignup(await user("dee"), codeId, visit);
    await trackSignup(await user("eve"), codeId, visit);
    const second = (await events("signup")).at(-1)!;
    assert.equal((second.props as { visit?: string }).visit, undefined);
  });

  test("app.opened once a day", async () => {
    const id = await user("fay");
    const morning = new Date();
    await trackAppOpened(id, morning);
    await trackAppOpened(id, new Date(morning.getTime() + 60_000));
    assert.equal(await prisma.event.count({ where: { userId: id, type: "app.opened" } }), 1);
  });

  test("deleting an account deletes its events", async () => {
    const id = await user("gus");
    await prisma.event.create({ data: { type: "app.opened", userId: id } });
    await prisma.user.delete({ where: { id } });
    users.splice(users.indexOf(id), 1);
    assert.equal(await prisma.event.count({ where: { userId: id } }), 0);
  });

  test("housekeeping deletes events after 180 days and writes a heartbeat, with no push keys set", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const old = await prisma.event.create({ data: { type: "app.opened", visitor: `${tag}-old`, at: new Date(now.getTime() - 181 * day) } });
    const recent = await prisma.event.create({ data: { type: "app.opened", visitor: `${tag}-recent`, at: new Date(now.getTime() - 179 * day) } });
    const heartbeats = await prisma.event.count({ where: { type: "system.heartbeat" } });
    for (const rule of RULES) await rule.run(now);
    assert.equal(await prisma.event.count({ where: { id: old.id } }), 0);
    assert.equal(await prisma.event.count({ where: { id: recent.id } }), 1);
    assert.equal(await prisma.event.count({ where: { type: "system.heartbeat" } }), heartbeats + 1);
    await prisma.event.deleteMany({ where: { type: "system.heartbeat", at: { gte: now } } });
  });
});

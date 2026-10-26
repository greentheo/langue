/**
 * The accent tip, once per learner (#114, after the review of #120). Against a
 * real database, so only with DB_TESTS=1 (see lib/events/events.db.test.ts):
 *
 *   DB_TESTS=1 node --env-file=.env --conditions=react-server --import tsx --test src/lib/path/accent-tip.db.test.ts
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const skip = process.env.DB_TESTS !== "1";

describe("the accent tip", { skip }, () => {
  let prisma: typeof import("@/lib/db").prisma;
  let claimAccentTip: typeof import("./store").claimAccentTip;
  const tag = randomBytes(4).toString("hex");
  const users: string[] = [];

  const user = async (name: string) => {
    const row = await prisma.user.create({ data: { email: `${name}-${tag}@example.test`, displayName: name, passwordHash: "x" } });
    users.push(row.id);
    return row.id;
  };

  before(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ claimAccentTip } = await import("./store"));
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  test("shows once per learner, ever: the first claim wins, later ones don't", async () => {
    const [ada, ben] = [await user("ada"), await user("ben")];
    const now = new Date();
    assert.equal(await claimAccentTip(ada, now), true);
    assert.equal(await claimAccentTip(ada, now), false, "the same learner, a later step");
    assert.equal(await claimAccentTip(ben, now), true, "another learner on the same device");
    const seen = await prisma.user.findUniqueOrThrow({ where: { id: ada }, select: { accentTipSeenAt: true } });
    assert.equal(seen.accentTipSeenAt?.getTime(), now.getTime());
  });

  test("two answers at once still show it once", async () => {
    const cy = await user("cy");
    const claims = await Promise.all([claimAccentTip(cy, new Date()), claimAccentTip(cy, new Date())]);
    assert.deepEqual(claims.filter(Boolean).length, 1);
  });
});

/**
 * Spend one use of an invite code.
 *
 * The check and the increment are a single conditional UPDATE: Postgres
 * re-evaluates the WHERE clause against the committed row when two
 * registrations race for the last use, so exactly one of them matches. Reading
 * the count first and writing it back would let both through.
 *
 * Takes the transaction client rather than importing the app's Prisma
 * singleton, so the registration action can run it inside the transaction that
 * creates the user, and scripts/smoke-db.mts can exercise the real thing.
 */

import type { Prisma } from "@/generated/prisma/client";

export async function claimInviteUse(
  tx: Prisma.TransactionClient,
  inviteId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await tx.inviteCode.updateMany({
    where: {
      id: inviteId,
      useCount: { lt: tx.inviteCode.fields.maxUses },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { useCount: { increment: 1 } },
  });

  return claimed.count === 1;
}

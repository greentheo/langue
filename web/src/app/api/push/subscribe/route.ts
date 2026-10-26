import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { deviceAccounts, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { track } from "@/lib/events/track";

/**
 * Turn on streak reminders for this phone or browser: for every learner
 * signed in on it, so a family sharing one phone turns them on once. Safe to
 * repeat — the page calls it again on each visit so a learner who signs in
 * later on the same device is included too.
 */

const BodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  timeZone: z.string().max(64).optional(),
});

export const POST = handler(async (request) => {
  await requireUser();
  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) throw new BadRequestError("That isn't a push subscription.");

  const { subscription, timeZone } = parsed.data;
  const accounts = await deviceAccounts();
  const data = { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, timeZone: timeZone ?? null };

  // The browser links its subscription on every visit; only a learner it's new for turned reminders on.
  const existing = new Set(
    (
      await prisma.pushSubscription.findMany({
        where: { endpoint: subscription.endpoint, userId: { in: accounts.map((account) => account.id) } },
        select: { userId: true },
      })
    ).map((row) => row.userId),
  );
  await prisma.$transaction(
    accounts.map((account) =>
      prisma.pushSubscription.upsert({
        where: { userId_endpoint: { userId: account.id, endpoint: subscription.endpoint } },
        create: { userId: account.id, endpoint: subscription.endpoint, ...data },
        update: data,
      }),
    ),
  );

  for (const account of accounts.filter((candidate) => !existing.has(candidate.id))) {
    await track("reminders.on", { userId: account.id });
  }
  return Response.json({ learners: accounts.map((account) => account.displayName) });
});

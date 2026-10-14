import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { deviceAccounts, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** Turn off streak reminders on this phone or browser, for everyone signed in on it. */

const BodySchema = z.object({ endpoint: z.string().url().max(1000) });

export const POST = handler(async (request) => {
  await requireUser();
  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) throw new BadRequestError("Which subscription?");

  const accounts = await deviceAccounts();
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: { in: accounts.map((account) => account.id) } },
  });
  return Response.json({ ok: true });
});

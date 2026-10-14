import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendToAll } from "@/lib/reminder-sender";

/** Send a test notification to this phone, so you can see reminders arrive. */

const BodySchema = z.object({ endpoint: z.string().url().max(1000) });

export const POST = handler(async (request) => {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) throw new BadRequestError("Which subscription?");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id, endpoint: parsed.data.endpoint },
  });
  if (subscriptions.length === 0) throw new BadRequestError("Reminders aren't on for this device yet.");

  const arrived = await sendToAll(subscriptions, {
    title: `Reminders are on, ${user.displayName}`,
    body: "If your streak needs you, you'll hear from Langue — never more than every few days.",
    url: "/learn",
  });
  if (!arrived) throw new BadRequestError("The notification couldn't be sent. Try turning reminders off and on again.");
  return Response.json({ ok: true });
});

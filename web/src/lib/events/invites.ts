import "server-only";

/** invite.opened and signup, joined by the register form's visit token (visits.ts). */

import { prisma } from "@/lib/db";
import { VISIT_TOKEN } from "./props";
import { track } from "./track";
import { chooseVisit, newVisitToken } from "./visits";

async function signedUpWith(visit: string): Promise<boolean> {
  return Boolean(
    await prisma.event.findFirst({ where: { type: "signup", props: { path: ["visit"], equals: visit } }, select: { id: true } }),
  );
}

/** A register page opened with a valid code: record the open (once per daily visitor and code) and return the form's token. */
export async function openInvite(visitor: string, inviteCodeId: string): Promise<string> {
  if (process.env.EVENTS_OFF === "1") return newVisitToken();
  try {
    const last = await prisma.event.findFirst({
      where: { type: "invite.opened", visitor, props: { path: ["inviteCodeId"], equals: inviteCodeId } },
      orderBy: { at: "desc" },
      select: { props: true },
    });
    const visit = (last?.props as { visit?: unknown } | null)?.visit;
    const lastOpen = typeof visit === "string" ? { visit, signedUp: await signedUpWith(visit) } : null;
    const choice = chooseVisit(lastOpen);
    if (choice.record) await track("invite.opened", { visitor, props: { inviteCodeId, visit: choice.visit } });
    return choice.visit;
  } catch (error) {
    console.error(`[langue] invite open not recorded: ${(error as Error).message}`);
    return newVisitToken();
  }
}

/**
 * The signup event, joined to its open by the form's token — unless that token
 * already has a signup. The joined open then forgets its visitor hash: the
 * hash was only there to count one open per device and day, and kept on a
 * converted open it would tie together accounts made on one device.
 */
export async function trackSignup(userId: string, inviteCodeId: string, token: unknown): Promise<void> {
  if (process.env.EVENTS_OFF === "1") return;
  let visit: string | undefined;
  try {
    if (typeof token === "string" && VISIT_TOKEN.test(token) && !(await signedUpWith(token))) {
      visit = token;
      await prisma.event.updateMany({
        where: { type: "invite.opened", props: { path: ["visit"], equals: token } },
        data: { visitor: null },
      });
    }
  } catch (error) {
    console.error(`[langue] signup join not recorded: ${(error as Error).message}`);
  }
  await track("signup", { userId, props: { inviteCodeId, visit } });
}

import "server-only";

/** invite.opened and signup, joined by the register form's visit token (visits.ts). */

import { prisma } from "@/lib/db";
import { VISIT_TOKEN } from "./props";
import { track } from "./track";
import { visitors } from "./visitor";
import { chooseVisit, newVisitToken } from "./visits";

async function signedUpWith(visit: string): Promise<boolean> {
  return Boolean(
    await prisma.event.findFirst({ where: { type: "signup", props: { path: ["visit"], equals: visit } }, select: { id: true } }),
  );
}

/**
 * A register page opened with a valid code: record the open (once per daily
 * visitor and code, remembered in memory only) and return the form's token.
 */
export async function openInvite(visitor: string, inviteCodeId: string): Promise<string> {
  if (process.env.EVENTS_OFF === "1") return newVisitToken();
  try {
    const key = `${visitor} open:${inviteCodeId}`;
    const last = visitors.openToken(key);
    const choice = chooseVisit(last ? { visit: last, signedUp: await signedUpWith(last) } : null);
    if (choice.record) {
      visitors.rememberOpen(key, choice.visit);
      await track("invite.opened", { props: { inviteCodeId, visit: choice.visit, firstToday: choice.firstToday } });
    }
    return choice.visit;
  } catch (error) {
    console.error(`[langue] invite open not recorded: ${(error as Error).message}`);
    return newVisitToken();
  }
}

/** The signup event, joined to its open by the form's token — unless that token already has a signup. */
export async function trackSignup(userId: string, inviteCodeId: string, token: unknown): Promise<void> {
  if (process.env.EVENTS_OFF === "1") return;
  let visit: string | undefined;
  try {
    if (typeof token === "string" && VISIT_TOKEN.test(token) && !(await signedUpWith(token))) visit = token;
  } catch (error) {
    console.error(`[langue] signup join not checked: ${(error as Error).message}`);
  }
  await track("signup", { userId, props: { inviteCodeId, visit } });
}

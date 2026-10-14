"use server";

/**
 * Joining an invite code's group with an account you already have.
 *
 * A code is a group as well as a way in: someone already learning can enter
 * a friend's code to join that group's leaderboard. That doesn't create an
 * account, so it doesn't spend one of the code's uses; an expired code can't
 * be joined.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

/** "k7m2 9qrt 4wxz" or "K7M29QRT4WXZ" → "K7M2-9QRT-4WXZ", the stored form. */
function canonicalCode(input: string): string {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return compact.length === 12 ? compact.match(/.{4}/g)!.join("-") : input.trim().toUpperCase();
}

export async function joinGroup(formData: FormData): Promise<void> {
  const user = await requireUser();
  const code = canonicalCode(String(formData.get("code") ?? ""));

  const invite = code ? await prisma.inviteCode.findUnique({ where: { code } }) : null;
  if (!invite) redirect("/learn/leaderboard?join=unknown");
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    redirect("/learn/leaderboard?join=expired");
  }

  await prisma.groupMember.upsert({
    where: { userId_inviteCodeId: { userId: user.id, inviteCodeId: invite.id } },
    create: { userId: user.id, inviteCodeId: invite.id },
    update: {},
  });

  revalidatePath("/learn", "layout");
  redirect(`/learn/leaderboard?group=${invite.id}&join=ok`);
}

"use server";

/** Confirming the admin's password for the admin pages (#119; lib/auth/admin.ts). */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";
import { confirmAdminSession } from "./session";
import { requireAdmin } from "./admin";
import { ADMIN_CONFIRM_MS, createWrongTries, safeReturnTo } from "./admin-area";

export interface ConfirmState {
  error?: string;
}

/**
 * Five wrong passwords per account in 15 minutes, then a wait. Sign-in has no
 * limit of its own yet; this keeps a child at the family iPad from guessing.
 */
const wrongTries = createWrongTries(5, ADMIN_CONFIRM_MS);

export async function confirmAdmin(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const user = await requireAdmin({ confirmed: false });
  const returnTo = safeReturnTo(formData.get("next"));
  const now = new Date();
  if (wrongTries.blocked(user.id, now)) return { error: "Too many wrong tries. Wait a few minutes and try again." };

  const password = String(formData.get("password") ?? "");
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !password || !(await verifyPassword(password, row.passwordHash))) {
    wrongTries.fail(user.id, now);
    return { error: "That isn't the password." };
  }

  wrongTries.clear(user.id);
  await confirmAdminSession(now);
  redirect(returnTo);
}

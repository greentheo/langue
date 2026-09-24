"use server";

/**
 * Authentication server actions.
 *
 * Registration requires a valid, unredeemed invite code. That is the whole
 * access-control model: this deployment is for the owner and their friends, and
 * every session spends the owner's Anthropic budget, so open signup is not a
 * feature to add later — it is the thing being prevented.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, pruneExpiredSessions } from "./session";
import { availableLanguages } from "@/lib/vocab";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * What the learner typed, echoed back so a rejected submission does not wipe
   * the form. React 19 resets an uncontrolled form once its action resolves, so
   * without this a bad invite code costs you the name and email too.
   *
   * The password is deliberately absent: re-rendering it into a value attribute
   * puts it in the DOM and in any HTML the browser caches, and password
   * managers already refill it.
   */
  values?: {
    displayName?: string;
    email?: string;
    inviteCode?: string;
  };
}

const RegisterSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200, "That password is too long."),
  inviteCode: z.string().trim().min(1, "An invite code is required."),
});

const LoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

/** Generic message for every credential failure, so the form can't be used to enumerate accounts. */
const BAD_CREDENTIALS = "Email or password is incorrect.";

function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // Echoed back on failure so the form survives a rejected submission.
  const submitted = {
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    inviteCode: String(formData.get("inviteCode") ?? ""),
  };

  const parsed = RegisterSchema.safeParse({
    ...submitted,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values: submitted };
  }

  const { displayName, email, password, inviteCode } = parsed.data;

  const invite = await prisma.inviteCode.findUnique({
    where: { code: inviteCode.toUpperCase() },
  });

  if (!invite || invite.redeemedAt) {
    return {
      fieldErrors: { inviteCode: ["That invite code is not valid."] },
      values: submitted,
    };
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return {
      fieldErrors: { inviteCode: ["That invite code has expired."] },
      values: submitted,
    };
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return {
      fieldErrors: { email: ["An account with that email already exists."] },
      values: submitted,
    };
  }

  const passwordHash = await hashPassword(password);
  const defaultLanguage = availableLanguages()[0] ?? "italian";

  // The first account to register becomes the admin, so a fresh deployment has
  // someone who can mint further invite codes without a manual DB edit.
  const isFirstUser = (await prisma.user.count()) === 0;

  let userId: string;
  try {
    // One transaction: redeeming the invite and creating the user must not be
    // separable, or a crash between them burns the code with no account.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          isAdmin: isFirstUser,
          currentLanguage: defaultLanguage,
        },
      });

      // Conditional update: if a concurrent registration redeemed this code
      // first, count is 0 and we abort rather than double-spending it.
      const claimed = await tx.inviteCode.updateMany({
        where: { id: invite.id, redeemedAt: null },
        data: { redeemedAt: new Date(), redeemedById: created.id },
      });

      if (claimed.count === 0) {
        throw new InviteAlreadyRedeemedError();
      }

      return created;
    });
    userId = user.id;
  } catch (error) {
    if (error instanceof InviteAlreadyRedeemedError) {
      return {
        fieldErrors: { inviteCode: ["That invite code was just used."] },
        values: submitted,
      };
    }
    throw error;
  }

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  await createSession(userId, userAgent);

  redirect("/learn");
}

class InviteAlreadyRedeemedError extends Error {}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = { email: String(formData.get("email") ?? "") };

  const parsed = LoginSchema.safeParse({
    ...submitted,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values: submitted };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Hash anyway so a missing account and a wrong password take the same time.
    await hashPassword(password);
    return { error: BAD_CREDENTIALS, values: submitted };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: BAD_CREDENTIALS, values: submitted };
  }

  await pruneExpiredSessions();

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, userAgent);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  redirect("/learn");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

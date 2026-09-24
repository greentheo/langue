"use server";

/**
 * Learner preference updates.
 *
 * Split out from auth actions: these run on an already-authenticated user and
 * only touch their own row.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { hasLanguage, isLevel } from "@/lib/vocab";

const PreferencesSchema = z.object({
  language: z.string().min(1),
  level: z.string().min(1),
});

export async function updatePreferences(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = PreferencesSchema.safeParse({
    language: formData.get("language"),
    level: formData.get("level"),
  });

  if (!parsed.success) return;

  const language = parsed.data.language.toLowerCase();
  const level = parsed.data.level.toLowerCase();

  // Reject anything not in the catalog rather than storing a value that would
  // make every subsequent activity request fail validation.
  if (!hasLanguage(language) || !isLevel(level)) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { currentLanguage: language, currentLevel: level },
  });

  revalidatePath("/learn");
}

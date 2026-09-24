import "server-only";

/**
 * Invite code creation and listing.
 *
 * Codes are short and human-readable because they get pasted into a chat
 * message, not scanned. They are single-use and only grant the right to create
 * one account, so the entropy budget is small — but they are still CSPRNG
 * output, never sequential.
 */

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Crockford base32 without I, L, O, U: no character pairs a person can confuse
 * when retyping a code, and no accidental words.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 3;
const GROUP_SIZE = 4;

/** e.g. "K7M2-9QRT-4WXZ" — 60 bits, plenty for a single-use code. */
export function generateInviteCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < GROUP_SIZE; i += 1) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

export interface CreateInviteOptions {
  note?: string;
  createdById?: string;
  expiresInDays?: number;
}

export async function createInvite(options: CreateInviteOptions = {}) {
  const { note, createdById, expiresInDays } = options;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Retry on the astronomically unlikely collision rather than 500.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const existing = await prisma.inviteCode.findUnique({ where: { code } });
    if (existing) continue;

    return prisma.inviteCode.create({
      data: { code, note, createdById, expiresAt },
    });
  }

  throw new Error("Could not generate a unique invite code after 5 attempts.");
}

export async function listInvites() {
  return prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      redeemedBy: { select: { displayName: true, email: true } },
    },
    take: 100,
  });
}

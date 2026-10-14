/**
 * Mint an invite code from the command line.
 *
 * Solves the bootstrap problem: a fresh deployment has no users, so nobody can
 * sign in to the admin page to create the first invite. Run this once against
 * the production database, register with the code it prints, and that first
 * account becomes the admin who can mint the rest from the UI.
 *
 *   npm run invite -- --note "for Sam" --days 14
 *   npm run invite -- --note "book club" --uses 8
 *
 * On Railway: `railway run npm run invite`
 */

import { existsSync } from "node:fs";
import { randomInt } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { parseInviteUses } from "../src/lib/auth/invite-status.js";

// Standalone script: nothing has loaded .env for us.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Point it at the target database and retry.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g += 1) {
    let group = "";
    for (let i = 0; i < 4; i += 1) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}

function parseArgs(argv: string[]) {
  const args: { note?: string; days?: number; count: number; uses: number } = {
    count: 1,
    uses: 1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--note") args.note = argv[++i];
    else if (flag === "--days") args.days = Number(argv[++i]);
    else if (flag === "--count") args.count = Math.max(1, Number(argv[++i]) || 1);
    else if (flag === "--uses") args.uses = parseInviteUses(argv[++i]);
    else if (flag === "--help" || flag === "-h") {
      console.log(
        "Usage: npm run invite -- [--note <text>] [--days <n>] [--uses <n>] [--count <n>]\n" +
          "  --uses   accounts each code can create (1-100, default 1)\n" +
          "  --count  how many codes to mint (default 1)",
      );
      process.exit(0);
    }
  }

  return args;
}

async function main() {
  const { note, days, count, uses } = parseArgs(process.argv.slice(2));

  const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  const userCount = await prisma.user.count();
  // Only the owner runs this script, so their codes are theirs: they are in
  // each code's group and see its leaderboard.
  const owner = await prisma.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: "asc" } });

  for (let i = 0; i < count; i += 1) {
    const invite = await prisma.inviteCode.create({
      data: {
        code: generateCode(),
        note,
        expiresAt,
        maxUses: uses,
        createdById: owner?.id,
        ...(owner ? { groupMembers: { create: { userId: owner.id } } } : {}),
      },
    });

    console.log(invite.code);
  }

  if (userCount === 0) {
    console.log(
      "\nThis database has no users yet — the first account to register with " +
        "one of these codes becomes the admin.",
    );
  }

  if (uses > 1) {
    console.log(`\nEach code can create ${uses} accounts.`);
  }

  if (expiresAt) {
    console.log(`\nExpires ${expiresAt.toISOString()}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

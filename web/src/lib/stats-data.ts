import "server-only";

/**
 * Reads what the usage dashboard needs (#109), counting in the database so the
 * page never loads raw events: a few hundred rows at most, however many events
 * there are. The numbers themselves are worked out in stats.ts.
 */

import { prisma } from "@/lib/db";
import { utcDay, type StatsInput } from "./stats";

const DAY_MS = 24 * 60 * 60 * 1000;
const num = (value: bigint | number) => Number(value);

export async function loadStats(now: Date = new Date()): Promise<StatsInput> {
  // The same windows stats.ts uses: today and the 29 UTC days before it; 14 days for health.
  const since30 = new Date(`${utcDay(new Date(now.getTime() - 29 * DAY_MS))}T00:00:00Z`);
  const since14 = new Date(`${utcDay(new Date(now.getTime() - 13 * DAY_MS))}T00:00:00Z`);

  const [users, codes, practice, frontVisitors, inviteOpens, appOpened, stepsStarted, eventDays, reminders] = await Promise.all([
    prisma.user.findMany({ select: { id: true, createdAt: true, inviteCodeId: true, streakDays: true } }),
    prisma.inviteCode.findMany({ select: { id: true, note: true, createdAt: true } }),
    prisma.$queryRaw<{ userId: string; day: string; steps: bigint }[]>`
      SELECT "userId", to_char("completedAt", 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE "activityType" IN ('step', 'challenge')) AS steps
      FROM "ActivityLog" GROUP BY 1, 2`,
    prisma.$queryRaw<{ day: string; visitors: bigint }[]>`
      SELECT to_char(at, 'YYYY-MM-DD') AS day, COUNT(DISTINCT visitor) AS visitors
      FROM "Event" WHERE type = 'page.viewed' AND props ->> 'path' = '/' GROUP BY 1`,
    prisma.$queryRaw<{ inviteCodeId: string; total: bigint; recent: bigint }[]>`
      SELECT props ->> 'inviteCodeId' AS "inviteCodeId", COUNT(*) AS total, COUNT(*) FILTER (WHERE at >= ${since30}) AS recent
      FROM "Event" WHERE type = 'invite.opened' GROUP BY 1`,
    prisma.$queryRaw<{ userId: string; day: string }[]>`
      SELECT DISTINCT "userId", to_char(at, 'YYYY-MM-DD') AS day
      FROM "Event" WHERE type = 'app.opened' AND at >= ${since30} AND "userId" IS NOT NULL`,
    prisma.event.count({ where: { type: "step.started", at: { gte: since30 } } }),
    prisma.$queryRaw<{ day: string; events: bigint; heartbeats: bigint }[]>`
      SELECT to_char(at, 'YYYY-MM-DD') AS day, COUNT(*) AS events, COUNT(*) FILTER (WHERE type = 'system.heartbeat') AS heartbeats
      FROM "Event" WHERE at >= ${since14} GROUP BY 1`,
    prisma.pushSubscription.findMany({ distinct: ["userId"], select: { userId: true } }),
  ]);

  return {
    now,
    users,
    codes,
    practice: practice.map((row) => ({ userId: row.userId, day: row.day, steps: num(row.steps) })),
    frontVisitors: frontVisitors.map((row) => ({ day: row.day, visitors: num(row.visitors) })),
    inviteOpens: inviteOpens.map((row) => ({ inviteCodeId: row.inviteCodeId, total: num(row.total), recent: num(row.recent) })),
    appOpened,
    stepsStarted,
    eventDays: eventDays.map((row) => ({ day: row.day, events: num(row.events), heartbeats: num(row.heartbeats) })),
    remindersOn: reminders.length,
  };
}

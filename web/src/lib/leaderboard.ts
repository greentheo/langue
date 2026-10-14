import "server-only";

/**
 * Leaderboards, one per invite code.
 *
 * Everyone who joined with a code is a group, plus whoever made the code. A
 * learner sees a board for each group they are in; nobody else can see it.
 * No new tables: membership is User.inviteCodeId and InviteCode.createdById.
 */

import { prisma } from "@/lib/db";
import {
  levelBadges,
  liveStreak,
  rankStandings,
  weekStart,
  type BoardPeriod,
  type RankedStanding,
  type Standing,
} from "@/lib/standings";

export interface Group {
  id: string;
  /** The code's note ("Family"), or the code itself when it has none. */
  name: string;
  memberCount: number;
}

/** Members of a code: everyone who joined with it, plus its creator. */
function memberIds(code: { createdById: string | null; members: { id: string }[] }): Set<string> {
  const ids = new Set(code.members.map((member) => member.id));
  if (code.createdById) ids.add(code.createdById);
  return ids;
}

/**
 * The groups a user belongs to, largest first. A group of one is left out —
 * a leaderboard with only yourself on it is not a leaderboard yet.
 */
export async function groupsFor(userId: string): Promise<Group[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { inviteCodeId: true },
  });

  const codes = await prisma.inviteCode.findMany({
    where: {
      OR: [
        ...(user?.inviteCodeId ? [{ id: user.inviteCodeId }] : []),
        { createdById: userId },
      ],
    },
    select: {
      id: true,
      code: true,
      note: true,
      createdById: true,
      members: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return codes
    .map((code) => ({
      id: code.id,
      name: code.note?.trim() || code.code,
      memberCount: memberIds(code).size,
    }))
    .filter((group) => group.memberCount >= 2)
    .sort((a, b) => b.memberCount - a.memberCount);
}

/**
 * A group's standings, or null if the group does not exist or the viewer is
 * not in it. The membership check lives here, next to the query, so no page
 * can forget it.
 */
export async function leaderboard(
  groupId: string,
  viewerId: string,
  period: BoardPeriod,
  now: Date = new Date(),
): Promise<RankedStanding[] | null> {
  const code = await prisma.inviteCode.findUnique({
    where: { id: groupId },
    select: { createdById: true, members: { select: { id: true } } },
  });
  if (!code) return null;

  const ids = [...memberIds(code)];
  if (!ids.includes(viewerId)) return null;

  const [users, week, finished] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, points: true, streakDays: true, lastActiveAt: true },
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, completedAt: { gte: weekStart(now) } },
      _sum: { pointsEarned: true },
    }),
    prisma.achievement.findMany({
      where: { userId: { in: ids }, name: { startsWith: "level:" } },
      select: { userId: true, name: true },
    }),
  ]);

  const weekPoints = new Map(week.map((row) => [row.userId, row._sum.pointsEarned ?? 0]));

  const standings: Standing[] = users.map((user) => ({
    userId: user.id,
    displayName: user.displayName,
    weekPoints: weekPoints.get(user.id) ?? 0,
    totalPoints: user.points,
    streak: liveStreak(user.streakDays, user.lastActiveAt, now),
    badges: levelBadges(finished.filter((row) => row.userId === user.id).map((row) => row.name)),
  }));

  return rankStandings(standings, period);
}

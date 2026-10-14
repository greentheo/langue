import "server-only";

/**
 * Leaderboards, one per invite code.
 *
 * Each code is a group: everyone who joined with it, whoever made it, and
 * anyone who joined the group later by entering the code. A learner can be
 * in several groups, sees a board for each, and nobody outside a group can
 * see its board. Membership is the GroupMember table.
 */

import { prisma } from "@/lib/db";
import { inviteStatus } from "@/lib/auth/invite-status";
import {
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
  /** The code, to invite others into the group. */
  code: string;
  /** Whether the code can still create accounts: new people need a use left. */
  status: "active" | "used-up" | "expired";
}

/** The groups a user belongs to, largest first. */
export async function groupsFor(userId: string): Promise<Group[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: {
      inviteCode: {
        select: {
          id: true,
          code: true,
          note: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
          _count: { select: { groupMembers: true } },
        },
      },
    },
  });

  return memberships
    .map(({ inviteCode: code }) => ({
      id: code.id,
      name: code.note?.trim() || code.code,
      memberCount: code._count.groupMembers,
      code: code.code,
      status: inviteStatus(code),
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
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
  const members = await prisma.groupMember.findMany({
    where: { inviteCodeId: groupId },
    select: { userId: true },
  });
  const ids = members.map((member) => member.userId);
  if (!ids.includes(viewerId)) return null;

  const [users, week] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, points: true, streakDays: true, lastActiveAt: true },
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, completedAt: { gte: weekStart(now) } },
      _sum: { pointsEarned: true },
    }),
  ]);

  const weekPoints = new Map(week.map((row) => [row.userId, row._sum.pointsEarned ?? 0]));

  const standings: Standing[] = users.map((user) => ({
    userId: user.id,
    displayName: user.displayName,
    weekPoints: weekPoints.get(user.id) ?? 0,
    totalPoints: user.points,
    streak: liveStreak(user.streakDays, user.lastActiveAt, now),
  }));

  return rankStandings(standings, period);
}

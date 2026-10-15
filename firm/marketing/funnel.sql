-- Langue — marketing funnel, aggregate counts only.
--
-- For the owner to run against production (see issue #75), e.g.
--   railway connect Postgres        then, from the repo root:
--   \i firm/marketing/funnel.sql
--
-- Read-only. Returns counts only: no names, emails, invite codes or code notes.
-- The repo is public, so paste totals, not per-code rows, into issues.
--
-- "Practised" means a finished step, challenge or activity (ActivityLog), not
-- just signing in: lastActiveAt starts at sign-up, so it can't tell the two apart.

\echo '== 1. Learners'
SELECT
  count(*)                                                        AS learners,
  count(*) FILTER (WHERE u."createdAt" > now() - interval '7 days')  AS joined_last_7d,
  count(*) FILTER (WHERE u."createdAt" > now() - interval '30 days') AS joined_last_30d,
  count(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM "ActivityLog" l WHERE l."userId" = u.id))      AS never_practised
FROM "User" u;

\echo '== 2. Practising now (distinct learners with a finished activity)'
SELECT
  count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '1 day')   AS last_24h,
  count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '7 days')  AS last_7d,
  count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '30 days') AS last_30d
FROM "ActivityLog" l;

\echo '== 3. Two-week fit: of learners who joined 14+ days ago, how many still practise'
WITH cohort AS (
  SELECT u.id,
         count(DISTINCT date_trunc('day', l."completedAt")) AS days_practised,
         max(l."completedAt")                              AS last_practice
  FROM "User" u
  LEFT JOIN "ActivityLog" l ON l."userId" = u.id
  WHERE u."createdAt" <= now() - interval '14 days'
  GROUP BY u.id
)
SELECT
  count(*)                                                           AS joined_14d_or_more_ago,
  count(*) FILTER (WHERE last_practice > now() - interval '7 days')  AS practised_last_7d,
  count(*) FILTER (WHERE days_practised >= 5)                        AS practised_on_5plus_days
FROM cohort;

\echo '== 4. Invite codes, by order made (no code strings or notes)'
SELECT
  row_number() OVER (ORDER BY c."createdAt")                         AS code_no,
  c."createdAt"::date                                                AS made,
  c."maxUses"                                                        AS uses_allowed,
  c."useCount"                                                       AS joined_with_it,
  (SELECT count(*) FROM "GroupMember" g WHERE g."inviteCodeId" = c.id) AS group_size,
  (SELECT count(DISTINCT u.id)
     FROM "User" u JOIN "ActivityLog" l ON l."userId" = u.id
    WHERE u."inviteCodeId" = c.id
      AND l."completedAt" > now() - interval '7 days')               AS joined_with_it_practised_7d
FROM "InviteCode" c
ORDER BY c."createdAt";

\echo '== 5. Languages being learned (current choice)'
SELECT u."currentLanguage" AS language, count(*) AS learners
FROM "User" u
GROUP BY 1
ORDER BY 2 DESC;

\echo '== 6. What people use, last 14 days (activity sessions by type)'
-- step / challenge = the guided path (no AI); lesson, phrases = course pages
-- (no AI, except the optional "ask" box); conversation, reading, translation,
-- fill_blank = optional AI tools; flashcards = no AI unless a miss is
-- explained. (Names: web/src/lib/activity-types.ts.)
SELECT l."activityType" AS activity, count(*) AS sessions, count(DISTINCT l."userId") AS learners
FROM "ActivityLog" l
WHERE l."completedAt" > now() - interval '14 days'
GROUP BY 1
ORDER BY 2 DESC;

\echo '== 7. Reminders turned on (learners with at least one device subscribed)'
SELECT count(DISTINCT p."userId") AS learners_with_reminders
FROM "PushSubscription" p;

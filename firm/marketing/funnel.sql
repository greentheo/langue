-- Langue — marketing funnel, counts only.
--
-- For the owner to run against production (see issue #75), e.g.
--   railway connect Postgres        then, from the repo root:
--   \i firm/marketing/funnel.sql
--
-- It can't write: everything runs in a READ ONLY transaction that is rolled
-- back at the end.
--
-- Two kinds of output:
--   PASTEABLE — totals, with a count of 1 or 2 shown as "<3", so a small
--               number can't point at one person (0 is shown: it points at
--               nobody). Safe to paste into #75.
--   OWNER'S EYES ONLY — one row per invite code or per activity type. In a
--               group this size a row can be one person. Read it; don't paste
--               it anywhere (the repo and its issues are public).
--
-- "Practised" means a finished step, challenge or activity (ActivityLog), not
-- just signing in: lastActiveAt starts at sign-up, so it can't tell the two apart.

BEGIN READ ONLY;

\echo '== 1. Learners                                            [PASTEABLE]'
WITH n AS (
  SELECT
    count(*)                                                           AS learners,
    count(*) FILTER (WHERE u."createdAt" > now() - interval '7 days')  AS joined_last_7d,
    count(*) FILTER (WHERE u."createdAt" > now() - interval '30 days') AS joined_last_30d,
    count(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM "ActivityLog" l WHERE l."userId" = u.id))         AS never_practised
  FROM "User" u
)
SELECT
  CASE WHEN learners BETWEEN 1 AND 2 THEN '<3' ELSE learners::text        END AS learners,
  CASE WHEN joined_last_7d BETWEEN 1 AND 2 THEN '<3' ELSE joined_last_7d::text  END AS joined_last_7d,
  CASE WHEN joined_last_30d BETWEEN 1 AND 2 THEN '<3' ELSE joined_last_30d::text END AS joined_last_30d,
  CASE WHEN never_practised BETWEEN 1 AND 2 THEN '<3' ELSE never_practised::text END AS never_practised
FROM n;

\echo '== 2. Practising now: learners with a finished activity  [PASTEABLE]'
WITH n AS (
  SELECT
    count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '1 day')   AS last_24h,
    count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '7 days')  AS last_7d,
    count(DISTINCT l."userId") FILTER (WHERE l."completedAt" > now() - interval '30 days') AS last_30d
  FROM "ActivityLog" l
)
SELECT
  CASE WHEN last_24h BETWEEN 1 AND 2 THEN '<3' ELSE last_24h::text END AS last_24h,
  CASE WHEN last_7d BETWEEN 1 AND 2 THEN '<3' ELSE last_7d::text  END AS last_7d,
  CASE WHEN last_30d BETWEEN 1 AND 2 THEN '<3' ELSE last_30d::text END AS last_30d
FROM n;

\echo '== 3. Two-week fit: of learners who joined 14+ days ago, how many still practise  [PASTEABLE]'
WITH cohort AS (
  SELECT u.id,
         count(DISTINCT date_trunc('day', l."completedAt")) AS days_practised,
         max(l."completedAt")                              AS last_practice
  FROM "User" u
  LEFT JOIN "ActivityLog" l ON l."userId" = u.id
  WHERE u."createdAt" <= now() - interval '14 days'
  GROUP BY u.id
), n AS (
  SELECT
    count(*)                                                          AS joined_14d_or_more_ago,
    count(*) FILTER (WHERE last_practice > now() - interval '7 days') AS practised_last_7d,
    count(*) FILTER (WHERE days_practised >= 5)                       AS practised_on_5plus_days
  FROM cohort
)
SELECT
  CASE WHEN joined_14d_or_more_ago BETWEEN 1 AND 2 THEN '<3' ELSE joined_14d_or_more_ago::text  END AS joined_14d_or_more_ago,
  CASE WHEN practised_last_7d BETWEEN 1 AND 2 THEN '<3' ELSE practised_last_7d::text       END AS practised_last_7d,
  CASE WHEN practised_on_5plus_days BETWEEN 1 AND 2 THEN '<3' ELSE practised_on_5plus_days::text END AS practised_on_5plus_days
FROM n;

\echo '== 4. Invite codes, summary                              [PASTEABLE]'
WITH per_code AS (
  SELECT c.id, c."useCount",
         EXISTS (SELECT 1
                   FROM "User" u JOIN "ActivityLog" l ON l."userId" = u.id
                  WHERE u."inviteCodeId" = c.id
                    AND l."completedAt" > now() - interval '7 days') AS someone_practising_7d
  FROM "InviteCode" c
), n AS (
  SELECT
    count(*)                                     AS codes_made,
    count(*) FILTER (WHERE "useCount" > 0)       AS codes_used,
    coalesce(sum("useCount"), 0)                 AS joined_with_a_code,
    count(*) FILTER (WHERE someone_practising_7d) AS codes_with_someone_practising_7d
  FROM per_code
)
SELECT
  CASE WHEN codes_made BETWEEN 1 AND 2 THEN '<3' ELSE codes_made::text         END AS codes_made,
  CASE WHEN codes_used BETWEEN 1 AND 2 THEN '<3' ELSE codes_used::text         END AS codes_used,
  CASE WHEN joined_with_a_code BETWEEN 1 AND 2 THEN '<3' ELSE joined_with_a_code::text END AS joined_with_a_code,
  CASE WHEN codes_with_someone_practising_7d BETWEEN 1 AND 2 THEN '<3'
       ELSE codes_with_someone_practising_7d::text END                        AS codes_with_someone_practising_7d
FROM n;

\echo '== 5. Languages being learned (current choice)          [PASTEABLE]'
SELECT u."currentLanguage" AS language,
       CASE WHEN count(*) BETWEEN 1 AND 2 THEN '<3' ELSE count(*)::text END AS learners
FROM "User" u
GROUP BY 1
ORDER BY count(*) DESC;

\echo '== 6. Guided path vs. AI tools, last 14 days             [PASTEABLE]'
-- step / challenge = the guided path; lesson / phrases = course pages (no AI,
-- except the optional "ask" box); conversation, reading, translation,
-- fill_blank = optional AI tools; flashcards = no AI unless a miss is
-- explained. (Names: web/src/lib/activity-types.ts.)
WITH tagged AS (
  SELECT l."userId",
         CASE
           WHEN l."activityType" IN ('step', 'challenge')                                    THEN '1 guided path'
           WHEN l."activityType" IN ('lesson', 'phrases')                                    THEN '2 course pages'
           WHEN l."activityType" IN ('conversation', 'reading', 'translation', 'fill_blank') THEN '3 AI tools'
           WHEN l."activityType" = 'flashcards'                                              THEN '4 flashcards'
           ELSE '5 other'
         END AS kind
  FROM "ActivityLog" l
  WHERE l."completedAt" > now() - interval '14 days'
)
SELECT kind,
       CASE WHEN count(*) BETWEEN 1 AND 2 THEN '<3' ELSE count(*)::text END                         AS sessions,
       CASE WHEN count(DISTINCT "userId") BETWEEN 1 AND 2 THEN '<3' ELSE count(DISTINCT "userId")::text END AS learners
FROM tagged
GROUP BY kind
ORDER BY kind;

\echo '== 7. Reminders turned on                                 [PASTEABLE]'
SELECT CASE WHEN count(DISTINCT p."userId") BETWEEN 1 AND 2 THEN '<3'
            ELSE count(DISTINCT p."userId")::text END AS learners_with_reminders
FROM "PushSubscription" p;

\echo ''
\echo '-------------------------------------------------------------------'
\echo 'OWNER''S EYES ONLY below this line: a row can be one person. Do not paste.'
\echo '-------------------------------------------------------------------'

\echo '== 8. Invite codes, one row each, by order made (no code strings or notes)'
SELECT
  row_number() OVER (ORDER BY c."createdAt")                           AS code_no,
  c."createdAt"::date                                                  AS made,
  c."maxUses"                                                          AS uses_allowed,
  c."useCount"                                                         AS joined_with_it,
  (SELECT count(*) FROM "GroupMember" g WHERE g."inviteCodeId" = c.id) AS group_size,
  (SELECT count(DISTINCT u.id)
     FROM "User" u JOIN "ActivityLog" l ON l."userId" = u.id
    WHERE u."inviteCodeId" = c.id
      AND l."completedAt" > now() - interval '7 days')                 AS joined_with_it_practised_7d
FROM "InviteCode" c
ORDER BY c."createdAt";

\echo '== 9. Activity types, last 14 days, exact counts'
SELECT l."activityType" AS activity, count(*) AS sessions, count(DISTINCT l."userId") AS learners
FROM "ActivityLog" l
WHERE l."completedAt" > now() - interval '14 days'
GROUP BY 1
ORDER BY 2 DESC;

ROLLBACK;

-- Ending misses (#70): did marking wrong endings wrong push learners under the
-- new-material gate?
--
-- The planner only adds new material while a learner got at least 70% right
-- over their last three steps (planner.ts MIN_ACCURACY, store.ts
-- recentAccuracy). Since #70, a near miss with the wrong ending counts as a
-- miss, and each step records how many in ActivityLog.metadata.endingMisses
-- (otherForm: another real form, e.g. "comemos" for "comimos"; misspelt: a
-- slip in the ending that makes no word).
--
-- Tripwire: if pct_learners_under_gate doubles from the week before to the
-- week after, the owner decides whether ending misses should count half
-- toward the gate for a month.
--
-- Aggregate only: counts and shares, never a learner. Read-only. The owner
-- runs it against production after setting the release time below. In a
-- group this small even totals point at people, so the results stay with the
-- owner and are never pasted into a public issue.

WITH params AS (
  SELECT timestamptz '2026-10-20 00:00+00' AS released   -- set to when #70 deployed
),
steps AS (
  SELECT
    a."userId",
    a."completedAt",
    COALESCE((a.metadata -> 'endingMisses' ->> 'otherForm')::int, 0) AS other_form,
    COALESCE((a.metadata -> 'endingMisses' ->> 'misspelt')::int, 0) AS misspelt,
    -- What the planner sees after this step: share right over it and the two before.
    SUM(a."itemsCorrect") OVER recent::float / NULLIF(SUM(a."itemsTotal") OVER recent, 0) AS recent_accuracy
  FROM "ActivityLog" a
  WHERE a."activityType" = 'step'
  WINDOW recent AS (PARTITION BY a."userId", a.language ORDER BY a."completedAt" ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
),
weeks AS (
  SELECT
    s.*,
    CASE
      WHEN s."completedAt" >= p.released - interval '7 days' AND s."completedAt" < p.released THEN 'week before'
      WHEN s."completedAt" >= p.released AND s."completedAt" < p.released + interval '7 days' THEN 'week after'
    END AS week
  FROM steps s CROSS JOIN params p
)
SELECT
  week,
  COUNT(DISTINCT "userId") AS active_learners,
  ROUND(100.0 * COUNT(DISTINCT "userId") FILTER (WHERE recent_accuracy < 0.7)
        / NULLIF(COUNT(DISTINCT "userId"), 0), 1) AS pct_learners_under_gate,
  COUNT(*) AS steps,
  ROUND(100.0 * COUNT(*) FILTER (WHERE recent_accuracy < 0.7) / NULLIF(COUNT(*), 0), 1) AS pct_steps_under_gate,
  SUM(other_form) AS ending_misses_other_form,
  SUM(misspelt) AS ending_misses_misspelt
FROM weeks
WHERE week IS NOT NULL
GROUP BY week
ORDER BY week DESC;  -- the week before first

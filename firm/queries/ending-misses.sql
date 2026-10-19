-- Ending and accent misses (#70, #114): did marking wrong endings, and
-- accents that change the word, wrong push learners under the new-material
-- gate?
--
-- The planner only adds new material while a learner got at least 70% right
-- over their last three steps (planner.ts MIN_ACCURACY, store.ts
-- recentAccuracy). Since #70, a near miss with the wrong ending counts as a
-- miss, and each step records how many in ActivityLog.metadata.endingMisses
-- (otherForm: another real form, e.g. "comemos" for "comimos"; misspelt: a
-- slip in the ending that makes no word). Since #114, each step also records
-- ActivityLog.metadata.accentMisses (otherForm: "parle" for "parlé";
-- otherWord: "e" for "è"; plain: a slip that makes no word, still close).
-- Run it with the release time of whichever change is being judged.
--
-- Tripwire: if pct_learners_under_gate doubles from the week before to the
-- week after, the owner decides whether ending misses (or, for #114, accent
-- misses that change the word) should count half toward the gate for a month.
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
    COALESCE((a.metadata -> 'accentMisses' ->> 'otherForm')::int, 0) AS accent_other_form,
    COALESCE((a.metadata -> 'accentMisses' ->> 'otherWord')::int, 0) AS accent_other_word,
    COALESCE((a.metadata -> 'accentMisses' ->> 'plain')::int, 0) AS accent_plain,
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
  SUM(misspelt) AS ending_misses_misspelt,
  SUM(accent_other_form) AS accent_misses_other_form,
  SUM(accent_other_word) AS accent_misses_other_word,
  SUM(accent_plain) AS accent_slips_plain
FROM weeks
WHERE week IS NOT NULL
GROUP BY week
ORDER BY week DESC;  -- the week before first

import { test } from "node:test";
import assert from "node:assert/strict";
import { getLevelCurriculum } from "@/lib/curriculum";
import { acceptedAnswers, gradePracticeItem } from "@/lib/engine/practice";
import { gradeReply } from "@/lib/path/sentences";
import { LEVELS } from "@/lib/vocab/types";

/**
 * Every answer a lesson lists as acceptable is graded correct — not merely
 * close, not wrong. Catches answers that only ever passed by the grader's
 * leniency, which a stricter grader would start marking wrong.
 */
for (const language of ["italian", "spanish", "french", "portuguese"]) {
  test(`${language}: every listed answer to every practice item is graded correct`, () => {
    const problems: string[] = [];
    for (const level of LEVELS) {
      for (const lesson of getLevelCurriculum(language, level)?.lessons ?? []) {
        lesson.practice.forEach((item, index) => {
          for (const answer of acceptedAnswers(item).answers) {
            const grade = gradePracticeItem(item, answer, level);
            if (grade.verdict !== "correct") problems.push(`${lesson.id} #${index}: "${answer}" → ${grade.verdict}`);
          }
        });
      }
    }
    assert.deepEqual(problems, []);
  });
}

for (const language of ["italian", "spanish", "french", "portuguese"]) {
  test(`${language}: every listed role-play reply is graded correct`, () => {
    const problems: string[] = [];
    for (const level of LEVELS) {
      for (const dialogue of getLevelCurriculum(language, level)?.dialogues ?? []) {
        dialogue.lines.forEach((line, index) => {
          if (!("you" in line)) return;
          for (const answer of line.answers.filter((reply) => !reply.includes("*"))) {
            const verdict = gradeReply(answer, line.answers).verdict;
            if (verdict !== "correct") problems.push(`${dialogue.id} line ${index}: "${answer}" → ${verdict}`);
          }
        });
      }
    }
    assert.deepEqual(problems, []);
  });
}

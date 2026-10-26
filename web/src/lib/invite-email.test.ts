import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildInviteEmail, joinList, registerUrl } from "./invite-email";

const BASE = {
  inviterName: "Theo",
  code: "K7M2-9QRT-4WXZ",
  origin: "https://langue.example.com",
  expiresAt: null,
  languages: ["French", "Italian", "Portuguese", "Spanish"],
  remainingUses: 1,
};

describe("registerUrl", () => {
  test("points at the register page with the code prefilled", () => {
    assert.equal(
      registerUrl("https://langue.example.com/", "K7M2-9QRT-4WXZ"),
      "https://langue.example.com/register?code=K7M2-9QRT-4WXZ",
    );
  });
});

describe("joinList", () => {
  test("reads naturally for any length", () => {
    assert.equal(joinList([]), "");
    assert.equal(joinList(["Italian"]), "Italian");
    assert.equal(joinList(["French", "Italian"]), "French and Italian");
    assert.equal(joinList(["French", "Italian", "Spanish"]), "French, Italian and Spanish");
  });
});

describe("buildInviteEmail", () => {
  test("includes the link, the code, the languages and the inviter", () => {
    const email = buildInviteEmail(BASE);

    assert.match(email.body, /https:\/\/langue\.example\.com\/register\?code=K7M2-9QRT-4WXZ/);
    assert.match(email.body, /invite code is K7M2-9QRT-4WXZ/);
    assert.match(email.body, /It teaches French, Italian, Portuguese and Spanish\./);
    assert.match(email.body, /take your first step/);
    assert.ok(email.body.trimEnd().endsWith("Theo"));
  });

  test("is the approved draft, word for word (firm/marketing/drafts/invite-message.md, #72)", () => {
    const email = buildInviteEmail({ ...BASE, expiresAt: "2026-10-27T09:00:00.000Z", remainingUses: 6 });
    assert.equal(email.subject, "Join me on Langue");
    assert.equal(
      email.body,
      [
        "Hi!",
        "",
        "I've been learning with Langue, a small language app for family and friends. It teaches French, Italian, Portuguese and Spanish.",
        "",
        "What it's like:",
        "- Short steps, planned for about three minutes each. One button picks what's next: new words, reviews that are due, and the things you keep missing.",
        "- You type the answers yourself, and endings count: cansados for cansadas is marked wrong, not waved through as a typo, and so are some missing accents, like parle for parlé. Others, and small typos, are pointed out with the right spelling.",
        "- Little role-plays from the first unit, like greeting a new friend or a neighbour.",
        "- Beginner (A1) and Elementary (A2) are complete. If you already know some, you can test out of the early units.",
        "- No ads, nothing to pay, and your streak is never taken away.",
        "",
        "Here's your invite:",
        "https://langue.example.com/register?code=K7M2-9QRT-4WXZ",
        "",
        "Your invite code is K7M2-9QRT-4WXZ (the link fills it in for you). It expires on October 27, 2026. It works for 6 more people.",
        "",
        "Getting started:",
        "1. Open the link.",
        "2. Pick a name, your email and a password (at least 10 characters). Your name is what your group sees on the leaderboard.",
        "3. Choose your language and take your first step.",
        "",
        "On a phone, add Langue to your home screen and it works like an app.",
        "",
        "See you there,",
        "Theo",
      ].join("\n"),
    );
  });

  test("first contact never promises an AI tutor: not the email, not the front page", () => {
    const email = buildInviteEmail(BASE);
    assert.doesNotMatch(email.text, /AI tutor/i);
    const frontPage = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    assert.doesNotMatch(frontPage, /AI tutor|AI language practice|talk with a tutor/i);
    assert.match(frontPage, /A language course in short daily steps, where you type the answers\s+yourself\./);
    assert.match(frontPage, /No AI in the daily steps\./);
    // After #120: a missing accent that makes another word is marked wrong (marketing's wording, PR #130).
    assert.match(frontPage, /So are some\s+missing accents,\s+like <em>parle<\/em> for <em>parlé<\/em>\.\s+Others \(<em>cafe<\/em> for <em>café<\/em>\),\s+and\s+small\s+typos/);
    assert.match(frontPage, />Langue is invite-only\.</);
  });

  test("text is the subject line followed by the body", () => {
    const email = buildInviteEmail(BASE);
    assert.equal(email.text, `Subject: ${email.subject}\n\n${email.body}`);
  });

  test("mentions expiry only when the code expires", () => {
    assert.doesNotMatch(buildInviteEmail(BASE).body, /expires/);
    assert.match(
      buildInviteEmail({ ...BASE, expiresAt: "2026-10-27T09:00:00.000Z" }).body,
      /expires on October 27, 2026/,
    );
  });

  test("mentions remaining uses only for codes that can be shared", () => {
    assert.doesNotMatch(buildInviteEmail(BASE).body, /more people/);
    assert.match(buildInviteEmail({ ...BASE, remainingUses: 6 }).body, /works for 6 more people/);
  });

  test("leaves out the language sentence when there are none", () => {
    const body = buildInviteEmail({ ...BASE, languages: [] }).body;
    assert.doesNotMatch(body, /teaches/);
    assert.match(body, /a small language app for family and friends\.\n/);
  });
});

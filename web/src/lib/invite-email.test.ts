import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
    assert.match(email.body, /French, Italian, Portuguese and Spanish/);
    assert.match(email.body, /start at A1/);
    assert.ok(email.body.trimEnd().endsWith("Theo"));
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
    assert.doesNotMatch(buildInviteEmail({ ...BASE, languages: [] }).body, /teaches/);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every admin page and admin action asks for a recent password confirmation
 * (#119): it goes through requireAdmin({ confirmed: true }) in lib/auth/admin.ts.
 * This lists every file that reads isAdmin or isOwner and fails on one that
 * doesn't, unless it is display-only: it shows an admin a link or a line and
 * grants nothing. Those are listed here, each with why.
 */
const DISPLAY_ONLY: Record<string, string> = {
  "app/learn/page.tsx": "shows an admin the 'Manage invite codes' and 'Usage' links; the pages behind them are guarded",
  "app/learn/leaderboard/page.tsx": "shows an admin with no group a link to the invites page, which is guarded",
  "app/learn/layout.tsx": "watches an admin leave the admin pages, to end the confirmation; grants nothing",
  "lib/auth/session.ts": "reads the flag from the database for every other check",
  "lib/auth/actions.ts": "makes the first account on a fresh deployment the admin",
  "lib/auth/admin.ts": "the guard itself",
};

/** Folders whose every page, route and action is an admin one. */
const ADMIN_FOLDERS = ["app/learn/admin", "app/learn/invites"];
/** The one admin page that must not need a confirmation: it's where you give one. */
const CONFIRM_PAGE = "app/learn/admin/confirm/page.tsx";

const SRC = join(process.cwd(), "src");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(SRC, path)] : [];
  });
}

const GUARD = /requireAdmin\(\{\s*confirmed:\s*true/;

/** What's wrong with one file's admin checks, if anything. */
export function problems(file: string, source: string): string[] {
  const found: string[] = [];
  const inAdminFolder = ADMIN_FOLDERS.some((folder) => file.startsWith(`${folder}/`));
  if (inAdminFolder && file !== CONFIRM_PAGE && /export default|export (async function|const) (GET|POST|PUT|PATCH|DELETE)/.test(source) && !GUARD.test(source)) {
    found.push(`${file}: an admin page or route without requireAdmin({ confirmed: true })`);
  }
  // Every server action in an admin file checks for itself: an action is a public endpoint.
  if (inAdminFolder) {
    for (const [index] of [...source.matchAll(/"use server"/g)].map((match) => [match.index!])) {
      const body = source.slice(index, source.indexOf("\n}\n", index) + 1 || undefined);
      if (!GUARD.test(body)) found.push(`${file}: a server action without requireAdmin({ confirmed: true })`);
    }
  }
  if (/\bis(Admin|Owner)\b/.test(source) && !GUARD.test(source) && !(file in DISPLAY_ONLY)) {
    found.push(`${file}: checks isAdmin/isOwner without requireAdmin; if it only shows a link, list it in DISPLAY_ONLY with why`);
  }
  return found;
}

test("every admin page and action asks for a recent password confirmation (#119)", () => {
  const found = sources(SRC).flatMap((file) => problems(file, readFileSync(join(SRC, file), "utf8")));
  assert.deepEqual(found, []);
});

test("every display-only check is still there and still display-only", () => {
  for (const file of Object.keys(DISPLAY_ONLY)) {
    const source = readFileSync(join(SRC, file), "utf8");
    assert.match(source, /\bis(Admin|Owner)\b/, `${file} no longer checks isAdmin: take it off DISPLAY_ONLY`);
  }
});

test("the guard test catches an unguarded admin page and an unguarded action", () => {
  const page = `export default async function Page() { const user = await verifySession(); if (!user.isAdmin) notFound(); }`;
  assert.equal(problems("app/learn/admin/learners/page.tsx", page).length, 2);
  const action = `async function act() {\n  "use server";\n  const user = await requireUser();\n}\nexport default async function Page() { await requireAdmin({ confirmed: true, returnTo: "/learn/invites" }); }\n`;
  assert.deepEqual(problems("app/learn/invites/page.tsx", action), ["app/learn/invites/page.tsx: a server action without requireAdmin({ confirmed: true })"]);
});

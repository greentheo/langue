import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INVENTORY } from "./privacy-inventory";

/** Every model in the Prisma schema, with its String and Json fields. */
function schemaModels(): Map<string, string[]> {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const models = new Map<string, string[]>();
  for (const [, name, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const text = [...body.matchAll(/^\s+(\w+)\s+(?:String|Json)\b/gm)].map(([, field]) => field);
    models.set(name, text);
  }
  return models;
}

test("every table is on the privacy page", () => {
  const listed = new Set(INVENTORY.map((entry) => entry.model));
  const missing = [...schemaModels().keys()].filter((model) => !listed.has(model));
  assert.deepEqual(missing, [], "add these models to lib/privacy-inventory.ts");
});

test("every text field says whose words it holds", () => {
  const models = schemaModels();
  const unlisted: string[] = [];
  for (const [model, fields] of models) {
    const entry = INVENTORY.find((candidate) => candidate.model === model);
    for (const field of fields) if (!entry?.fields[field]) unlisted.push(`${model}.${field}`);
  }
  assert.deepEqual(unlisted, [], "classify these fields in lib/privacy-inventory.ts: you, device or langue");
});

test("nothing on the page is out of date", () => {
  const models = schemaModels();
  const stale = INVENTORY.flatMap((entry) =>
    models.has(entry.model)
      ? Object.keys(entry.fields).filter((field) => !models.get(entry.model)!.includes(field)).map((field) => `${entry.model}.${field}`)
      : [entry.model],
  );
  assert.deepEqual(stale, []);
});

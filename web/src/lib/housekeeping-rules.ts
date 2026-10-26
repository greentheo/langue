/**
 * Running housekeeping rules (#109): each on its own, so one that fails never
 * stops the others, and each says in one log line what it did. Pure, so it is
 * tested without a database (lib/housekeeping.ts holds the rules themselves).
 */

export interface HousekeepingRule {
  /** Short, for the log: "old events". */
  name: string;
  /** Does the work and says what it did: "3 deleted". */
  run: (now: Date) => Promise<string>;
}

export async function runRules(
  rules: HousekeepingRule[],
  now: Date,
  log: (line: string) => void = console.log,
): Promise<void> {
  for (const rule of rules) {
    try {
      log(`[langue] housekeeping: ${rule.name}: ${await rule.run(now)}`);
    } catch (error) {
      log(`[langue] housekeeping: ${rule.name} failed: ${(error as Error).message}`);
    }
  }
}

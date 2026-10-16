/**
 * How the level page, home, the certificate and the step's end show counts:
 * "438 words learned · 20 on the way · 12 not met yet". No imports, so the
 * step runner (a client component) can use it too.
 */

/** "1 word", "438 words". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "438 words learned · 20 on the way · nothing new", "no words learned yet ·
 * 3 not met yet". Without a noun (a unit mixes words, phrases and ideas):
 * "12 learned · 5 on the way · 20 not met yet". On the way is shown only when
 * there is some, and only for what has it (role-plays are played or not).
 */
export function countLine(
  { done, onTheWay, notMet }: { done: number; onTheWay?: number; notMet: number },
  one: string,
  many: string,
  verb: string,
  left: string,
  noneLeft: string,
): string {
  const doneText =
    done === 0 ? (many ? `no ${many} ${verb} yet` : `nothing ${verb} yet`) : `${many ? plural(done, one, many) : done} ${verb}`;
  // Each part stays on one line, and the dot with what comes before it: a narrow
  // screen wraps after a "·", never inside "24 not met yet" or before a "·".
  return [doneText, onTheWay ? `${onTheWay} on the way` : null, notMet === 0 ? noneLeft : `${notMet} ${left}`]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replaceAll(" ", "\u00a0"))
    .join("\u00a0· ");
}

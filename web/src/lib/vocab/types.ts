/** One vocabulary entry, matching the JSON schema the Python CLI writes. */
export interface VocabWord {
  word: string;
  translations: string[];
  examples: string[];
  category: string;
  difficulty: number;
}

/** CEFR levels, ordered from beginner to mastery. */
export const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;

export type Level = (typeof LEVELS)[number];

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

/** Human-readable CEFR labels, shared by the UI and the model prompts. */
export const LEVEL_LABELS: Record<Level, string> = {
  a1: "Beginner",
  a2: "Elementary",
  b1: "Intermediate",
  b2: "Upper intermediate",
  c1: "Advanced",
  c2: "Mastery",
};

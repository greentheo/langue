/**
 * "What do you want to learn?" — one big button per language. Used on the
 * home page before a new learner's first step, and on /learn/language.
 */

import { chooseLanguage } from "@/lib/settings-actions";
import { availableLanguages, languageLabel } from "@/lib/vocab";
import { getCourse } from "@/lib/path/course";

export function LanguageChooser({ current }: { current: string }) {
  // Languages with a guided path first.
  const languages = availableLanguages().sort(
    (a, b) => Number(getCourse(b).units.length > 0) - Number(getCourse(a).units.length > 0),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {languages.map((language) => {
        const selected = language === current;
        return (
          <form key={language} action={chooseLanguage}>
            <input type="hidden" name="language" value={language} />
            <button
              type="submit"
              aria-pressed={selected}
              className={`w-full border px-4 py-3 text-left text-lg normal-case tracking-normal hover:bg-[var(--crt-selection)] ${
                selected
                  ? "border-[var(--crt-accent)] text-[var(--crt-fg-bright)]"
                  : "border-[var(--crt-rule)] text-[var(--crt-fg)]"
              }`}
            >
              {selected ? "✓ " : ""}
              {languageLabel(language)}
              {language === "portuguese" ? (
                <span className="ml-2 text-sm text-[var(--crt-fg-dim)]">(Brazil)</span>
              ) : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}

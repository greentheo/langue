/**
 * Per-language settings the browser needs: which speech-synthesis voice to ask
 * for, and which accented letters to offer on the on-screen accent bar.
 *
 * Client-safe on purpose (no vocabulary or curriculum imports), so components
 * can use it without pulling the catalogs into the bundle.
 */

export interface LanguageSettings {
  /** BCP 47 tag for speech synthesis. */
  speechLang: string;
  /** Letters that are awkward to type on an English keyboard. */
  accents: string[];
}

const SETTINGS: Record<string, LanguageSettings> = {
  italian: { speechLang: "it-IT", accents: ["à", "è", "é", "ì", "ò", "ù"] },
  spanish: { speechLang: "es-ES", accents: ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"] },
  french: {
    speechLang: "fr-FR",
    accents: ["à", "â", "ç", "é", "è", "ê", "ë", "î", "ï", "ô", "ù", "û", "œ"],
  },
  // The vocabulary and lessons are Brazilian Portuguese.
  portuguese: {
    speechLang: "pt-BR",
    accents: ["á", "â", "ã", "à", "ç", "é", "ê", "í", "ó", "ô", "õ", "ú"],
  },
};

/** Display name for a language directory ("italian" -> "Italian"). */
export function languageLabel(language: string): string {
  return language.charAt(0).toUpperCase() + language.slice(1);
}

export function languageSettings(language: string): LanguageSettings {
  return SETTINGS[language.toLowerCase()] ?? { speechLang: "en-US", accents: [] };
}

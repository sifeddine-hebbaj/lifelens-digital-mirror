export const voiceLanguages = ["darija", "fr", "en"] as const;
export type VoiceLanguage = (typeof voiceLanguages)[number];
export const defaultVoiceLanguage: VoiceLanguage = "darija";

// Fixed BCP-47 codes: speech recognition is always pinned, never auto-detected.
export const voiceLanguageCodes: Record<VoiceLanguage, string> = { darija: "ar-MA", fr: "fr-FR", en: "en-US" };

const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
export const hasArabicScript = (text: string) => arabicScript.test(text);

export function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return typeof value === "string" && (voiceLanguages as readonly string[]).includes(value);
}

export function voiceLanguageRules(language: VoiceLanguage) {
  if (language === "darija") {
    return `LANGUAGE LOCK (Moroccan Darija) — this overrides every other language rule. The user ALWAYS speaks Moroccan Darija (the Moroccan Arabic dialect), often mixed with French words. Never detect, guess or switch to another language. Any sound, word or phrase that resembles Spanish, Chinese, Hindi, Portuguese, Italian, Turkish, English or any other language is a mis-hearing of Darija (or a French loanword used in Darija) and MUST be interpreted as Darija. Never mention or reply in the language you think you heard. Reply ONLY in natural Moroccan Darija; any written text must use Arabic script (common French words may stay as Moroccans say them). If you truly cannot understand, ask the user to repeat — in Darija. The language is locked for the whole conversation and never changes.`;
  }
  const name = language === "fr" ? "French" : "English";
  return `LANGUAGE LOCK (${name}) — this overrides every other language rule. The user speaks ${name}. Interpret all speech as ${name} and reply ONLY in ${name}. The language is locked for the whole conversation and never changes.`;
}

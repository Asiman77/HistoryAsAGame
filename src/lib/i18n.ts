import { DEFAULT_LOCALE, LOCALES, type Locale, type LocalizedText } from "@/domain/schema";
import az from "@locales/az.json";

export type Messages = typeof az;

const messages: Record<Locale, Partial<Messages>> = { az, en: {}, ru: {} };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Picks the requested locale, falling back to Azerbaijani. */
export function t(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text[DEFAULT_LOCALE];
}

export function getMessages(locale: Locale): Messages {
  return { ...az, ...messages[locale] } as Messages;
}

/** Replaces {name} placeholders. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

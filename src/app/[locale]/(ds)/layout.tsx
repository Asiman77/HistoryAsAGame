import type { Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Providers } from "@/components/layout/Providers";
import { ThemeRoot } from "@/components/layout/ThemeRoot";
import { ThemeStyles } from "@/components/layout/ThemeStyles";
import { getRepository } from "@/data";
import { tokensForTheme } from "@/theme/resolve";
import { BASE_THEME_TOKENS } from "@/theme/tokens";

export const viewport: Viewport = { themeColor: BASE_THEME_TOKENS["bg-base"] };

/** Message namespaces the client components of the new design read. */
const CLIENT_NAMESPACES = ["ui", "claims", "site", "home", "collections", "pages", "onThisDay", "shell"] as const;

/**
 * Root of the new design (ADR-0022): messages, client providers, the
 * [data-theme] blocks of every period theme and the themed design root. One
 * ThemeRoot for all new pages, so moving between them crossfades the period.
 */
export default async function DesignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [messages, themes] = await Promise.all([getMessages(), getRepository().listThemes()]);
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, messages[ns]]));
  const tokens = Object.fromEntries(Object.values(themes).map((th) => [th.id, tokensForTheme(th.id, undefined, th.palette.primary)]));
  return (
    <NextIntlClientProvider locale={locale} messages={clientMessages}>
      <ThemeStyles themes={tokens} />
      <Providers>
        <ThemeRoot>{children}</ThemeRoot>
      </Providers>
    </NextIntlClientProvider>
  );
}

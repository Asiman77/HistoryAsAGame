import type { Metadata } from "next";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { CategoryIndex } from "@/features/landing/CategoryIndex";
import { getMessages, t } from "@/lib/i18n";
import { sharedTheme } from "@/lib/theme";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const m = getMessages((await params).locale as Locale);
  return { title: m.categories.conflicts.title };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const repo = getRepository();
  const [conflicts, planned, eras, themes] = await Promise.all([repo.listConflicts(), repo.listPlanned(), repo.listEras(), repo.listThemes()]);
  const items = conflicts.map((c) => ({ id: c.id, title: t(c.name, locale), description: t(c.description, locale), years: t(c.heading, locale) }));
  return (
    <CategoryIndex
      category="conflicts"
      items={items}
      planned={planned.filter((p) => p.type === "conflict")}
      locale={locale}
      messages={getMessages(locale)}
      theme={sharedTheme(themes, eras, conflicts)}
    />
  );
}

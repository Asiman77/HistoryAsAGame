import type { Metadata } from "next";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { CategoryIndex } from "@/features/landing/CategoryIndex";
import { getMessages, t } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const m = getMessages((await params).locale as Locale);
  return { title: m.categories.states.title };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const repo = getRepository();
  const [states, planned] = await Promise.all([repo.listStates(), repo.listPlanned()]);
  const items = states.map((s) => ({ id: s.id, title: t(s.name, locale), description: t(s.description, locale), years: s.years }));
  return (
    <CategoryIndex
      category="states"
      items={items}
      planned={planned.filter((p) => p.type === "state")}
      locale={locale}
      messages={getMessages(locale)}
    />
  );
}

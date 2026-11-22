import type { Metadata } from "next";
import { getRepository } from "@/data";
import { loadCompareData } from "@/data/compare";
import type { Locale } from "@/domain/schema";
import { ComparePageClient } from "@/features/compare/ComparePageClient";
import { getMessages } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const m = getMessages((await params).locale as Locale);
  return { title: m.compare.title, description: m.compare.lead };
}

/** Two simulations side by side: /compare/?a=person:uzun-hasan&b=person:shah-ismayil. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const data = await loadCompareData(getRepository());
  return <ComparePageClient data={data} locale={locale} messages={getMessages(locale)} />;
}

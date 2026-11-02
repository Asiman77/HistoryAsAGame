import type { Metadata } from "next";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { CategoryIndex } from "@/features/landing/CategoryIndex";
import { getMessages } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const m = getMessages((await params).locale as Locale);
  return { title: m.categories.conflicts.title };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const planned = (await getRepository().listPlanned()).filter((p) => p.type === "conflict");
  return <CategoryIndex category="conflicts" items={[]} planned={planned} locale={locale} messages={getMessages(locale)} />;
}

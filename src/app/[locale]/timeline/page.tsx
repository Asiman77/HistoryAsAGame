import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/data";
import { loadTimeExplorerData } from "@/data/timeExplorer";
import type { Locale } from "@/domain/schema";
import { SettingsButton } from "@/features/settings/SettingsPanel";
import { TimelinePageClient } from "@/features/timeline/TimelinePageClient";
import { getMessages } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getMessages((await params).locale as Locale).timeline.title };
}

/** Global time slider, 1400–2020. The year can be shared as ?year=1514. */
export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const m = getMessages(locale);
  const data = await loadTimeExplorerData(getRepository());
  return (
    <main className="relative mx-auto min-h-full max-w-7xl px-3 pb-12 sm:px-6">
      <nav className="flex items-center justify-between gap-2 py-3 sm:py-5">
        <Link href={`/${locale}/`} className="paper-card rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
          ← {m.categories.home}
        </Link>
        <div className="paper-card rounded-lg p-1">
          <SettingsButton m={m} />
        </div>
      </nav>
      <header className="mb-4">
        <p className="text-xs font-semibold tracking-[0.25em] text-ink-faint uppercase">{m.timeline.kicker}</p>
        <h1 className="font-display text-4xl font-semibold text-ink">{m.timeline.title}</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">{m.timeline.lead}</p>
      </header>
      <TimelinePageClient data={data} locale={locale} messages={m} />
    </main>
  );
}

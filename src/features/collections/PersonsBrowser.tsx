"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PeriodTheme } from "@/components/layout/PeriodTheme";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { PersonCard } from "./cards";
import type { PersonCardData } from "./data";

export interface EraFilter {
  id: string;
  name: string;
  themeId: string;
  /** Persons whose eras include this one. */
  personIds: string[];
}

const ALL = "all";

/**
 * Person cards with the era filter of the legacy list (kept, ADR-0022 Q6):
 * picking an era narrows the cards and puts the page into that period's
 * theme. The choice lives in the URL (?dovr=), so a shared link opens it.
 */
export function PersonsBrowser({ cards, eras }: { cards: PersonCardData[]; eras: EraFilter[] }) {
  const t = useTranslations("collections.persons");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("dovr");
  const era = eras.find((e) => e.id === requested) ?? null;
  const shown = useMemo(() => (era ? cards.filter((c) => era.personIds.includes(c.id)) : cards), [cards, era]);

  const choose = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id === ALL) next.delete("dovr");
    else next.set("dovr", id);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-8">
      <PeriodTheme id={era?.themeId} />
      {eras.length > 1 ? (
        <SegmentedControl
          label={t("filter")}
          value={era?.id ?? ALL}
          onChange={choose}
          options={[{ value: ALL, label: t("allEras") }, ...eras.map((e) => ({ value: e.id, label: e.name }))]}
          className="max-w-full flex-wrap self-start rounded-panel sm:rounded-full"
        />
      ) : null}
      <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {shown.map((card) => (
          <li key={card.id}>
            <PersonCard card={card} />
          </li>
        ))}
      </ul>
    </div>
  );
}

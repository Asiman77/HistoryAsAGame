"use client";

import Link from "next/link";
import type { Locale } from "@/domain/schema";
import type { ResolvedRef } from "@/domain/registry";
import { withBasePath } from "@/lib/basePath";
import { format, t, type Messages } from "@/lib/i18n";
import { pushReturn } from "./navStack";

interface Props {
  refs: ResolvedRef[];
  locale: Locale;
  m: Messages;
  /** Where "back" should return to from the linked simulation. */
  here: { href: string; label: string };
  onPlace?: (placeId: string) => void;
}

/**
 * Cross-links of a step. A ref with a note gets a card ("Tarixi kəsişmə"),
 * the rest become chips. Targets that do not exist yet stay visible but
 * passive ("tezliklə"), and turn into links once their data is added.
 */
export function RelatedLinks({ refs, locale, m, here, onPlace }: Props) {
  if (refs.length === 0) return null;
  const cards = refs.filter((r) => r.note);
  const chips = refs.filter((r) => !r.note);
  const follow = (r: ResolvedRef) => () =>
    r.href && pushReturn({ href: here.href, label: here.label, target: r.href.split("?")[0]! });

  return (
    <section className="flex flex-col gap-3" aria-label={m.related.title}>
      {cards.map((r) => (
        <div key={`${r.type}:${r.id}:${r.stepTitle?.az ?? ""}`} className="flex items-start gap-3 rounded-md border border-gold/50 bg-gold/10 p-3">
          {r.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(r.image.src)} alt="" className="size-12 shrink-0 rounded-full border-2 border-gold object-cover object-top" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-[#7a5a17] uppercase">
              {m.relations.title} · {m.related.types[r.type]}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-ink">{t(r.note!, locale)}</p>
            {r.href ? (
              <Link
                href={`/${locale}${r.href}`}
                onClick={follow(r)}
                className="mt-1.5 inline-block text-sm font-medium text-lapis underline decoration-lapis/30 underline-offset-2 hover:decoration-lapis"
              >
                {r.stepTitle
                  ? format(m.relations.goto, { name: t(r.title, locale), title: t(r.stepTitle, locale), year: r.stepYear ?? "" })
                  : `${t(r.title, locale)} →`}
              </Link>
            ) : (
              <p className="mt-1.5 text-sm text-ink-faint">
                {t(r.title, locale)} · <span className="italic">{m.related.soon}</span>
              </p>
            )}
          </div>
        </div>
      ))}
      {chips.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink uppercase">{m.related.title}</p>
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((r) => (
              <li key={`${r.type}:${r.id}`}>
                {r.href ? (
                  <Link
                    href={`/${locale}${r.href}`}
                    onClick={follow(r)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-lapis/40 bg-lapis/5 px-2.5 py-1 text-xs font-medium text-lapis hover:bg-lapis/10"
                  >
                    <TypeDot type={r.type} /> {t(r.title, locale)} →
                  </Link>
                ) : r.type === "place" && r.exists && onPlace ? (
                  <button
                    type="button"
                    onClick={() => onPlace(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/25 px-2.5 py-1 text-xs text-ink hover:border-ink"
                  >
                    <TypeDot type={r.type} /> {t(r.title, locale)}
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/25 px-2.5 py-1 text-xs text-ink-faint"
                    title={m.related.soonHelp}
                    data-passive="true"
                  >
                    <TypeDot type={r.type} /> {t(r.title, locale)} · {m.related.soon}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const DOT: Record<ResolvedRef["type"], string> = {
  person: "#9b2c2c",
  conflict: "#2d5486",
  battle: "#5a4630",
  state: "#7a5a17",
  place: "#2f7f7a",
  ruler: "#6b3a7a",
};

function TypeDot({ type }: { type: ResolvedRef["type"] }) {
  return <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: DOT[type] }} />;
}

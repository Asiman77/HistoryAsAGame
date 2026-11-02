"use client";

import { useState } from "react";
import type { Claim, ClaimType, Locale, Source } from "@/domain/schema";
import { CLAIM_STYLE } from "@/lib/claims";
import { format, t, type Messages } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ClaimBadge } from "./ClaimBadge";

function SourceLine({ s }: { s: Source }) {
  return (
    <>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer" className="text-lapis underline decoration-lapis/30 underline-offset-2 hover:decoration-lapis">
          {s.title}
        </a>
      ) : (
        <span className="italic">{s.title}</span>
      )}
      {s.author && <span>, {s.author}</span>}
      {s.note && <span className="text-ink-faint"> ({s.note})</span>}
    </>
  );
}

/**
 * "Fakt və rəvayət": every classified statement of a step with its badge,
 * competing versions, where a legend was first written down and the sources.
 * Legends collapse when the reader turned them off in the settings.
 */
export function ClaimList({ claims, locale, m }: { claims: Claim[]; locale: Locale; m: Messages }) {
  const { showLegends } = useSettings();
  const [revealed, setRevealed] = useState(false);
  if (!claims.length) return null;
  const hidden = !showLegends && !revealed ? claims.filter((c) => c.claimType === "legend") : [];
  const shown = claims.filter((c) => !hidden.includes(c));

  return (
    <section className="flex flex-col gap-2.5" data-testid="claim-list" aria-label={m.claims.title}>
      <p className="text-xs font-semibold tracking-wide text-ink uppercase">{m.claims.title}</p>
      <ul className="flex flex-col gap-2.5">
        {shown.map((c) => (
          <li key={c.id} className="rounded-md border-l-4 bg-parchment/60 p-3" style={{ borderColor: CLAIM_STYLE[c.claimType].border }} data-claim-id={c.id}>
            <ClaimBadge type={c.claimType} why={c.why} locale={locale} m={m} size="xs" />
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{t(c.text, locale)}</p>
            {c.why && <p className="mt-1 text-xs text-ink-soft">{t(c.why, locale)}</p>}
            {!!c.versions?.length && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">{m.claims.versions}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-ink-soft marker:text-ink-faint">
                  {c.versions.map((v, i) => (
                    <li key={i}>
                      {t(v.text, locale)}{" "}
                      <span className="text-ink-faint">
                        (
                        {v.sources.map((s, j) => (
                          <span key={j}>
                            {j > 0 && "; "}
                            <SourceLine s={s} />
                          </span>
                        ))}
                        )
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {c.firstRecorded && (
              <p className="mt-2 text-xs text-ink-soft">
                <span className="font-semibold">{m.claims.firstRecorded}:</span> <SourceLine s={c.firstRecorded.source} />
                {c.firstRecorded.year && <span> ({c.firstRecorded.year})</span>}
                {c.firstRecorded.note && <span className="block text-ink-faint">{t(c.firstRecorded.note, locale)}</span>}
              </p>
            )}
            {c.sources.length > 0 && (
              <p className="mt-1.5 text-[11px] text-ink-faint">
                {m.claims.sources}:{" "}
                {c.sources.map((s, j) => (
                  <span key={j}>
                    {j > 0 && "; "}
                    <SourceLine s={s} />
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="self-start rounded-full border px-3 py-1 text-xs font-medium"
          style={{ color: CLAIM_STYLE.legend.fg, borderColor: CLAIM_STYLE.legend.border }}
          data-testid="show-hidden-legends"
        >
          {format(m.claims.hiddenLegends, { n: hidden.length })} · {m.claims.show}
        </button>
      )}
    </section>
  );
}

/** Banner for a step that as a whole rests on a legend or is disputed; a legend can be folded away. */
export function StepClaimNotice({
  type,
  locale,
  m,
  children,
}: {
  type: ClaimType;
  locale: Locale;
  m: Messages;
  children?: React.ReactNode;
}) {
  const { showLegends } = useSettings();
  const [revealed, setRevealed] = useState(false);
  if (type === "fact" || type === "literary") return <>{children}</>;
  const c = CLAIM_STYLE[type];
  const folded = type === "legend" && !showLegends && !revealed;
  return (
    <>
      <div className="flex items-start gap-2 rounded-md border p-3 text-sm" style={{ color: c.fg, background: c.bg, borderColor: c.border }} data-testid="step-claim-notice">
        <ClaimBadge type={type} locale={locale} m={m} size="xs" />
        <p className="flex-1 leading-snug">{folded ? m.claims.legendHiddenStep : type === "legend" ? m.claims.legendStep : m.claims.disputedStep}</p>
        {folded && (
          <button type="button" onClick={() => setRevealed(true)} className="shrink-0 font-semibold underline underline-offset-2">
            {m.claims.show}
          </button>
        )}
      </div>
      {!folded && children}
    </>
  );
}

export type { ClaimType };

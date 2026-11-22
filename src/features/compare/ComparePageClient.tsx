"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import type { Locale } from "@/domain/schema";
import type { CompareData, CompareOwner } from "@/data/compare";
import { ownerKey, parseOwner } from "@/lib/compare";
import { format, type Messages } from "@/lib/i18n";
import { ComparePage } from "./ComparePage";

/** MVP pair (spec): the Ağqoyunlu ruler and the Safavid shah. */
export const DEFAULT_PAIR = ["person:uzun-hasan", "person:shah-ismayil"] as const;

interface Pick {
  a: CompareOwner;
  b: CompareOwner;
  notice: string | null;
}

/** Owners from ?a=&b=; anything unknown falls back to the default pair (or another owner) with a notice. */
export function resolvePair(owners: CompareOwner[], rawA: string | null, rawB: string | null, m: Messages): Pick {
  const find = (raw: string | null) => {
    const ref = parseOwner(raw);
    return ref ? (owners.find((o) => o.type === ref.type && o.id === ref.id) ?? null) : null;
  };
  const byKey = (key: string) => owners.find((o) => ownerKey(o.type, o.id) === key) ?? null;
  const notices: string[] = [];
  let a = find(rawA);
  if (rawA && !a) notices.push(format(m.compare.unknown, { value: rawA }));
  let b = find(rawB);
  if (rawB && !b) notices.push(format(m.compare.unknown, { value: rawB }));
  if (a && b && a === b) {
    notices.push(m.compare.same);
    b = null;
  }
  a ??= byKey(DEFAULT_PAIR[0]) ?? owners[0]!;
  // Without b: the default rival, else the first other person, else any other owner.
  b ??=
    [byKey(DEFAULT_PAIR[1]), byKey(DEFAULT_PAIR[0])].find((o) => o && o !== a) ??
    owners.find((o) => o !== a && o.type === a.type) ??
    owners.find((o) => o !== a)!;
  return { a, b, notice: notices.length ? notices.join(" ") : null };
}

function WithPair({ data, locale, messages }: { data: CompareData; locale: Locale; messages: Messages }) {
  const params = useSearchParams();
  // Only the first URL matters; then the page owns the pair and mirrors it into the URL.
  const [pick, setPick] = useState<Pick>(() => resolvePair(data.owners, params.get("a"), params.get("b"), messages));

  const update = useCallback(
    (a: CompareOwner, b: CompareOwner) => {
      setPick({ a, b, notice: a === b ? messages.compare.same : null });
      const url = new URL(window.location.href);
      url.searchParams.set("a", ownerKey(a.type, a.id));
      url.searchParams.set("b", ownerKey(b.type, b.id));
      window.history.replaceState(window.history.state, "", url);
    },
    [messages],
  );

  const onPick = (side: "a" | "b", key: string) => {
    const owner = data.owners.find((o) => ownerKey(o.type, o.id) === key);
    if (!owner) return;
    // Picking the other side's owner swaps them instead of comparing a simulation with itself.
    if (side === "a") update(owner, owner === pick.b ? pick.a : pick.b);
    else update(owner === pick.a ? pick.b : pick.a, owner);
  };

  return (
    <ComparePage
      data={data}
      a={pick.a}
      b={pick.b}
      notice={pick.notice}
      onPick={onPick}
      onSwap={() => update(pick.b, pick.a)}
      locale={locale}
      messages={messages}
    />
  );
}

export function ComparePageClient(props: { data: CompareData; locale: Locale; messages: Messages }) {
  return (
    // The static HTML cannot know ?a=&b=, so it shows a light placeholder until the browser reads them.
    <Suspense fallback={<div className="mx-auto mt-24 h-[60vh] max-w-6xl animate-pulse rounded-lg bg-ink/5" aria-busy="true" />}>
      <WithPair {...props} />
    </Suspense>
  );
}

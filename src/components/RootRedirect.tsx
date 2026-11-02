"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Static export has no server redirects; this replaces the URL on the client. */
export function RootRedirect({ to, keepQuery = false }: { to: string; keepQuery?: boolean }) {
  const router = useRouter();
  useEffect(() => router.replace(keepQuery ? `${to}${window.location.search}` : to), [router, to, keepQuery]);
  return (
    <main className="parchment grid min-h-full place-items-center">
      <Link href={to} className="font-display text-2xl underline">
        Tarixin İçində
      </Link>
    </main>
  );
}

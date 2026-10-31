"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RootRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return (
    <main className="parchment grid min-h-full place-items-center">
      <Link href={to} className="font-display text-2xl underline">
        Tarixin İçində
      </Link>
    </main>
  );
}

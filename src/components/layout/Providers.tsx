"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";

/**
 * Client providers of the new design. Content is built into the pages, so
 * queries are for runtime data only (territory files, teacher panel); public
 * content changes rarely, hence the long staleTime.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}

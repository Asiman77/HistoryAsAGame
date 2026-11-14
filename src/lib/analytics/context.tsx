"use client";

import { createContext, useContext } from "react";

/** Which simulation and step an event inside it belongs to (cross-links, quizzes, legends). */
export interface AnalyticsOwner {
  /** `person:shah-ismayil`, `conflict:…`, `state:…` */
  key: string;
  stepKey?: string;
}

const Context = createContext<AnalyticsOwner | null>(null);

export const AnalyticsOwnerProvider = Context.Provider;

export function useAnalyticsOwner(): AnalyticsOwner | null {
  return useContext(Context);
}

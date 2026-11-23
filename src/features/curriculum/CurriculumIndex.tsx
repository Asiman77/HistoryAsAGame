"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { prefs } from "@/stores/prefs";

/** /kurikulum/ opens the grade the viewer chose last (§4); without one the page shows the picker. */
export function OpenLastGrade() {
  const router = useRouter();
  useEffect(() => {
    const grade = prefs.get().lastGrade;
    if (grade) router.replace(ROUTES.grade(grade));
  }, [router]);
  return null;
}

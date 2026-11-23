import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link and hooks: hrefs are written without the locale ("/zaman/"). */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

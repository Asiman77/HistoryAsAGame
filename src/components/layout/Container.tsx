import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

/** Content column: 1280 px, 40 px sides (16–20 px on phones), §3.4. */
export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-content px-4 sm:px-5 md:px-10", className)} {...rest} />;
}

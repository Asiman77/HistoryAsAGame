import { cx } from "@/lib/cx";

/** Small uppercase label above a heading (§3.3: 12–13 px, 0.18–0.22em, accent). */
export function Eyebrow({ as: Tag = "p", className, children }: { as?: "p" | "span" | "div"; className?: string; children: React.ReactNode }) {
  return <Tag className={cx("m-0 text-13 font-medium uppercase tracking-eyebrow-wide text-eyebrow", className)}>{children}</Tag>;
}

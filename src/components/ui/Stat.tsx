import { cx } from "@/lib/cx";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}

/** Label + big serif number (§3.3: big numbers are always serif), e.g. "Mərhələlər 14". */
export function Stat({ label, value, suffix, size = "md", className }: StatProps) {
  return (
    <div className={cx("flex flex-col gap-1.5 rounded-panel border border-line bg-surface-raised/60 px-5 py-4", className)}>
      <span className="text-13 text-fg-secondary">{label}</span>
      <span className={cx("font-heading font-medium leading-none text-fg", size === "lg" ? "text-44" : "text-34")}>
        {value}
        {suffix ? <span className="ml-1.5 text-16 text-fg-muted">{suffix}</span> : null}
      </span>
    </div>
  );
}

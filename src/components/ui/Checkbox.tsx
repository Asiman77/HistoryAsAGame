import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";

/** Real checkbox with a real <label> (map layers). */
export function Checkbox({ label, className, id, ...rest }: Omit<ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className={cx("flex min-h-11 cursor-pointer items-center gap-3 text-15 text-fg", className)}>
      <input id={inputId} type="checkbox" className="size-4.5 cursor-pointer accent-accent" {...rest} />
      {label}
    </label>
  );
}

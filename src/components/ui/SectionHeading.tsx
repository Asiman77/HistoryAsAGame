import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { Eyebrow } from "./Eyebrow";

export interface SectionHeadingProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** "Hamısına bax →" style link on the right. */
  action?: { href: string; label: string };
  as?: "h1" | "h2" | "h3";
  className?: string;
  id?: string;
}

/** Eyebrow + serif heading + optional link, as at the top of each home page section. */
export function SectionHeading({ eyebrow, title, action, as: Tag = "h2", className, id }: SectionHeadingProps) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-3">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Tag id={id} className="m-0 font-heading text-34 font-medium text-fg sm:text-38">
          {title}
        </Tag>
      </div>
      {action ? (
        <Link href={action.href} className="text-14 font-medium text-accent hover:text-accent-hover">
          {action.label} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";

/** Title band of a collection or section page. */
export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <Container className="flex flex-col gap-4 pb-10 pt-14 md:pt-20">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="m-0 font-heading text-44 font-medium leading-tight text-fg md:text-60">{title}</h1>
        {children}
      </div>
      {lead ? <p className="m-0 max-w-2xl text-16 text-fg-secondary md:text-19">{lead}</p> : null}
    </Container>
  );
}

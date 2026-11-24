import { RootRedirect } from "@/components/RootRedirect";
import { getRepository } from "@/data";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getRepository().listPersons()).map((p) => ({ id: p.id }));
}

/** The person simulation moved to the new design (ADR-0022, phase 5): /persons/<id>/ → /sexsiyyetler/<id>/, ?step= kept. */
export default async function MovedPersonPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  return <RootRedirect to={`/${locale}/sexsiyyetler/${id}/`} keepQuery />;
}

import { getRepository } from "@/data";
import { RootRedirect } from "@/components/RootRedirect";

type Params = Promise<{ locale: string; id: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  const persons = await getRepository().listPersons();
  return persons.map((p) => ({ id: p.id }));
}

/** Old URL (/az/person/<id>/) kept for shared links; ?step= is carried over to the simulation. */
export default async function OldPersonPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  return <RootRedirect to={`/${locale}/sexsiyyetler/${id}/`} keepQuery />;
}

import { RootRedirect } from "@/components/RootRedirect";

/** The timeline moved to the new design (ADR-0022, phase 6): /timeline/ → /zaman/, ?year= kept. */
export default async function MovedTimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RootRedirect to={`/${locale}/zaman/`} keepQuery />;
}

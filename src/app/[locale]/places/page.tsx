import { RootRedirect } from "@/components/RootRedirect";

/** The list moved to the new design (ADR-0022): /places/ → /mekanlar/. */
export default async function Moved({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RootRedirect to={`/${locale}/mekanlar/`} />;
}

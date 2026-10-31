import { DEFAULT_LOCALE } from "@/domain/schema";
import { RootRedirect } from "@/components/RootRedirect";

/** Static export has no server redirects; send visitors to the default locale. */
export default function Home() {
  return <RootRedirect to={`/${DEFAULT_LOCALE}/`} />;
}

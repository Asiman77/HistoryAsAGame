import { getRepository } from "@/data";
import { sharedTheme } from "@/lib/theme";

/** Period theme a list page wears: the one its entities share, else the default. */
export async function listTheme(entities: { eraIds: string[]; themeId?: string }[]): Promise<string> {
  const repo = getRepository();
  const [themes, eras] = await Promise.all([repo.listThemes(), repo.listEras()]);
  return sharedTheme(themes, eras, entities).id;
}

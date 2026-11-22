import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ClaimBadge } from "@/components/claims/ClaimBadge";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { ComingSoon, EmptyState } from "./EmptyState";
import { Eyebrow } from "./Eyebrow";
import { Panel } from "./Panel";
import { SectionHeading } from "./SectionHeading";
import { Stat } from "./Stat";

const meta: Meta = { title: "Dizayn sistemi/Səthlər və nişanlar", id: "ds-surfaces" };
export default meta;

/** Placeholder texts only: stories never carry historical content (§0.5). */
export const Cards: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8">
      <SectionHeading eyebrow="I · Bölmə" title="Bölmə başlığı nümunəsi" action={{ href: "#", label: "Hamısına bax" }} />
      <div className="grid gap-5 md:grid-cols-3">
        {["turkman-tebriz", "sefevi", "efshar"].map((id, i) => (
          <ThemeScope key={id} themeId={id}>
            <Card tint interactive padding="lg" className="flex min-h-96 flex-col justify-end gap-3">
              <div className="absolute left-4 top-4 flex gap-2">
                <Badge>[Dövr · əsr]</Badge>
              </div>
              {i === 1 ? (
                <div className="absolute right-4 top-4">
                  <Badge variant="accent">Davam et · 7/14</Badge>
                </div>
              ) : null}
              <span className="text-13 text-fg-secondary">[illər]</span>
              <h3 className="m-0 font-heading text-30 font-medium">[Ad]</h3>
              <p className="m-0 text-14 text-fg-secondary">[Qısa təsvir datadan gəlir]</p>
              <span className="text-14 font-semibold text-accent">Həyatını yaşa →</span>
            </Card>
          </ThemeScope>
        ))}
      </div>
    </div>
  ),
};

export const Panels: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <Panel edge className="flex w-[420px] flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Eyebrow>Mərhələ 7 / 14 · [ad]</Eyebrow>
          <ClaimBadge type="fact" />
        </div>
        <h2 className="m-0 font-heading text-38 font-medium">[Mərhələ başlığı]</h2>
        <p className="m-0 font-heading text-19 italic text-fg">“[Hekayə rejimində birinci şəxs mətni]”</p>
        <p className="m-0 text-15 text-fg-secondary">[Mənbəyə əsaslanan qısa xülasə]</p>
        <div className="flex flex-wrap gap-2">
          <Chip href="#">[Əlaqəli şəxsiyyət]</Chip>
          <Chip>[Döyüş]</Chip>
        </div>
      </Panel>
      <div className="grid w-[360px] grid-cols-2 gap-3">
        <Stat label="Mərhələlər" value="14" />
        <Stat label="Döyüşlər" value="5" />
        <Stat label="Qət edilən yol" value="≈ 0" suffix="km" className="col-span-2" />
      </div>
    </div>
  ),
};

export const Labels: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <ClaimBadge type="fact" />
        <ClaimBadge type="disputed" />
        <ClaimBadge type="legend" />
        <ClaimBadge type="literary" />
        <ClaimBadge type="fact" explain={false} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Badge>Neytral</Badge>
        <Badge variant="accent">Davam et · 7/14</Badge>
        <Badge variant="outline">Kontur</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        <Chip href="#">Aktiv keçid</Chip>
        <Chip href="#" tone="accent">
          Vurğulu keçid
        </Chip>
        <Chip>Passiv keçid</Chip>
        <ComingSoon>Dövlət</ComingSoon>
      </div>
    </div>
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <EmptyState />
      <EmptyState title="Bu dövr üçün məzmun hazırlanır" description="Məzmun əlavə olunduqca burada avtomatik görünəcək." />
    </div>
  ),
};

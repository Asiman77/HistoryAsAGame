import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Logo } from "@/components/icons";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { AtmosphereBackground, type AtmosphereBackgroundProps } from "./AtmosphereBackground";

const meta: Meta<typeof AtmosphereBackground> = {
  title: "Dizayn sistemi/Atmosfer fonu",
  id: "ds-atmosphere",
  component: AtmosphereBackground,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof AtmosphereBackground>;

function Frame({ theme, children, ...props }: AtmosphereBackgroundProps & { theme?: string; children?: React.ReactNode }) {
  const body = (
    <section className="relative isolate -m-6 flex min-h-[640px] flex-col justify-center overflow-hidden px-10">
      <AtmosphereBackground {...props} />
      {children ?? (
        <div className="flex max-w-xl flex-col gap-5">
          <Logo className="text-accent" />
          <p className="m-0 text-13 uppercase tracking-eyebrow-wide text-eyebrow">Eyebrow nümunəsi</p>
          <h1 className="m-0 font-heading text-60 font-medium leading-none">
            Başlıq <em className="text-accent">nümunəsi</em>
          </h1>
        </div>
      )}
    </section>
  );
  return theme ? <ThemeScope themeId={theme}>{body}</ThemeScope> : body;
}

/** Home hero: gold light, girih, mountains, dust. */
export const Hero: Story = { render: () => <Frame silhouette="mountains" effects={["dust"]} glow={{ x: "70%", y: "18%", strength: 0.22 }} /> };

/** Place page: city skyline in the Safavid theme. */
export const City: Story = { render: () => <Frame theme="sefevi" silhouette="city" glow={{ x: "80%", y: "0%", tone: "secondary", strength: 0.35 }} pattern={0.06} /> };

/** War intro: night to dawn sky, stars, Şuşa cliffs (2020 theme). */
export const Dawn: Story = { render: () => <Frame theme="muasir-zefer" sky silhouette="cliffs" effects={["stars", "dawn"]} glow={false} pattern={false} /> };

/** Reduced motion / light mode: every layer static, no particles. */
export const Still: Story = { render: () => <Frame silhouette="mountains" effects={["dust", "stars"]} still /> };

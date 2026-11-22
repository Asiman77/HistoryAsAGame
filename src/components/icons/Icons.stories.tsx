import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BattleSwords, CapitalCrown, Carnation, City, Compass, EightPointStar, Fortress, Logo, Port, Shrine } from ".";

const meta: Meta = { title: "Dizayn sistemi/İkonlar", id: "ds-icons" };
export default meta;

const ICONS = { Logo, EightPointStar, CapitalCrown, BattleSwords, Shrine, Fortress, Port, City, Carnation, Compass };

export const Gallery: StoryObj = {
  render: () => (
    <div className="grid grid-cols-5 gap-6 text-accent">
      {Object.entries(ICONS).map(([name, Cmp]) => (
        <div key={name} className="flex flex-col items-center gap-2 rounded-panel border border-line p-4">
          <Cmp size={32} />
          <code className="text-12 text-fg-secondary">{name}</code>
        </div>
      ))}
    </div>
  ),
};

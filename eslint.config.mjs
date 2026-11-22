import next from "eslint-config-next";

/**
 * Components never write hex colours (FRONTEND_SPEC §3.1): they use the design
 * tokens (src/styles/tokens.css) through Tailwind names or var(--…).
 * Colour values live only in src/theme/ and src/styles/.
 */
const HEX = "#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\\b";
const noHex = {
  "no-restricted-syntax": [
    "error",
    { selector: `Literal[value=/${HEX}/]`, message: "Hex rəng yazma: dizayn tokenlərini işlət (bg-surface, text-fg, var(--accent)…)." },
    { selector: `TemplateElement[value.raw=/${HEX}/]`, message: "Hex rəng yazma: dizayn tokenlərini işlət (bg-surface, text-fg, var(--accent)…)." },
  ],
};

/**
 * Legacy parchment UI (ADR-0022), allowed until each file is replaced by the
 * new design. This list only shrinks; new files are never added to it.
 */
const LEGACY_WITH_HEX = [
  "src/app/layout.tsx",
  "src/features/compare/ComparePage.tsx",
  "src/features/conflicts/ConflictSimulation.tsx",
  "src/features/conflicts/Flag.tsx",
  "src/features/conflicts/liberation.ts",
  "src/features/engine/RelatedLinks.tsx",
  "src/features/engine/StartGate.tsx",
  "src/features/engine/Timeline.tsx",
  "src/features/home/OnThisDay.tsx",
  "src/features/landing/CategoryIndex.tsx",
  "src/features/landing/Hub.tsx",
  "src/features/landing/Landing.tsx",
  "src/features/legacy/LegacyPanel.tsx",
  "src/features/map/MapLegend.tsx",
  "src/features/map/MapStage.tsx",
  "src/features/map/PolityPanel.tsx",
  "src/features/map/battle.ts",
  "src/features/map/icons.ts",
  "src/features/map/style.ts",
  "src/features/map/territories.ts",
  "src/features/simulation/PortraitCard.tsx",
  "src/features/simulation/StoryContent.tsx",
  "src/features/states/DynastyStrip.tsx",
  "src/features/theme/KarabakhMountains.tsx",
  "src/features/theme/ornaments.tsx",
  "src/features/timeline/TimeExplorer.tsx",
];

const config = [
  ...next,
  { ignores: [".next/**", "out/**", "node_modules/**", "playwright-report/**", "public/vendor/**", "storybook-static/**"] },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    ignores: LEGACY_WITH_HEX,
    rules: noHex,
  },
];

export default config;

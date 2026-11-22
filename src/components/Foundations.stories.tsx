import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { contrast } from "@/theme/color";
import { FALLBACK_UI } from "@/theme/fallbacks";
import { fallbackThemeTokens } from "@/theme/resolve";
import { FONT_SIZES, STATIC_TOKENS, THEME_TOKENS } from "@/theme/tokens";

const meta: Meta = { title: "Dizayn sistemi/Əsaslar", id: "ds-foundations" };
export default meta;

const THEMES = fallbackThemeTokens();

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-14 w-28 rounded-button border border-fg/15" style={{ background: `var(--${name})` }} />
      <code className="text-12 text-fg-secondary">--{name}</code>
    </div>
  );
}

/** Colour tokens of the theme picked in the toolbar. */
export const Colours: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-heading text-26">Tema tokenləri</h2>
        <div className="flex flex-wrap gap-4">
          {THEME_TOKENS.map((t) => (
            <Swatch key={t} name={t} />
          ))}
          <Swatch name="border-subtle" />
          <Swatch name="border-strong" />
          <Swatch name="accent-hover" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 font-heading text-26">Sabit tokenlər</h2>
        <div className="flex flex-wrap gap-4">
          {Object.keys(STATIC_TOKENS).map((t) => (
            <Swatch key={t} name={t} />
          ))}
        </div>
      </section>
    </div>
  ),
};

/** §3.3 scale; big numbers are serif. */
export const Typography: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {[...FONT_SIZES].reverse().map((s) => (
          <div key={s} className="flex items-baseline gap-4">
            <code className="w-16 text-12 text-fg-muted">{s}px</code>
            <span className={s >= 22 ? "font-heading" : "font-ui"} style={{ fontSize: s, lineHeight: 1.15 }}>
              {s >= 22 ? "Əfsanə və həqiqət · ĞÜŞİÖÇ ğüşıöç" : "Mətn və interfeys: ə ğ ı İ ö ü ç ş"}
            </span>
          </div>
        ))}
      </div>
      <p className="m-0 font-heading text-60 font-medium italic text-accent">italik 500 · 1501</p>
    </div>
  ),
};

/** All period themes next to each other, with their measured text contrast. */
export const Themes: StoryObj = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(THEMES).map(([id, t]) => (
        <ThemeScope key={id} themeId={id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <p className="m-0 text-13 font-medium uppercase tracking-eyebrow-wide text-eyebrow">{id}</p>
          <p className="m-0 font-heading text-30 text-fg">Başlıq nümunəsi</p>
          <p className="m-0 text-15 text-fg-secondary">İkinci dərəcəli mətn</p>
          <p className="m-0 text-14 text-fg-muted">Solğun etiket</p>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accent px-3 py-1.5 text-13 font-semibold text-accent-ink">Vurğu</span>
            {/* Second and third colours tint surfaces; they are never a text background. */}
            <span className="flex items-center gap-1.5 text-13 text-fg-secondary">
              <span aria-hidden className="size-5 rounded-full bg-secondary" /> ikinci
            </span>
            <span className="flex items-center gap-1.5 text-13 text-fg-secondary">
              <span aria-hidden className="size-5 rounded-full bg-secondary-2" /> üçüncü
            </span>
          </div>
          <code className="text-12 text-fg-muted">
            mətn {contrast(t["text-primary"], t["bg-base"]).toFixed(1)} · solğun {contrast(t["text-muted"], t["bg-raised"]).toFixed(1)} · vurğu{" "}
            {contrast(t.accent, t["bg-base"]).toFixed(1)} · {FALLBACK_UI[id] ? "dizayn" : "törəmə"}
          </code>
        </ThemeScope>
      ))}
    </div>
  ),
};

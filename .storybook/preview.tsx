import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import messages from "../locales/az.json";
import { designFontVars } from "../src/styles/fonts";
import { fallbackThemeTokens, themeCss } from "../src/theme/resolve";
import "../src/app/globals.css";

const THEMES = fallbackThemeTokens();
const css = themeCss(THEMES);

/** Every story renders inside a themed design root with the Azerbaijani messages, like the pages do. */
const withTheme: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme as string | undefined) ?? "default";
  const lite = ctx.globals.lite === "on";
  return (
    <NextIntlClientProvider locale="az" messages={messages} timeZone="Asia/Baku">
      <style>{css}</style>
      <div data-theme={theme} className={`ds-root ${designFontVars} min-h-screen p-6 ${lite ? "lite" : ""}`}>
        <Story />
      </div>
    </NextIntlClientProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Dövr teması",
      toolbar: {
        title: "Tema",
        icon: "paintbrush",
        items: Object.keys(THEMES).map((id) => ({ value: id, title: id })),
        dynamicTitle: true,
      },
    },
    lite: {
      description: "Yüngül rejim",
      toolbar: { title: "Yüngül rejim", icon: "lightning", items: ["off", "on"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "default", lite: "off" },
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
  },
};

export default preview;

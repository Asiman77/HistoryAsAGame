import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@locales/az.json";

/** Renders with the Azerbaijani messages, as the pages do. */
export function renderAz(ui: React.ReactElement, options?: RenderOptions) {
  return render(
    <NextIntlClientProvider locale="az" messages={messages} timeZone="Asia/Baku">
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}

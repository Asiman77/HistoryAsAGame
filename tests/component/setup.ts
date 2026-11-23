import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type AnchorHTMLAttributes } from "react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// next/link and the next-intl Link need the App Router; components only need a real <a>.
const anchor = ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => createElement("a", { href, ...rest });
vi.mock("next/link", () => ({ default: anchor }));
vi.mock("@/i18n/navigation", () => ({
  Link: anchor,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

// jsdom has no matchMedia.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

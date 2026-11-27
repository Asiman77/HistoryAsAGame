import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Zustand stores keep the exact localStorage/sessionStorage format of
 * the stores they replaced, so legacy pages and returning visitors keep
 * their settings, progress and return path.
 */
describe("persisted stores (Zustand, raw format)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it("reads what the old store wrote and writes it back without a wrapper", async () => {
    localStorage.setItem("tarix:settings", JSON.stringify({ master: 0.3, muted: true, lightMode: true, teacherMode: false, showLegends: false }));
    const { settingsStore, updateSettings } = await import("@/lib/settings");
    expect(settingsStore.get()).toMatchObject({ master: 0.3, muted: true, lightMode: true, showLegends: false });
    updateSettings({ master: 0.8 });
    const raw = JSON.parse(localStorage.getItem("tarix:settings")!);
    expect(raw).not.toHaveProperty("state");
    expect(raw).not.toHaveProperty("version");
    expect(raw.master).toBe(0.8);
    expect(raw.channels.music).toEqual({ volume: 0.7, muted: false });
  });

  it("sanitises broken data instead of crashing", async () => {
    localStorage.setItem("tarix:progress", "{not json");
    const { progressStore } = await import("@/lib/progress");
    expect(progressStore.get()).toEqual({ persons: {}, collection: { cards: {}, quizBadges: {} }, quizzes: {} });
  });

  it("keeps working in memory when storage throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { prefs, setLastGrade } = await import("@/stores/prefs");
    setLastGrade(10);
    expect(prefs.get().lastGrade).toBe(10);
  });

  it("follows writes from other tabs", async () => {
    const { prefs } = await import("@/stores/prefs");
    localStorage.setItem("tarix:prefs", JSON.stringify({ lastGrade: 7 }));
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "tarix:prefs" }));
    });
    expect(prefs.get().lastGrade).toBe(7);
  });

  it("rejects grades outside 6–11", async () => {
    localStorage.setItem("tarix:prefs", JSON.stringify({ lastGrade: 12 }));
    const { prefs } = await import("@/stores/prefs");
    expect(prefs.get().lastGrade).toBeNull();
  });

  it("keeps the cross-link return stack per tab in its old format", async () => {
    const { pushReturn, peekReturn, popReturn } = await import("@/features/engine/navStack");
    pushReturn({ href: "/persons/a/?step=x", label: "A · X", target: "/persons/b/" });
    expect(JSON.parse(sessionStorage.getItem("tarix:navstack")!)).toEqual([{ href: "/persons/a/?step=x", label: "A · X", target: "/persons/b/" }]);
    expect(peekReturn("/persons/b/")?.label).toBe("A · X");
    expect(peekReturn("/persons/c/")).toBeNull();
    expect(popReturn()?.href).toBe("/persons/a/?step=x");
    expect(JSON.parse(sessionStorage.getItem("tarix:navstack")!)).toEqual([]);
  });

  it("renders the defaults on the server snapshot, then the stored value", async () => {
    localStorage.setItem("tarix:prefs", JSON.stringify({ lastGrade: 8 }));
    const { usePrefs } = await import("@/stores/prefs");
    function Grade() {
      return <span data-testid="g">{String(usePrefs((p) => p.lastGrade))}</span>;
    }
    render(<Grade />);
    expect(screen.getByTestId("g")).toHaveTextContent("8");
  });
});

describe("ThemeRoot", () => {
  beforeEach(() => vi.resetModules());

  it("wears the default theme, follows a page override and mirrors it on <html>", async () => {
    const { ThemeRoot } = await import("@/components/layout/ThemeRoot");
    const { PeriodTheme } = await import("@/components/layout/PeriodTheme");
    const { rerender, unmount } = render(
      <ThemeRoot>
        <p>x</p>
      </ThemeRoot>,
    );
    const root = screen.getByTestId("theme-root");
    expect(root).toHaveAttribute("data-theme", "default");
    expect(document.documentElement).toHaveClass("ds");
    rerender(
      <ThemeRoot>
        <PeriodTheme id="sefevi" />
      </ThemeRoot>,
    );
    expect(root).toHaveAttribute("data-theme", "sefevi");
    expect(document.documentElement.dataset.theme).toBe("sefevi");
    rerender(
      <ThemeRoot>
        <p>y</p>
      </ThemeRoot>,
    );
    expect(root).toHaveAttribute("data-theme", "default");
    unmount();
    expect(document.documentElement).not.toHaveClass("ds");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("turns light mode on from the settings", async () => {
    localStorage.setItem("tarix:settings", JSON.stringify({ lightMode: true }));
    const { ThemeRoot } = await import("@/components/layout/ThemeRoot");
    render(
      <ThemeRoot>
        <p>x</p>
      </ThemeRoot>,
    );
    expect(screen.getByTestId("theme-root")).toHaveClass("lite");
    expect(document.documentElement).toHaveClass("lite");
  });
});

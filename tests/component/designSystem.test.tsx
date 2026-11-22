import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AtmosphereBackground } from "@/components/atmosphere/AtmosphereBackground";
import { ClaimBadge } from "@/components/claims/ClaimBadge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ComingSoon, EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressRing, ProgressSegments } from "@/components/ui/Progress";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { renderAz } from "./render";

describe("ClaimBadge", () => {
  it("names the claim in words, not colour alone", () => {
    renderAz(<ClaimBadge type="legend" />);
    expect(screen.getByRole("button", { name: /Rəvayət/ })).toBeInTheDocument();
  });

  it("opens the explanation on click and closes it with Escape and outside clicks", async () => {
    const user = userEvent.setup();
    renderAz(
      <div>
        <ClaimBadge type="disputed" why="Mənbələr fərqli tarix verir." />
        <p>kənar</p>
      </div>,
    );
    const button = screen.getByRole("button", { name: /Mübahisəli/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent("Bu niyə mübahisəli sayılır?");
    expect(screen.getByRole("note")).toHaveTextContent("Mənbələr fərqli tarix verir.");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    await user.click(button);
    await user.click(screen.getByText("kənar"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("falls back to the general explanation of the type", async () => {
    const user = userEvent.setup();
    renderAz(<ClaimBadge type="fact" />);
    await user.click(screen.getByRole("button", { name: /Fakt/ }));
    expect(screen.getByRole("note")).toHaveTextContent("Mənbələrlə təsdiqlənib.");
  });

  it("can be a plain label", () => {
    renderAz(<ClaimBadge type="literary" explain={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Ədəbi")).toBeInTheDocument();
  });
});

describe("SegmentedControl", () => {
  function Modes({ onChange }: { onChange?: (v: string) => void }) {
    const [v, setV] = useState("story");
    return (
      <SegmentedControl
        label="Rejim"
        value={v}
        onChange={(next) => {
          setV(next);
          onChange?.(next);
        }}
        options={[
          { value: "story", label: "Hekayə" },
          { value: "soon", label: "Tezliklə", disabled: true },
          { value: "learn", label: "Öyrənmə" },
        ]}
      />
    );
  }

  it("is a radio group with only the selected option in the tab order", () => {
    renderAz(<Modes />);
    expect(screen.getByRole("radiogroup", { name: "Rejim" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Hekayə" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Öyrənmə" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves with the arrow keys and skips disabled options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderAz(<Modes onChange={onChange} />);
    screen.getByRole("radio", { name: "Hekayə" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("learn");
    expect(screen.getByRole("radio", { name: "Öyrənmə" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Öyrənmə" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Tezliklə" }));
    expect(onChange).not.toHaveBeenCalledWith("soon");
  });
});

describe("links and labels", () => {
  it("an active chip is a link, a passive one says 'tezliklə' and is not", () => {
    renderAz(
      <>
        <Chip href="/az/sexsiyyetler/x/">Aktiv</Chip>
        <Chip>Passiv</Chip>
      </>,
    );
    expect(screen.getByRole("link", { name: /Aktiv/ })).toHaveAttribute("href", "/az/sexsiyyetler/x/");
    expect(screen.getByText(/Passiv/).closest("a")).toBeNull();
    expect(screen.getByText("tezliklə")).toBeInTheDocument();
  });

  it("buttons are real buttons and icon buttons have a name", () => {
    renderAz(
      <>
        <Button>Başla</Button>
        <IconButton label="Səs" pressed={false}>
          <svg />
        </IconButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Başla" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Səs" })).toHaveAttribute("aria-pressed", "false");
  });

  it("empty states say the content is being prepared", () => {
    renderAz(
      <>
        <EmptyState />
        <ComingSoon>Dövlət</ComingSoon>
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Məlumat hazırlanır");
    expect(screen.getByText(/Dövlət/)).toHaveTextContent("Dövlət · tezliklə");
  });

  it("progress is announced as text", () => {
    renderAz(
      <>
        <ProgressRing value={0.333} />
        <ProgressSegments total={14} done={6} current={6} />
      </>,
    );
    expect(screen.getByRole("img", { name: "33% tamamlanıb" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "7 / 14" })).toBeInTheDocument();
  });
});

describe("AtmosphereBackground", () => {
  it("is decorative and draws the requested layers", () => {
    renderAz(<AtmosphereBackground silhouette="cliffs" effects={["stars", "dawn"]} still />);
    const bg = screen.getByTestId("atmosphere-background");
    expect(bg).toHaveAttribute("aria-hidden", "true");
    expect(bg.className).toContain("pointer-events-none");
    expect(screen.getByTestId("silhouette-cliffs")).toBeInTheDocument();
    expect(screen.getByTestId("effect-stars")).toBeInTheDocument();
    expect(screen.getByTestId("effect-dawn")).toBeInTheDocument();
  });

  it("stays still in light mode: no particles, no twinkling", () => {
    renderAz(
      <div className="lite">
        <AtmosphereBackground effects={["dust", "stars"]} />
      </div>,
    );
    expect(screen.getByTestId("atmosphere-background")).toHaveAttribute("data-still", "true");
    expect(screen.queryByTestId("effect-dust")).not.toBeInTheDocument();
    expect(screen.getByTestId("effect-stars").querySelector(".ds-animate-twinkle")).toBeNull();
  });

  it("moves when motion is allowed", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    act(() => {
      renderAz(<AtmosphereBackground effects={["dust", "stars"]} />);
    });
    expect(screen.getByTestId("atmosphere-background")).toHaveAttribute("data-still", "false");
    expect(screen.getByTestId("effect-dust")).toBeInTheDocument();
    getContext.mockRestore();
  });
});

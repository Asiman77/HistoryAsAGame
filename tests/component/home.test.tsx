import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnThisDayPanel, type OnThisDayEvent } from "@/features/home/OnThisDayPanel";
import { TimelinePreview } from "@/features/home/TimelinePreview";
import { renderAz } from "./render";

const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

/** Sample events (not historical content): only the dates matter here. */
const sample = (month: number, day: number | undefined, title: string): OnThisDayEvent => ({
  key: title,
  href: `/persons/x/?step=${title}`,
  title,
  entityTitle: "Nümunə",
  date: { year: 1500, month, day, certainty: "exact" },
  claimType: "fact",
});

const at = (mmdd: string) => window.history.replaceState(null, "", `/az/?today=${mmdd}`);

describe("OnThisDayPanel", () => {
  it("shows the events of the day first", () => {
    at("05-10");
    renderAz(<OnThisDayPanel events={[sample(5, 10, "a"), sample(5, 12, "b")]} specials={[]} months={months} />);
    const block = screen.getByTestId("on-this-day");
    expect(block).toHaveAttribute("data-mode", "day");
    expect(screen.getAllByTestId("otd-event")).toHaveLength(1);
    expect(block).toHaveTextContent("10 may");
  });

  it("falls back to the month", () => {
    at("05-11");
    renderAz(<OnThisDayPanel events={[sample(5, 10, "a"), sample(5, 12, "b")]} specials={[]} months={months} />);
    expect(screen.getByTestId("on-this-day")).toHaveAttribute("data-mode", "month");
    expect(screen.getAllByTestId("otd-event")).toHaveLength(2);
  });

  it("hides the block when the month has nothing either (§6.1)", () => {
    at("03-02");
    const { container } = renderAz(<OnThisDayPanel events={[sample(5, 10, "a")]} specials={[]} months={months} />);
    expect(screen.queryByTestId("on-this-day")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("gives a special day its own text even without events", () => {
    at("03-02");
    renderAz(
      <OnThisDayPanel
        events={[]}
        specials={[{ id: "sample-day", month: 3, day: 2, style: "memorial", title: "Nümunə gün", description: "Təsvir", ref: null }]}
        months={months}
      />,
    );
    expect(screen.getByTestId("on-this-day")).toHaveAttribute("data-special", "sample-day");
    expect(screen.getByTestId("special-day")).toHaveTextContent("Nümunə gün");
  });
});

describe("TimelinePreview", () => {
  const data = {
    from: 1400,
    to: 2020,
    eras: [{ name: "Nümunə dövr", color: "#2A4A8C", from: 1400, to: 1700 }, { name: null, color: null, from: 1701, to: 2020 }],
    reigns: [
      { polity: "A", ruler: "R1", color: "#111111", from: 1450, to: 1500 },
      { polity: "B", ruler: "R2", color: "#222222", from: 1490, to: 1520 },
    ],
  };

  it("follows the slider: year, rulers of that year and the timeline link", () => {
    renderAz(<TimelinePreview data={data} initialYear={1460} />);
    expect(screen.getByTestId("preview-year")).toHaveTextContent("1460");
    expect(screen.getByTestId("preview-rulers")).toHaveTextContent("A · R1");
    expect(screen.getByTestId("preview-rulers")).not.toHaveTextContent("B · R2");
    // jsdom does not move range inputs with the keyboard; the browser does (e2e).
    fireEvent.change(screen.getByRole("slider", { name: "İl seçimi" }), { target: { value: "1461" } });
    expect(screen.getByTestId("preview-year")).toHaveTextContent("1461");
    expect(screen.getByTestId("preview-open")).toHaveAttribute("href", "/zaman/?year=1461");
  });
});

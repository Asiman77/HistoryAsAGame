import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowLeft, Volume2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "./Button";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { ProgressBar, ProgressRing, ProgressSegments } from "./Progress";
import { SegmentedControl } from "./SegmentedControl";

const meta: Meta = { title: "Dizayn sistemi/İdarəetmə", id: "ds-controls" };
export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button shape="pill" size="lg">
          Səyahətə başla <span aria-hidden>→</span>
        </Button>
        <Button variant="secondary" shape="pill" size="lg">
          Necə işləyir?
        </Button>
        <Button variant="outline" shape="pill">
          Müəllim rejimi
        </Button>
        <Button variant="ghost">Hamısına bax →</Button>
        <Button disabled>Passiv</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="lg" className="min-w-40">
          ← Əvvəlki
        </Button>
        <Button size="lg" className="min-w-52">
          Növbəti →
        </Button>
        <ButtonLink href="#" variant="outline">
          Keçid düymə kimi
        </ButtonLink>
      </div>
      <div className="flex gap-3">
        <IconButton label="Geri">
          <ArrowLeft size={18} />
        </IconButton>
        <IconButton label="Səs" pressed>
          <Volume2 size={18} />
        </IconButton>
      </div>
    </div>
  ),
};

function Segments() {
  const [mode, setMode] = useState<"story" | "learn">("story");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState<"az" | "world">("az");
  return (
    <div className="flex flex-col items-start gap-6">
      <SegmentedControl
        label="Rejim"
        value={mode}
        onChange={setMode}
        options={[
          { value: "story", label: "Hekayə" },
          { value: "learn", label: "Öyrənmə" },
        ]}
      />
      <SegmentedControl
        label="Fənn"
        value={subject}
        onChange={setSubject}
        options={[
          { value: "az", label: "Azərbaycan tarixi" },
          { value: "world", label: "Ümumi tarix · tezliklə", disabled: true },
        ]}
      />
      <SegmentedControl label="Sinif" variant="tile" value={grade} onChange={setGrade} options={["6", "7", "8", "9", "10", "11"].map((g) => ({ value: g, label: g }))} />
    </div>
  );
}

export const SegmentedControls: StoryObj = { render: () => <Segments /> };

export const ProgressIndicators: StoryObj = {
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex gap-4">
        <ProgressRing value={0} />
        <ProgressRing value={0.33} />
        <ProgressRing value={1} />
      </div>
      <ProgressBar value={0.3} />
      <ProgressSegments total={14} done={7} current={7} />
    </div>
  ),
};

export const Checkboxes: StoryObj = {
  render: () => (
    <div className="flex w-64 flex-col">
      <Checkbox label="Sərhədlər" defaultChecked />
      <Checkbox label="Paytaxtlar" defaultChecked />
      <Checkbox label="Hadisələr" defaultChecked />
      <Checkbox label="Rəvayətlər" />
    </div>
  ),
};

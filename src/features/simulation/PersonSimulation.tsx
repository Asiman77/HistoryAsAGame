"use client";

import type { Locale } from "@/domain/schema";
import { SimulationEngine } from "@/features/engine/SimulationEngine";
import { LegacyPanel } from "@/features/legacy/LegacyPanel";
import { t, type Messages } from "@/lib/i18n";
import type { Journey } from "./model";
import { StoryContent } from "./StoryContent";

/** A person's life on the shared engine: steps are life events, the HUD shows year and age. */
export function PersonSimulation({ journey, locale, messages: m }: { journey: Journey; locale: Locale; messages: Messages }) {
  const { person, steps } = journey;
  const name = t(person.shortName ?? person.name, locale);
  return (
    <SimulationEngine
      data={journey}
      locale={locale}
      messages={m}
      indexLink={{ href: "/persons/", label: m.sim.back }}
      finalLabel={m.sim.toLegacy}
      finalTitle={m.legacy.title}
      counters={(step, final) => {
        const age = final ? steps.at(-1)!.age : step.age;
        return [
          { label: m.sim.year, value: step.year },
          { label: m.sim.age, value: age.years, prefix: age.approximate ? "~" : "", accent: true },
        ];
      }}
      renderStep={({ step, mode, choices, choose, here, openPlace }) => (
        <StoryContent
          step={step}
          personName={name}
          mode={mode}
          locale={locale}
          m={m}
          chosen={choices[step.id]}
          onChoose={choose}
          here={here}
          onPlace={openPlace}
        />
      )}
      renderFinal={({ choices, teacher, restart, back }) => (
        <LegacyPanel journey={journey} choices={choices} locale={locale} m={m} teacher={teacher} onRestart={restart} onBack={back} />
      )}
    />
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHANNELS, type Channel } from "@/features/audio/manifest";
import { format, type Messages } from "@/lib/i18n";
import { isLightMode, setChannel, updateSettings, useSettings } from "@/lib/settings";

/** One-click mute plus a popover with per-channel volume, light mode and teacher mode. */
export function SettingsButton({ m, align = "right" }: { m: Messages; align?: "left" | "right" }) {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => updateSettings({ muted: !s.muted })}
        aria-pressed={s.muted}
        aria-label={s.muted ? m.settings.unmuteAll : m.settings.muteAll}
        title={s.muted ? m.settings.unmuteAll : m.settings.muteAll}
        className="grid size-9 place-items-center rounded-full text-ink hover:bg-ink/5"
      >
        <SpeakerIcon muted={s.muted} />
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={m.settings.open}
        title={m.settings.open}
        className="grid size-9 place-items-center rounded-full text-ink hover:bg-ink/5"
      >
        <GearIcon />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={m.settings.title}
          className={`paper-card absolute top-11 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg p-4 text-sm ${align === "right" ? "right-0" : "left-0"}`}
        >
          <h2 className="font-display text-lg font-semibold text-ink">{m.settings.title}</h2>
          <Slider
            label={m.settings.master}
            value={s.master}
            muted={s.muted}
            onChange={(v) => updateSettings({ master: v, muted: false })}
            onMute={() => updateSettings({ muted: !s.muted })}
            muteLabel={s.muted ? m.settings.unmuteAll : m.settings.muteAll}
          />
          <div className="mt-1 space-y-1 border-t border-ink/10 pt-2">
            {CHANNELS.map((c: Channel) => (
              <Slider
                key={c}
                label={m.settings.channels[c]}
                value={s.channels[c].volume}
                muted={s.channels[c].muted}
                onChange={(v) => setChannel(c, { volume: v, muted: false })}
                onMute={() => setChannel(c, { muted: !s.channels[c].muted })}
                muteLabel={format(s.channels[c].muted ? m.settings.unmuteChannel : m.settings.muteChannel, { name: m.settings.channels[c] })}
              />
            ))}
          </div>
          <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
            <Toggle
              label={m.settings.lightMode}
              help={m.settings.lightModeHelp}
              checked={isLightMode(s)}
              onChange={(v) => updateSettings({ lightMode: v })}
            />
            <Toggle
              label={m.settings.teacherMode}
              help={m.settings.teacherModeHelp}
              checked={s.teacherMode}
              onChange={(v) => updateSettings({ teacherMode: v })}
            />
            <Toggle
              label={m.claims.showLegends}
              help={m.claims.showLegendsHelp}
              checked={s.showLegends}
              onChange={(v) => updateSettings({ showLegends: v })}
            />
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">{m.settings.saved}</p>
          <p className="text-[11px] text-ink-faint">{m.settings.audioCredits}</p>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  muted,
  onChange,
  onMute,
  muteLabel,
}: {
  label: string;
  value: number;
  muted: boolean;
  onChange: (v: number) => void;
  onMute: () => void;
  muteLabel: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        onClick={onMute}
        aria-pressed={muted}
        aria-label={muteLabel}
        title={muteLabel}
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-ink/5"
      >
        <SpeakerIcon muted={muted} size={16} />
      </button>
      <label htmlFor={id} className="w-28 shrink-0 text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={`range h-1.5 min-w-0 flex-1 ${muted ? "opacity-40" : ""}`}
      />
    </div>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${id}-help`}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-lapis" : "bg-ink/20"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-parchment-light shadow transition-[left] ${checked ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs leading-snug text-ink-faint">
        {help}
      </p>
    </div>
  );
}

export function SpeakerIcon({ muted, size = 18 }: { muted: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.15" />
      {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

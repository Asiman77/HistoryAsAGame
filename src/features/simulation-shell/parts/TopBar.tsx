"use client";

import { ArrowLeft, Pause, Play, Star, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

export type ShellMode = "story" | "learn";

export interface TopBarProps {
  title: string;
  subtitle: string;
  back: { href: string; label: string };
  mode: ShellMode;
  onMode: (m: ShellMode) => void;
  legends: boolean;
  onLegends: () => void;
  /** Hidden when no step is a legend. */
  hasLegends: boolean;
  muted: boolean;
  onMute: () => void;
  playing: boolean;
  onPlay: () => void;
}

/** Simulation top bar (Simulation artboard): back, title, mode, legends, autoplay, sound. */
export function TopBar(p: TopBarProps) {
  const t = useTranslations("shell");
  return (
    <header className="relative z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-panel/95 px-4 backdrop-blur-md md:px-7" data-testid="shell-topbar">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={p.back.href}
          aria-label={t("back", { label: p.back.label })}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-button border border-fg/15 bg-surface-raised/70 text-fg hover:border-fg/35"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="m-0 truncate font-heading text-22 font-medium leading-tight text-fg">{p.title}</h1>
          <p className="m-0 truncate text-12 uppercase tracking-[0.18em] text-fg-secondary">{p.subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SegmentedControl
          label={t("modeLabel")}
          value={p.mode}
          onChange={p.onMode}
          options={[
            { value: "story", label: t("story") },
            { value: "learn", label: t("learn") },
          ]}
        />
        {p.hasLegends ? (
          <button
            type="button"
            aria-pressed={p.legends}
            title={t("legendsHint")}
            onClick={p.onLegends}
            className={cx(
              "hidden min-h-11 items-center gap-2 rounded-full border px-4 text-14 font-semibold transition-colors xl:inline-flex",
              p.legends ? "border-claim-legend/50 text-claim-legend" : "border-fg/15 text-fg-muted",
            )}
          >
            <Star size={16} aria-hidden fill={p.legends ? "currentColor" : "none"} /> {t("legends")}
          </button>
        ) : null}
        <IconButton label={p.playing ? t("pause") : t("autoplay")} pressed={p.playing} onClick={p.onPlay} className="hidden md:inline-flex">
          {p.playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </IconButton>
        <IconButton label={p.muted ? t("soundOn") : t("soundOff")} pressed={!p.muted} onClick={p.onMute}>
          {p.muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
        </IconButton>
      </div>
    </header>
  );
}

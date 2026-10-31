import type { EventType } from "@/domain/schema";

const PATHS: Record<EventType, string> = {
  birth: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  childhood: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 20c0-3.3 2.2-6 5-6s5 2.7 5 6",
  education: "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13.5",
  journey: "M4 18c3-1 4-4 7-5s5 1 9-3M16 6h4v4",
  battle: "M5 5l10 10M15 15l2-.4 2.4 2.4-2.6 2.6L14.4 17zM19 5L9 15M9 15l-2-.4-2.4 2.4 2.6 2.6L9.6 17z",
  coronation: "M4 17l1.5-9 4 4L12 6l2.5 6 4-4L20 17zM4 20h16",
  marriage: "M9 9a5 5 0 1 0 0 10A5 5 0 0 0 9 9zM15 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  diplomacy: "M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2zM6 4a2 2 0 0 0-2 2v2h2M9 9h6M9 13h6",
  culture: "M19 4c-6 1-10 5-12 12l-2 4M19 4c0 6-4 10-10 11M11 9l3 3",
  exile: "M5 4h9v16H5zM14 12h6M17 9l3 3-3 3M9 12h.01",
  death: "M12 21v-7M12 14c-3 0-5-2.5-5-6 2 0 3.5 1 5 2.5C13.5 9 15 8 17 8c0 3.5-2 6-5 6zM12 10.5V5M8 21h8",
};

export function EventIcon({ type, size = 16, className = "" }: { type: EventType; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[type]} />
    </svg>
  );
}

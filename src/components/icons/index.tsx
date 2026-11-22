import { Icon, type IconProps } from "./Icon";

export type { IconProps };

/** Eight-pointed star points on a 24 grid, centred at (12,12). */
const STAR = "12,2 14.6,7.6 20.5,5.5 18.4,11.3 22,15.4 16.1,16.1 14.8,22 12,17.3 9.2,22 7.9,16.1 2,15.4 5.6,11.3 3.5,5.5 9.4,7.6";

/** Brand mark: eight-pointed star with a gold centre (design header). */
export function Logo({ size = 34, title, ...rest }: IconProps) {
  return (
    <Icon size={size} title={title} strokeWidth={1.3} {...rest}>
      <polygon points={STAR} />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function EightPointStar(props: IconProps) {
  return (
    <Icon {...props}>
      <polygon points={STAR} />
    </Icon>
  );
}

/** Capital: crowned tower. */
export function CapitalCrown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9l3 2.5L12 5l5 6.5L20 9l-1.5 8h-13z" />
      <path d="M6 20h12" />
    </Icon>
  );
}

/** Battlefield: crossed swords. */
export function BattleSwords(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l11 11M15 15l2.5-.5L20 17l-3 3-2.5-2.5zM20 4L9 15M9 15l-2.5-.5L4 17l3 3 2.5-2.5z" />
    </Icon>
  );
}

/** Shrine: dome with a finial. */
export function Shrine(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v2M7 12a5 5 0 0 1 10 0" />
      <path d="M5 12h14v8H5zM10 20v-4a2 2 0 0 1 4 0v4" />
    </Icon>
  );
}

/** Fortress: crenellated walls. */
export function Fortress(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 20V8h3v2h3V8h6v2h3V8h3v12z" />
      <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
    </Icon>
  );
}

/** Port: sailing ship. */
export function Port(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M12 4l6 9h-6M12 6l-5 7h5" />
      <path d="M3 16h18l-2.5 4h-13z" />
    </Icon>
  );
}

/** City: domes and a minaret. */
export function City(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 20V12h4v8M7 14a4 4 0 0 1 8 0v6M15 20V9l1.5-2L18 9v11M2 20h20" />
    </Icon>
  );
}

/** Carnation: memorial motif (war heroes). */
export function Carnation(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21V11M12 11c-3 0-5-2-5-5 2 0 4 1 5 3 1-2 3-3 5-3 0 3-2 5-5 5z" />
      <path d="M12 16c-2-1-4-1-5 0M12 18c2-1 4-1 5 0" />
    </Icon>
  );
}

/** Compass rose of the map (north = Ş, şimal). */
export function Compass(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 4l2 8-2 8-2-8z" fill="currentColor" fillOpacity="0.35" />
    </Icon>
  );
}

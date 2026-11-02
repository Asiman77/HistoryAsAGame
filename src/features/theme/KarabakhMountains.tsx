/**
 * Own illustration for the 2020 theme, drawn in SVG so it needs no licence:
 * Karabakh ridges in receding layers, the cliffs of Shusha in engraving
 * hatching on the right, a faint eight-pointed star rising behind the hills.
 */
export function KarabakhMountains({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="km-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaf2" />
          <stop offset="1" stopColor="#f6f8fa" />
        </linearGradient>
        {/* Engraving: fine horizontal hatching for the cliff face. */}
        <pattern id="km-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <path d="M0 3h6" stroke="#1d2b38" strokeWidth="1.1" />
        </pattern>
        <pattern id="km-hatch-fine" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <path d="M0 2h4" stroke="#1d2b38" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#km-sky)" />

      {/* Eight-pointed star as a rising sun. */}
      <g transform="translate(560 330)" opacity="0.35">
        <rect x="-70" y="-70" width="140" height="140" fill="#9cc7de" />
        <rect x="-70" y="-70" width="140" height="140" fill="#9cc7de" transform="rotate(45)" />
        <circle r="44" fill="#eef4f8" />
      </g>

      {/* Far ridge */}
      <path d="M0 520 L120 450 L210 480 L330 390 L450 460 L560 410 L700 470 L820 380 L960 450 L1080 400 L1200 470 L1330 420 L1450 470 L1600 430 V900 H0Z" fill="#a9bccb" />
      {/* Middle ridge */}
      <path d="M0 600 L150 520 L260 560 L380 500 L520 580 L640 530 L760 600 L900 520 L1040 590 L1160 560 V900 H0Z" fill="#7d93a6" />
      {/* Near hills */}
      <path d="M0 700 C200 640 360 690 520 660 S820 620 980 680 S1140 720 1200 700 V900 H0Z" fill="#53697d" />

      {/* Shusha: plateau with sheer cliffs, the town on top. */}
      <g>
        <path d="M1120 900 L1150 600 L1200 560 L1600 540 V900Z" fill="#3b4f61" />
        <path d="M1120 900 L1150 600 L1200 560 L1230 900Z" fill="url(#km-hatch)" opacity="0.8" />
        <path d="M1150 600 L1170 760 L1200 560Z" fill="url(#km-hatch-fine)" opacity="0.7" />
        {/* Twin minarets and houses, simple silhouettes. */}
        <g fill="#2b3a48">
          <rect x="1300" y="508" width="70" height="40" />
          <path d="M1298 508 h74 l-37 -22z" />
          <rect x="1290" y="470" width="8" height="78" />
          <path d="M1288 470 h12 l-6 -16z" />
          <rect x="1372" y="470" width="8" height="78" />
          <path d="M1370 470 h12 l-6 -16z" />
          <rect x="1220" y="530" width="44" height="22" />
          <rect x="1410" y="522" width="56" height="26" />
          <rect x="1480" y="530" width="40" height="18" />
        </g>
      </g>
    </svg>
  );
}

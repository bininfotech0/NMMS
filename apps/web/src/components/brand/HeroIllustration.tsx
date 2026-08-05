import { cn } from "@/lib/utils";

interface HeroIllustrationProps {
  className?: string;
}

// Flat-style SVG scene echoing the Vedvriksha logo (sun + tree + people) —
// used to fill the hero art slot on the public landing page.
export function HeroIllustration({ className }: HeroIllustrationProps) {
  return (
    <svg
      viewBox="0 0 640 480"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Illustration of a flourishing tree with a community gathered beneath it, symbolizing growth through knowledge"
    >
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2faf1" />
          <stop offset="55%" stopColor="#eef7ea" />
          <stop offset="100%" stopColor="#fbf1da" />
        </linearGradient>
        <radialGradient id="heroSunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f9ab25" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f9ab25" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="heroFoliageA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c9a51" />
          <stop offset="100%" stopColor="#2e7d32" />
        </linearGradient>
        <linearGradient id="heroFoliageB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d8a41" />
          <stop offset="100%" stopColor="#1b4d1f" />
        </linearGradient>
      </defs>

      <rect width="640" height="480" fill="url(#heroSky)" />

      {/* sun */}
      <circle cx="500" cy="98" r="90" fill="url(#heroSunGlow)" />
      <circle cx="500" cy="98" r="34" fill="#f9ab25" opacity="0.9" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (360 / 12) * i;
        return (
          <rect
            key={i}
            x="497"
            y="42"
            width="6"
            height="16"
            rx="3"
            fill="#f9ab25"
            opacity="0.55"
            transform={`rotate(${angle} 500 98)`}
          />
        );
      })}

      {/* birds */}
      <path d="M118 76 q10 -10 20 0 q10 -10 20 0" stroke="#1b4d1f" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M168 108 q8 -8 16 0 q8 -8 16 0" stroke="#1b4d1f" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4" />

      {/* rolling hills */}
      <path d="M0 340 Q160 300 320 336 T640 320 V480 H0 Z" fill="#dcefda" />
      <path d="M0 372 Q180 336 360 366 T640 356 V480 H0 Z" fill="#c4e2c0" />
      <path d="M0 412 Q200 380 360 404 T640 392 V480 H0 Z" fill="#2e7d32" opacity="0.16" />

      {/* tree trunk */}
      <path
        d="M320 402 C316 360 300 330 300 296 C300 268 312 246 320 226 C328 246 340 268 340 296 C340 330 324 360 320 402 Z"
        fill="#5d4037"
      />
      <path d="M320 396 L320 300" stroke="#4a332a" strokeWidth="3" opacity="0.5" strokeLinecap="round" />

      {/* foliage clusters */}
      <ellipse cx="320" cy="176" rx="92" ry="76" fill="url(#heroFoliageA)" />
      <ellipse cx="234" cy="216" rx="62" ry="54" fill="url(#heroFoliageB)" />
      <ellipse cx="406" cy="216" rx="62" ry="54" fill="url(#heroFoliageB)" />
      <ellipse cx="320" cy="128" rx="58" ry="48" fill="url(#heroFoliageA)" opacity="0.95" />

      {/* gold "blossoms" scattered through the canopy */}
      {[
        [268, 150], [356, 138], [312, 108], [232, 206], [402, 206],
        [284, 190], [352, 196], [320, 168], [246, 168], [392, 168],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 5 : 3.5} fill="#f9ab25" opacity="0.9" />
      ))}

      {/* ground shadow under tree */}
      <ellipse cx="320" cy="406" rx="150" ry="14" fill="#1b4d1f" opacity="0.1" />

      {/* community gathered beneath the tree */}
      <g>
        {/* adult, left */}
        <circle cx="248" cy="356" r="12" fill="#5d4037" />
        <path d="M248 368 L248 402 M248 372 L232 392 M248 372 L264 392" stroke="#5d4037" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M232 402 L226 434 L270 434 L264 402 Z" fill="#2e7d32" />

        {/* child, center-left, arm raised to tree */}
        <circle cx="292" cy="376" r="9" fill="#7a5548" />
        <path d="M292 385 L292 410 M292 388 L280 372 M292 392 L302 404" stroke="#7a5548" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        <path d="M280 410 L276 434 L308 434 L304 410 Z" fill="#f9ab25" />

        {/* child, center-right, arm raised to tree */}
        <circle cx="352" cy="374" r="9" fill="#5d4037" />
        <path d="M352 383 L352 410 M352 386 L364 370 M352 390 L342 402" stroke="#5d4037" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        <path d="M338 410 L334 434 L366 434 L362 410 Z" fill="#2e7d32" opacity="0.85" />

        {/* adult, right */}
        <circle cx="398" cy="356" r="12" fill="#7a5548" />
        <path d="M398 368 L398 402 M398 372 L382 392 M398 372 L414 392" stroke="#7a5548" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M382 402 L376 434 L420 434 L414 402 Z" fill="#f9ab25" opacity="0.9" />
      </g>

      {/* falling leaves */}
      <ellipse cx="176" cy="180" rx="7" ry="4" fill="#2e7d32" opacity="0.5" transform="rotate(30 176 180)" />
      <ellipse cx="470" cy="240" rx="7" ry="4" fill="#f9ab25" opacity="0.6" transform="rotate(-20 470 240)" />
      <ellipse cx="150" cy="260" rx="6" ry="3.5" fill="#f9ab25" opacity="0.5" transform="rotate(60 150 260)" />
      <ellipse cx="500" cy="180" rx="6" ry="3.5" fill="#2e7d32" opacity="0.4" transform="rotate(-45 500 180)" />
    </svg>
  );
}

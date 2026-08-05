import { cn } from "@/lib/utils";

const RAY_COUNT = 16;

function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const angle = (360 / RAY_COUNT) * i;
    return (
      <polygon
        key={i}
        points="47,21 53,21 56,4 44,4"
        fill="var(--brand-gold)"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {rays}

      {/* halo behind the tree */}
      <path
        d="M50 20 C64 28 68 50 64 66 C60 80 50 84 50 84 C50 84 40 80 36 66 C32 50 36 28 50 20 Z"
        fill="#f5dfa8"
      />

      {/* trunk */}
      <path d="M50 66 L50 44" stroke="var(--brand-green-dark)" strokeWidth="5" strokeLinecap="round" />

      {/* leaf clusters */}
      <ellipse cx="50" cy="32" rx="13" ry="12" fill="var(--brand-green)" />
      <ellipse cx="38" cy="45" rx="10" ry="9" fill="var(--brand-green)" />
      <ellipse cx="62" cy="45" rx="10" ry="9" fill="var(--brand-green)" />

      {/* girl, reaching up with one arm */}
      <circle cx="41" cy="63.5" r="3.4" fill="var(--brand-brown)" />
      <path
        d="M41 67 L41 74 M41 68 L46 61 M41 70 L37 74"
        stroke="var(--brand-brown)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M41 74 L35 85 L47 85 Z" fill="var(--brand-brown)" />

      {/* boy, reaching up with one arm */}
      <circle cx="60" cy="61" r="3.6" fill="var(--brand-brown)" />
      <path
        d="M60 64.5 L60 76 M60 66 L54 59 M60 68 L65 72 M60 76 L55 86 M60 76 L65 86"
        stroke="var(--brand-brown)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

interface LogoProps {
  variant?: "full" | "icon" | "stacked";
  size?: number;
  showTagline?: boolean;
  className?: string;
  tone?: "auto" | "light";
}

export function Logo({
  variant = "full",
  size = 40,
  showTagline = false,
  className,
  tone = "auto",
}: LogoProps) {
  if (variant === "icon") {
    return <LogoMark size={size} className={className} />;
  }

  const isLight = tone === "light";

  return (
    <div className={cn("flex items-center gap-3", variant === "stacked" && "flex-col text-center gap-1", className)}>
      <LogoMark size={size} />
      <div className={cn("leading-tight", variant === "stacked" && "mt-1")}>
        <div
          className={cn(
            "font-logo text-lg font-bold tracking-wide",
            isLight ? "text-white" : "text-brand-brown"
          )}
        >
          VEDVRIKSHA
        </div>
        <div
          className={cn("font-logo-deva text-sm font-semibold", isLight ? "text-white/85" : "text-brand-brown")}
        >
          वेदवृक्ष
        </div>
        {showTagline && (
          <div
            className={cn(
              "font-logo mt-0.5 text-xs font-bold",
              isLight ? "text-white/70" : "text-brand-brown/80"
            )}
          >
            Rooted in knowledge. Growing for all.
          </div>
        )}
      </div>
    </div>
  );
}

import type { Raid } from "@steal/shared";

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
});

export function BossIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M10 31h28" />
      <path d="M15 31l2-13h14l2 13" />
      <path d="M16 25h16" />
      <path d="M24 18v7" />
      <rect x="14" y="33" width="8" height="5.5" rx="1.6" />
      <rect x="26" y="33" width="8" height="5.5" rx="1.6" />
      <path d="M22 35.5h4" />
      <path d="M18 42h12" />
    </svg>
  );
}

export function DogIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M13 22l-3-9 9 3" />
      <path d="M35 22l3-9-9 3" />
      <path d="M13 21v9c0 7 5 12 11 12s11-5 11-12v-9" />
      <path d="M19 30h.01" />
      <path d="M29 30h.01" />
      <path d="M24 33l-2.5 2.5h5z" />
      <path d="M20 39c2.5 1.5 5.5 1.5 8 0" />
    </svg>
  );
}

export function GreedyIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <rect x="9" y="8" width="18" height="24" rx="2" transform="rotate(-7 18 20)" />
      <path d="M15 17l8-1M15 22l6-1" />
      <path d="M27 41c5-2 8-7 8-13" />
      <path d="M27 41l-5-3 1-7 7 2" />
      <path d="M30 33l7-2" />
      <path d="M34 28l5 1" />
    </svg>
  );
}

export function SketchIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M12 35l3-10L31 9l6 6-16 16-9 4z" />
      <path d="M27 13l6 6" />
      <path d="M15 25l6 6" />
      <path d="M12 35l6-2" />
    </svg>
  );
}

export function SculptureIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <circle cx="24" cy="16" r="6" />
      <path d="M15 41c0-7 3-12 9-12s9 5 9 12" />
      <path d="M12 41h24" />
      <path d="M20 22l4 4 4-4" />
    </svg>
  );
}

export function AntiquityIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M19 10h10l-1 6c5 3 7 6 7 11 0 6-5 10-11 10s-11-4-11-10c0-5 2-8 7-11z" />
      <path d="M19 10h10" />
      <path d="M16 19c-4 1-5 4-5 7s2 5 4 5" />
      <path d="M32 19c4 1 5 4 5 7s-2 5-4 5" />
      <path d="M18 37h12" />
    </svg>
  );
}

export function PaintingIcon({ size = 40, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <rect x="9" y="10" width="30" height="26" rx="1.5" />
      <path d="M12 31l8-10 5 6 3-4 8 8" />
      <circle cx="18" cy="18" r="2.5" />
    </svg>
  );
}

export function RaidIcon({ raid, size = 40, className }: IconProps & { raid: Raid }) {
  if (raid === 1) return <SketchIcon size={size} className={className} />;
  if (raid === 2) return <SculptureIcon size={size} className={className} />;
  if (raid === 3) return <AntiquityIcon size={size} className={className} />;
  return <PaintingIcon size={size} className={className} />;
}

export function CrownIcon({ size = 32, className, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M9 18l6 5 9-11 9 11 6-5-3 20H12z" />
      <path d="M12 32h24" />
    </svg>
  );
}

export function CopyIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <rect x="17" y="17" width="20" height="20" rx="2" />
      <path d="M31 17v-3a2 2 0 0 0-2-2H13a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function CheckIcon({ size = 20, className, strokeWidth = 2.4 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M10 25l8 8 20-21" />
    </svg>
  );
}

export function CloseIcon({ size = 22, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M12 12l24 24M36 12L12 36" />
    </svg>
  );
}

export function LeaveIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M22 10H12a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h10" />
      <path d="M28 16l8 8-8 8" />
      <path d="M36 24H18" />
    </svg>
  );
}

export function RulesIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M12 10h10a4 4 0 0 1 4 4v24a5 5 0 0 0-4-2H12z" />
      <path d="M36 10H26a4 4 0 0 0-4 4v24a5 5 0 0 1 4-2h10z" />
      <path d="M16 19h5M16 25h5M27 19h5M27 25h5" />
    </svg>
  );
}

export function LinkIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M20 28l8-8" />
      <path d="M17 31l-3 3a6 6 0 0 1-8-8l6-6a6 6 0 0 1 8 0" />
      <path d="M31 17l3-3a6 6 0 0 1 8 8l-6 6a6 6 0 0 1-8 0" />
    </svg>
  );
}

export function PawIcon({ size = 12, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="16" rx="5" ry="4" />
      <circle cx="6" cy="10" r="2.2" />
      <circle cx="10" cy="6.5" r="2.2" />
      <circle cx="14" cy="6.5" r="2.2" />
      <circle cx="18" cy="10" r="2.2" />
    </svg>
  );
}

export function SoundOnIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M10 20h7l8-6v20l-8-6h-7z" />
      <path d="M31 18c2 2 3 4 3 6s-1 4-3 6" />
      <path d="M35 14c3 3 5 6 5 10s-2 7-5 10" />
    </svg>
  );
}

export function SoundOffIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M10 20h7l8-6v20l-8-6h-7z" />
      <path d="M31 20l8 8M39 20l-8 8" />
    </svg>
  );
}

export function ChatIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M9 11h30v20H22l-8 7v-7H9z" />
      <path d="M17 19h.01M24 19h.01M31 19h.01" />
    </svg>
  );
}

export function FeedIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <path d="M10 13h28" />
      <path d="M10 24h28" />
      <path d="M10 35h18" />
      <circle cx="36" cy="35" r="2.5" />
    </svg>
  );
}

export function UsersIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} className={className}>
      <circle cx="19" cy="17" r="6" />
      <path d="M8 39c0-7 5-11 11-11s11 4 11 11" />
      <path d="M31 13a5 5 0 0 1 0 9" />
      <path d="M35 28c3 1 5 4 5 8" />
    </svg>
  );
}

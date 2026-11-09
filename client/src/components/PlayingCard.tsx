import type { CSSProperties, ReactNode } from "react";
import { cardLabel, type Card } from "@steal/shared";
import { BossIcon, DogIcon, GreedyIcon } from "./Icons";

interface SpecialMeta {
  icon: ReactNode;
  label: string;
  tone: string;
}

const SPECIAL: Record<Exclude<Card["type"], "number">, SpecialMeta> = {
  boss: {
    icon: <BossIcon size={54} />,
    label: "老板",
    tone: "red"
  },
  dog: {
    icon: <DogIcon size={54} />,
    label: "看门狗",
    tone: "cobalt"
  },
  greedy: {
    icon: <GreedyIcon size={54} />,
    label: "贪心贼",
    tone: "ink"
  }
};

interface PlayingCardProps {
  card: Card;
  size?: "md" | "sm";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function PlayingCard({
  card,
  size = "md",
  selected = false,
  disabled = false,
  onClick,
  onDoubleClick,
  style,
  className = ""
}: PlayingCardProps) {
  const special = card.type === "number" ? null : SPECIAL[card.type];
  const value = card.value ?? 0;
  const classes = [
    "card",
    `card--${size}`,
    special ? `card--${card.type}` : "card--number",
    special ? `card--tone-${special.tone}` : "",
    selected ? "is-selected" : "",
    disabled ? "is-disabled" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const content = special ? (
    <>
      <span className="card__frame" aria-hidden="true" />
      <span className="card__special-icon">{special.icon}</span>
      <span className="card__special-label">{special.label}</span>
    </>
  ) : (
    <>
      <span className="card__frame" aria-hidden="true" />
      <span className="card__number" aria-hidden="true">
        {value}
      </span>
    </>
  );

  const label = cardLabel(card);
  if (!onClick) {
    return (
      <div className={classes} style={style} aria-label={label} data-card-id={card.id}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={style}
      data-card-id={card.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      aria-label={selected ? `${label}，已选中` : label}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

export function CardBack({ size = "md", className = "" }: { size?: "md" | "sm"; className?: string }) {
  return (
    <div className={`card card--back card--${size} ${className}`} aria-hidden="true">
      <span className="card__back-frame" />
      <span className="card__back-mark">AR</span>
      <span className="card__back-lines" />
    </div>
  );
}

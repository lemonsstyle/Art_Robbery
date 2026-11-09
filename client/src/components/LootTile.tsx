import type { CSSProperties } from "react";
import type { Tile } from "@steal/shared";
import { BossIcon } from "./Icons";

interface LootTileProps {
  tile: Tile;
  size?: "md" | "sm" | "xs";
  eligible?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function LootTile({
  tile,
  size = "md",
  eligible = false,
  selected = false,
  disabled = false,
  onClick,
  style,
  className = ""
}: LootTileProps) {
  const classes = [
    "tile",
    `tile--${size}`,
    `tile--raid-${tile.raid}`,
    tile.kind === "boss" ? "tile--boss" : "",
    eligible ? "is-eligible" : "",
    selected ? "is-selected" : "",
    disabled ? "is-disabled" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const label =
    tile.kind === "boss"
      ? "老板圆片，价值 5 分"
      : `数字 ${tile.value} 圆片${tile.alibi > 0 ? `，${tile.alibi} 个不在场证明` : ""}`;

  const content = (
    <>
      <span className="tile__ring" aria-hidden="true" />
      {tile.kind === "boss" ? (
        <>
          <BossIcon size={size === "md" ? 34 : size === "sm" ? 24 : 18} />
          <span className="tile__boss-value">5</span>
        </>
      ) : (
        <span className="tile__value">{tile.value}</span>
      )}
      {tile.alibi > 0 && (
        <span className="tile__dots" aria-hidden="true">
          {Array.from({ length: tile.alibi }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div className={classes} style={style} aria-label={label} data-tile-id={tile.id}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      style={style}
      data-tile-id={tile.id}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

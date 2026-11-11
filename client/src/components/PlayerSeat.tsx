import type { PublicPlayer, Raid } from "@steal/shared";
import { LootTile } from "./LootTile";
import { BossIcon, DogIcon } from "./Icons";
import { VaultStacks } from "./VaultStacks";

interface PlayerSeatProps {
  player: PublicPlayer;
  currentRaid: Raid;
  isCurrent: boolean;
  isYou?: boolean;
  hasDog?: boolean;
  chatText?: string;
  eligibleTileIds?: Set<string>;
  onTileClick?: (tileId: string) => void;
  className?: string;
}

export function PlayerSeat({
  player,
  currentRaid,
  isCurrent,
  isYou = false,
  hasDog = false,
  chatText,
  eligibleTileIds,
  onTileClick,
  className = ""
}: PlayerSeatProps) {
  const activeLoot = player.loot
    .filter((tile) => !tile.secured)
    .sort(
      (a, b) =>
        a.value - b.value ||
        (a.kind === "boss" ? 1 : 0) - (b.kind === "boss" ? 1 : 0) ||
        a.id.localeCompare(b.id)
    );
  const vaultLoot = player.loot.filter((tile) => tile.secured);
  const activePoints = activeLoot.reduce((sum, tile) => sum + tile.value, 0);
  const activeAlibi = activeLoot.reduce((sum, tile) => sum + tile.alibi, 0);
  const currentBoss = player.loot.find(
    (tile) => tile.raid === currentRaid && tile.kind === "boss"
  );
  const initial = player.name.trim().slice(0, 1).toUpperCase();


  return (
    <article
      className={[
        "seat",
        isYou ? "seat--you" : "",
        isCurrent ? "is-current" : "",
        currentBoss ? "seat--boss-holder" : "",
        hasDog ? "seat--dog-holder" : "",
        player.connected ? "" : "is-offline",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-player-id={player.id}
      data-loot={player.id}
    >
      <div className="seat__top">
        <span className="seat__avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="seat__identity">
          <span className="seat__name">
            {player.name}
            {isYou && <em>你</em>}
            {player.isHost && <span className="seat__host">房主</span>}
          </span>
          <span className="seat__meta">
            本轮 {activePoints} 分 · {activeAlibi} 白点
          </span>
        </div>
      </div>

      {(currentBoss || hasDog) && (
        <div className="holder-seals">
          {currentBoss && (
            <span className="holder-seal holder-seal--boss" title="持有老板">
              <BossIcon size={20} />
              <b>老板</b>
            </span>
          )}
          {hasDog && (
            <span className="holder-seal holder-seal--dog" title="持有看门狗">
              <DogIcon size={20} />
              <b>看门狗</b>
            </span>
          )}
        </div>
      )}

      <div className="seat__loot">
        {activeLoot.length === 0 ? (
          <span className="seat__empty">还没有赃物</span>
        ) : (
          activeLoot.map((tile) => (
            <LootTile
              key={tile.id}
              tile={tile}
              size="sm"
              eligible={eligibleTileIds?.has(tile.id) ?? false}
              disabled={!eligibleTileIds?.has(tile.id)}
              onClick={
                eligibleTileIds?.has(tile.id) && onTileClick
                  ? () => onTileClick(tile.id)
                  : undefined
              }
            />
          ))
        )}
      </div>

      <VaultStacks tiles={vaultLoot} />

      {!player.connected && <span className="seat__offline">离线</span>}
      {isCurrent && (
        <span className="seat__turn-tag" aria-label="正在出牌">
          <i />
          出牌中
        </span>
      )}
      {chatText && (
        <div className="chat-bubble chat-bubble--seat" role="status">
          {chatText}
        </div>
      )}
    </article>
  );
}

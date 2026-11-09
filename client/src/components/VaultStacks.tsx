import { RAID_INFO, type LootTile, type Raid } from "@steal/shared";

const RAIDS: Raid[] = [1, 2, 3, 4];

export function VaultStacks({ tiles }: { tiles: LootTile[] }) {
  const groups = RAIDS.map((raid) => ({
    raid,
    tiles: tiles.filter((tile) => tile.raid === raid)
  })).filter((group) => group.tiles.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="seat__vault">
      <span className="seat__vault-label">已封存</span>
      {groups.map((group) => (
        <div
          className="vault"
          key={group.raid}
          title={`第 ${group.raid} 轮：${group.tiles.length} 枚已封存`}
        >
          <span className={`vault__stack vault__stack--r${group.raid}`}>
            <i />
            <i />
            <i />
            <b>{group.tiles.length}</b>
          </span>
          <em>{RAID_INFO[group.raid].name}</em>
        </div>
      ))}
    </div>
  );
}

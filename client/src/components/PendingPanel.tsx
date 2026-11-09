import type { GameView } from "@steal/shared";
import { LootTile } from "./LootTile";
import { DogIcon } from "./Icons";
import { sound } from "../lib/sound";

interface PendingPanelProps {
  view: GameView;
  myId: string;
  now: number;
  onDogResponse: (giveDog: boolean) => void;
}

export function PendingPanel({ view, myId, now, onDogResponse }: PendingPanelProps) {
  const pending = view.pending;
  if (!pending) return null;

  const actor = view.players.find((player) => player.id === pending.actorId);
  const mine = pending.actorId === myId;

  if (!mine) {
    return (
      <div className="pending-bar pending-bar--wait" role="status">
        <span className="dot dot--live" />
        等待 {actor?.name ?? "对手"} 做选择…
      </div>
    );
  }

  if (pending.kind === "dog") {
    const tile = view.you?.loot.find((item) => item.id === pending.tileId);
    const seconds = Math.max(0, Math.ceil((pending.deadline - now) / 1000));
    return (
      <div className="modal-backdrop modal-backdrop--soft">
        <div className="modal dog-modal" role="dialog" aria-modal="true" aria-labelledby="dog-title">
          <div className="dog-modal__icon" aria-hidden="true">
            <DogIcon size={48} />
          </div>
          <p className="eyebrow">看门狗</p>
          <h2 id="dog-title">有人要抢你的圆片</h2>
          <p className="dog-modal__lead">选一个留下</p>
          <div className="dog-choices">
            <button
              className="dog-choice dog-choice--dog"
              type="button"
              aria-label="交出看门狗，保住圆片"
              onClick={() => {
                sound.play("click");
                onDogResponse(true);
              }}
            >
              <span className="dog-choice__icon">
                <DogIcon size={34} />
              </span>
              <b>交出看门狗</b>
              <span>保住圆片</span>
            </button>
            <button
              className="dog-choice dog-choice--tile"
              type="button"
              aria-label="交出圆片，保住看门狗"
              onClick={() => {
                sound.play("click");
                onDogResponse(false);
              }}
            >
              <span className="dog-choice__icon">
                {tile ? <LootTile tile={tile} size="sm" /> : <span>?</span>}
              </span>
              <b>交出圆片</b>
              <span>保住看门狗</span>
            </button>
          </div>
          <p className="dog-modal__timer" aria-live="polite">
            {seconds} 秒后默认交出圆片
          </p>
        </div>
      </div>
    );
  }

  const message =
    pending.kind === "middle"
      ? `中央有几枚数字 ${pending.value}，挑一枚。`
      : pending.kind === "steal"
        ? `中央没有数字 ${pending.value} 了，从亮起的人手里挑一枚。`
        : "中央的圆片随你挑一枚。";

  return (
    <div className="pending-bar" role="status">
      <span className="pending-bar__label">轮到你选择</span>
      <span>{message}</span>
    </div>
  );
}

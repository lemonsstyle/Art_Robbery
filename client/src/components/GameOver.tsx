import { useEffect, useState } from "react";
import { RAID_INFO, type GameView, type Raid } from "@steal/shared";
import { BossIcon, CrownIcon } from "./Icons";
import { sound } from "../lib/sound";

interface GameOverProps {
  view: GameView;
  myId: string;
  onRematch: () => void;
  onLeave: () => void;
}

function Score({ value }: { value: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 650;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="score-number">{shown}</span>;
}

export function GameOver({ view, myId, onRematch, onLeave }: GameOverProps) {
  const result = view.result;

  useEffect(() => {
    if (!result) return;
    const won = result.winnerIds.includes(myId);
    const timer = window.setTimeout(() => sound.play(won ? "win" : "lose"), 350);
    return () => window.clearTimeout(timer);
  }, []);

  if (!result) return null;
  const winners = new Set(result.winnerIds);
  const isHost = view.hostId === myId;
  const winnerNames = result.players
    .filter((player) => winners.has(player.playerId))
    .map((player) => player.name)
    .join("、");
  const bossLosses = view.events.flatMap((event) => {
    if (event.type !== "bossLost") return [];
    const name = view.players.find((player) => player.id === event.playerId)?.name ?? "有人";
    return [{ key: `${event.playerId}-${event.tile.id}`, name }];
  });

  return (
    <div className="modal-backdrop modal-backdrop--solid">
      <div className="modal gameover" role="dialog" aria-modal="true" aria-labelledby="over-title">
        <header className="gameover__head">
          <div className="gameover__crown" aria-hidden="true">
            <CrownIcon size={44} />
          </div>
          <p className="eyebrow">FINAL SCORE</p>
          <h2 id="over-title">
            {result.winnerIds.length > 0 ? `${winnerNames} 拿走了最大一份` : "全员被捕"}
          </h2>
          <p className="gameover__reason">{result.reason}</p>
          {bossLosses.length > 0 && (
            <p className="gameover__boss-lost">
              <BossIcon size={16} />
              老板失效 · {bossLosses.map((item) => item.name).join("、")}
            </p>
          )}
        </header>

        <p className="gameover__section-label">最终排名</p>

        <div className="standings" role="list" aria-label="最终排名与计分明细">
          {result.players.map((player, index) => {
            const isWinner = winners.has(player.playerId);
            const rank = player.eliminated ? "出局" : String(index + 1).padStart(2, "0");
            return (
              <article
                className={[
                  "standing",
                  isWinner ? "is-winner" : "",
                  player.eliminated ? "is-eliminated" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
                key={player.playerId}
              >
                <div className="standing__rank">
                  {isWinner ? <CrownIcon size={20} /> : null}
                  <span>{rank}</span>
                </div>

                <div className="standing__body">
                  <div className="standing__top">
                    <div className="standing__player">
                      <h3>
                        {player.name}
                        {player.playerId === myId && <em>你</em>}
                      </h3>
                      <div className="standing__tags">
                        {isWinner && <span className="tag tag--win">赢家</span>}
                        {player.eliminated && <span className="tag tag--off">被逮捕</span>}
                        {player.penalty > 0 && (
                          <span className="tag tag--penalty">罚 {player.penalty} 分</span>
                        )}
                      </div>
                    </div>
                    <div className="standing__total">
                      <span>{player.eliminated ? "赃物总额" : "总分"}</span>
                      <strong>
                        <Score value={player.score} />
                      </strong>
                    </div>
                  </div>

                  <div className="standing__segments" aria-label={`${player.name} 的四轮赃物`}>
                    {(player.raidPoints ?? [0, 0, 0, 0]).map((points, raidIndex) => (
                      <span
                        className={`standing__segment standing__segment--r${raidIndex + 1}`}
                        key={`${player.playerId}-raid-${raidIndex + 1}`}
                      >
                        <em>{RAID_INFO[(raidIndex + 1) as Raid].name}</em>
                        <b>{points}</b>
                      </span>
                    ))}
                  </div>

                  <div className="standing__breakdown">
                    {player.eliminated ? (
                      <>
                        <span>赃物 {player.lootPoints}</span>
                        <span>白点 {player.alibi}</span>
                        <span className="standing__note">白点最少，被警察逮捕，不计名次</span>
                      </>
                    ) : (
                      <>
                        <span>赃物 {player.lootPoints}</span>
                        {player.penalty > 0 && (
                          <span className="is-penalty">罚分 −{player.penalty}</span>
                        )}
                        <span className="standing__equals">=</span>
                        <strong>{player.score}</strong>
                        <span className="standing__alibi">白点 {player.alibi}</span>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="gameover__actions">
          {isHost ? (
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                sound.play("click");
                onRematch();
              }}
            >
              再来一局
            </button>
          ) : (
            <div className="gameover__waiting" role="status">
              <span className="dot dot--live" />
              等待房主开下一局…
            </div>
          )}
          <button
            className="btn btn--quiet"
            type="button"
            onClick={() => {
              sound.play("click");
              onLeave();
            }}
          >
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}

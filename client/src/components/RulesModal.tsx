import { useEffect, useRef } from "react";
import type { Card, LootTile as LootTileType } from "@steal/shared";
import { PlayingCard } from "./PlayingCard";
import { LootTile } from "./LootTile";
import { CloseIcon } from "./Icons";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const sampleCards: Card[] = [
  { id: "rules-number", type: "number", value: 3 },
  { id: "rules-boss", type: "boss" },
  { id: "rules-dog", type: "dog" },
  { id: "rules-greedy", type: "greedy" }
];

const sampleTiles: LootTileType[] = [
  { id: "rules-t3", raid: 1, kind: "number", value: 3, alibi: 0, secured: false },
  { id: "rules-t0", raid: 1, kind: "number", value: 0, alibi: 2, secured: false },
  { id: "rules-boss", raid: 1, kind: "boss", value: 5, alibi: 0, secured: false }
];

export function RulesModal({ open, onClose }: RulesModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <header className="modal__head">
          <div>
            <p className="eyebrow">HOW TO PLAY</p>
            <h2 id="rules-title">四轮，分完这笔赃。</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭规则"
            ref={closeRef}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="rules-body">
          <section>
            <h3><span>01</span> 目标</h3>
            <p>
              你们刚洗劫了美术馆。四轮之后，战利品分数最高的人赢；但白点（不在场证明）最少的人会被警察抓走，直接出局。
            </p>
          </section>

          <section>
            <h3><span>02</span> 一个回合</h3>
            <ol className="rules-steps">
              <li>从手里打出 1 张牌，放到中央弃牌堆。</li>
              <li>按牌面效果，从中央或别人面前拿走 1 枚圆片。</li>
              <li>从牌堆补 1 张，手牌回到 5 张。</li>
            </ol>
            <p className="rules-note">如果打出的牌没有可拿的圆片，就什么也不发生，仍然补牌。</p>
          </section>

          <section>
            <h3><span>03</span> 四种牌</h3>
            <div className="rules-cards">
              {sampleCards.map((card) => (
                <div className="rules-card" key={card.id}>
                  <PlayingCard card={card} size="sm" />
                  <p>
                    <strong>
                      {card.type === "number"
                        ? `数字 ${card.value}`
                        : card.type === "boss"
                          ? "老板"
                          : card.type === "dog"
                            ? "看门狗"
                            : "贪心贼"}
                    </strong>
                    {card.type === "number" && "：拿同值圆片；中央没有就从别人手里抢。"}
                    {card.type === "boss" && "：拿老板圆片；轮末须有本轮 4 或 5 才能留下。"}
                    {card.type === "dog" && "：拿走看门狗；被抢时可用狗代替圆片。"}
                    {card.type === "greedy" && "：从中央任取一枚，不能抢别人。"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3><span>04</span> 圆片与白点</h3>
            <div className="rules-tiles">
              {sampleTiles.map((tile) => (
                <LootTile key={tile.id} tile={tile} size="md" />
              ))}
            </div>
            <p>
              每轮 9 枚：数字 0–5（其中 3 有三枚）加一枚老板。老板值 5 分，但轮末没有同轮 4 或 5 就会飞走。
              圆片上的每个白点都是不在场证明，终局先比白点，再比分数。
            </p>
          </section>

          <section>
            <h3><span>05</span> 轮次与终局</h3>
            <p>
              中央最后一枚圆片被拿走时，本轮立即结束：检查老板、把圆片扣放，再开下一轮。手牌保留，牌堆不洗，持狗者下一轮先手。
            </p>
            <p>
              四轮后：3–5 人局白点最少者出局（并列则一起出局）；2 人局改为扣 10 分。然后比较战利品总分，平分比白点。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

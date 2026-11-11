import { useEffect, useMemo, useRef, useState } from "react";
import { QUICK_CHAT, RAID_INFO, cardLabel, describeEvent, type GameView } from "@steal/shared";
import type { SocketApi } from "../hooks/useSocket";
import { PlayingCard } from "./PlayingCard";
import { LootTile } from "./LootTile";
import { PlayerSeat } from "./PlayerSeat";
import { PendingPanel } from "./PendingPanel";
import { GameOver } from "./GameOver";
import { ActionLayer } from "./ActionLayer";
import { ActionLogModal, type LogEntry } from "./ActionLogModal";
import { VaultStacks } from "./VaultStacks";
import {
  BossIcon,
  ChatIcon,
  CloseIcon,
  DogIcon,
  FeedIcon,
  LeaveIcon,
  RaidIcon,
  RulesIcon,
  SoundOffIcon,
  SoundOnIcon
} from "./Icons";
import { sound } from "../lib/sound";
import { playChatAudio } from "../lib/chatAudio";

const MIDDLE_SLOTS: Array<{ kind: "number" | "boss"; value: number }> = [
  { kind: "number", value: 0 },
  { kind: "number", value: 1 },
  { kind: "number", value: 2 },
  { kind: "number", value: 3 },
  { kind: "number", value: 3 },
  { kind: "number", value: 3 },
  { kind: "number", value: 4 },
  { kind: "number", value: 5 },
  { kind: "boss", value: 5 }
];

interface GameTableProps {
  view: GameView;
  myId: string;
  connected: boolean;
  api: SocketApi;
  onRules: () => void;
}

export function GameTable({ view, myId, connected, api, onRules }: GameTableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Record<string, { text: string; at: number }>>({});
  const [dealing, setDealing] = useState(true);
  const [muted, setMuted] = useState(() => sound.isMuted());
  const lastSeqRef = useRef(0);
  const lastSoundSeqRef = useRef(0);
  const lastTurnRef = useRef<string | null>(null);
  const bubbleTimers = useRef(new Map<string, number>());

  const myPlayer = view.players.find((player) => player.id === myId);
  const opponents = view.players.filter((player) => player.id !== myId);
  const topOpponentCount = opponents.length === 3 ? 1 : Math.min(opponents.length, 2);
  const topOpponents = opponents.slice(0, topOpponentCount);
  const sideOpponents =
    opponents.length >= 3 ? opponents.slice(topOpponentCount, topOpponentCount + 2) : [];
  const currentPlayer = view.players.find((player) => player.id === view.currentPlayerId);
  const pending = view.pending;
  const pendingMine = pending?.actorId === myId;
  const myTurn =
    view.phase === "PLAYING" && view.currentPlayerId === myId && pending === null;
  const raidInfo = RAID_INFO[view.raid];
  const selectedCard =
    view.you?.hand.find((card) => card.id === selectedCardId) ?? null;

  useEffect(() => {
    setSelectedCardId(null);
  }, [view.currentPlayerId, view.pending?.kind, view.raid, view.phase]);

  useEffect(() => {
    if (!dealing) return;
    const timer = window.setTimeout(() => setDealing(false), 900);
    return () => window.clearTimeout(timer);
  }, [dealing]);

  useEffect(() => {
    if (!pending || pending.kind !== "dog") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (view.seq < lastSeqRef.current) {
      lastSeqRef.current = 0;
      setLog([]);
    }
    if (view.seq <= lastSeqRef.current) return;
    lastSeqRef.current = view.seq;
    const entries: LogEntry[] = view.events.map((event, index) => {
      const description = describeEvent(event, view.players);
      const isMarker = event.type === "raidStart" || event.type === "gameStart";
      return {
        key: view.seq * 100 + index,
        text: isMarker ? description : `第 ${view.raid} 轮 · ${description}`
      };
    });
    if (entries.length > 0) setLog((previous) => [...entries, ...previous].slice(0, 30));
  }, [view.seq, view.raid, view.events, view.players]);

  useEffect(() => {
    if (view.phase === "LOBBY") {
      lastSoundSeqRef.current = 0;
      return;
    }
    if (view.seq < lastSoundSeqRef.current) lastSoundSeqRef.current = 0;
    if (view.seq <= lastSoundSeqRef.current) return;
    lastSoundSeqRef.current = view.seq;

    const events = view.events;
    const play = events.find((event) => event.type === "play");
    const take = events.find((event) => event.type === "take");
    const dog = events.find((event) => event.type === "dogTaken" || event.type === "dogGiven");
    const bossLost = events.find((event) => event.type === "bossLost");
    const raidStart = events.find((event) => event.type === "raidStart");
    const raidEnd = events.find((event) => event.type === "raidEnd");

    if (raidStart) sound.play("roundStart");
    if (play) sound.play("play");
    if (take) {
      window.setTimeout(
        () => sound.play(take.from === "player" ? "steal" : "take"),
        180
      );
      if (take.tile.kind === "boss") {
        window.setTimeout(() => sound.play("boss"), 420);
      }
    }
    if (dog) window.setTimeout(() => sound.play("dog"), 120);
    if (bossLost) window.setTimeout(() => sound.play("boss"), 120);
    if (raidEnd) window.setTimeout(() => sound.play("roundEnd"), 300);
    if (view.pending?.actorId === myId) {
      window.setTimeout(() => sound.play("prompt"), 260);
    }
  }, [view.seq, view.events, view.phase, view.pending, myId]);

  useEffect(() => {
    if (
      view.phase === "PLAYING" &&
      view.currentPlayerId === myId &&
      lastTurnRef.current !== myId
    ) {
      sound.play("turn");
    }
    lastTurnRef.current = view.currentPlayerId;
  }, [view.currentPlayerId, view.phase, myId]);

  useEffect(() => {
    const chat = api.chat;
    if (!chat) return;
    const phrase = QUICK_CHAT.find((item) => item.id === chat.messageId);
    if (phrase && chat.playerId !== myId) playChatAudio(phrase.audio);
    setBubbles((previous) => ({
      ...previous,
      [chat.playerId]: { text: chat.text, at: chat.at }
    }));
    const existing = bubbleTimers.current.get(chat.playerId);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      setBubbles((previous) => {
        const current = previous[chat.playerId];
        if (!current || current.at !== chat.at) return previous;
        const next = { ...previous };
        delete next[chat.playerId];
        return next;
      });
      bubbleTimers.current.delete(chat.playerId);
    }, 4500);
    bubbleTimers.current.set(chat.playerId, timer);
  }, [api.chat, myId]);

  useEffect(
    () => () => {
      for (const timer of bubbleTimers.current.values()) window.clearTimeout(timer);
      bubbleTimers.current.clear();
    },
    []
  );

  const eligibleMiddle = useMemo(() => {
    const set = new Set<string>();
    if (pending && pendingMine && (pending.kind === "middle" || pending.kind === "greedy")) {
      for (const id of pending.tileIds) set.add(id);
    }
    return set;
  }, [pending, pendingMine]);

  const eligibleLoot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (pending && pendingMine && pending.kind === "steal") {
      for (const option of pending.options) {
        map.set(option.playerId, new Set(option.tileIds));
      }
    }
    return map;
  }, [pending, pendingMine]);

  const playSelected = () => {
    if (!selectedCardId || !myTurn) return;
    sound.play("click");
    api.playCard(selectedCardId);
    setSelectedCardId(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCardId(null);
      if (event.key === "Enter" && selectedCardId && myTurn) {
        event.preventDefault();
        sound.play("click");
        api.playCard(selectedCardId);
        setSelectedCardId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, myTurn, selectedCardId]);

  const onMiddleTile = (tileId: string) => {
    if (!pending || !pendingMine) return;
    sound.play("select");
    if (pending.kind === "middle") api.chooseTile(tileId);
    if (pending.kind === "greedy") api.chooseGreedy(tileId);
  };

  const onLootTile = (playerId: string, tileId: string) => {
    if (!pending || !pendingMine || pending.kind !== "steal") return;
    sound.play("select");
    api.chooseSteal(playerId, tileId);
  };

  const myAllLoot = myPlayer?.loot ?? [];
  const myLoot = myAllLoot
    .filter((tile) => !tile.secured)
    .sort(
      (a, b) =>
        a.value - b.value ||
        (a.kind === "boss" ? 1 : 0) - (b.kind === "boss" ? 1 : 0) ||
        a.id.localeCompare(b.id)
    );
  const myCurrentBoss = myAllLoot.find(
    (tile) => tile.raid === view.raid && tile.kind === "boss"
  );
  const myPoints = myLoot.reduce((sum, tile) => sum + tile.value, 0);
  const myAlibi = myLoot.reduce((sum, tile) => sum + tile.alibi, 0);
  const bossOnTable = view.middle.some((tile) => tile.kind === "boss");
  const dogOnTable = view.dogHolderId === null;
  const tableClassName = [
    "table",
    bossOnTable ? "table--boss-table" : "",
    dogOnTable ? "table--dog-table" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const lastEvent = view.events[view.events.length - 1];
  const eventText = lastEvent
    ? describeEvent(
        lastEvent,
        view.players.map((player) => ({
          id: player.id,
          name: player.id === myId ? "你" : "对方"
        }))
      )
    : "";

  const renderOpponent = (player: (typeof opponents)[number], extra = "") => (
    <PlayerSeat
      key={player.id}
      player={player}
      currentRaid={view.raid}
      isCurrent={view.currentPlayerId === player.id}
      hasDog={view.dogHolderId === player.id}
      chatText={bubbles[player.id]?.text}
      eligibleTileIds={eligibleLoot.get(player.id)}
      onTileClick={(tileId) => onLootTile(player.id, tileId)}
      className={extra}
    />
  );

  const turnText =
    view.phase === "RAID_END"
      ? "本轮结束，正在整理赃物"
      : view.phase === "GAME_END"
        ? "牌局结束，开始结算"
        : pending
          ? pendingMine
            ? "轮到你做选择"
            : `等待 ${view.players.find((player) => player.id === pending.actorId)?.name ?? "对手"} 做选择`
          : myTurn
            ? "轮到你出牌"
            : `${currentPlayer?.name ?? "对手"} 出牌中`;

  const nextRaid = view.raid < 4 ? RAID_INFO[(view.raid + 1) as 1 | 2 | 3 | 4] : null;

  const usedMiddleTiles = new Set<string>();
  const middleSlots = MIDDLE_SLOTS.map((slot, index) => {
    const tile = view.middle.find(
      (candidate) =>
        !usedMiddleTiles.has(candidate.id) &&
        candidate.kind === slot.kind &&
        candidate.value === slot.value
    );
    if (tile) usedMiddleTiles.add(tile.id);
    return { slot, tile, key: `${slot.kind}-${slot.value}-${index}` };
  });

  const bossLosses = view.events.flatMap((event) => {
    if (event.type !== "bossLost") return [];
    const name = view.players.find((player) => player.id === event.playerId)?.name ?? "有人";
    return [{ key: `${event.playerId}-${event.tile.id}`, name }];
  });

  return (
    <div className="game">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="brand__mark brand__mark--small">AR</span>
          <span className="topbar__title">神偷大盗</span>
        </div>

        <div className="topbar__center">
          <span className="room-chip">房间 {view.code}</span>
          <div className="raid-progress" aria-label={`第 ${view.raid} 轮，共 4 轮`}>
            {[1, 2, 3, 4].map((raid) => (
              <span
                key={raid}
                className={[
                  "raid-progress__seg",
                  raid < view.raid ? "is-done" : "",
                  raid === view.raid ? "is-active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <i />
                <em>{RAID_INFO[raid as 1 | 2 | 3 | 4].name}</em>
              </span>
            ))}
          </div>
        </div>

        <div className="topbar__actions">
          <span className={connected ? "conn conn--live" : "conn"} title={connected ? "已连接" : "重连中"}>
            <i />
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              sound.unlock();
              if (!muted) sound.play("click");
              const next = sound.toggle();
              setMuted(next);
            }}
            aria-label={muted ? "开启音效" : "关闭音效"}
            title={muted ? "开启音效" : "关闭音效"}
          >
            {muted ? <SoundOffIcon size={20} /> : <SoundOnIcon size={20} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              sound.play("click");
              setLogOpen(true);
            }}
            aria-label="最近动作"
            title="最近动作"
          >
            <FeedIcon size={20} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              sound.play("click");
              onRules();
            }}
            aria-label="规则"
            title="规则"
          >
            <RulesIcon size={20} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              sound.play("click");
              api.leave();
            }}
            aria-label="离开牌桌"
            title="离开牌桌"
          >
            <LeaveIcon size={20} />
          </button>
        </div>
      </header>

      <main className="game__board">
        <section
          className="opponents"
          data-count={topOpponents.length}
          aria-label="对手"
        >
          {topOpponents.map((player) => renderOpponent(player))}
        </section>

        <div
          className={[
            "table-zone",
            sideOpponents.length > 0 ? "table-zone--with-sides" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {sideOpponents[0] &&
            renderOpponent(sideOpponents[0], "seat--side seat--side-left")}

            <section className={tableClassName} aria-label="牌桌中央">
            <div className="table__round">
              <span className="table__round-index">0{view.raid}</span>
              <div className="table__round-copy">
                <p className="eyebrow">RAID {view.raid} / 4</p>
                <h2>
                  {raidInfo.name}
                  <span>{raidInfo.en}</span>
                </h2>
              </div>
              <span
                key={`${view.currentPlayerId ?? "none"}-${pending?.kind ?? "none"}`}
                className={[
                  "turn-pill",
                  myTurn ? "turn-pill--you" : "",
                  pendingMine ? "turn-pill--choose" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="status"
                aria-live="polite"
              >
                <i />
                {turnText}
              </span>
              <span className="table__round-icon" aria-hidden="true">
                <RaidIcon raid={view.raid} size={42} />
              </span>
            </div>
  
            <div className="table__center" data-discard>
              <div className="table__middle" data-middle>
                {middleSlots.map(({ slot, tile, key }) =>
                  tile ? (
                    <LootTile
                      key={key}
                      tile={tile}
                      eligible={eligibleMiddle.has(tile.id)}
                      disabled={!eligibleMiddle.has(tile.id)}
                      onClick={
                        eligibleMiddle.has(tile.id) ? () => onMiddleTile(tile.id) : undefined
                      }
                      className="tile--enter"
                    />
                  ) : (
                    <span
                      className="table__slot-empty"
                      key={key}
                      aria-label={`${slot.kind === "boss" ? "老板" : `数字 ${slot.value}`} 已取走`}
                    />
                  )
                )}
              </div>
            </div>
  
            {(eventText || view.notice) && (
              <div className="table__bottom-rail" aria-live="polite">
                {eventText && <span className="table__event">{eventText}</span>}
                {view.notice && <span className="table__notice">{view.notice}</span>}
              </div>
            )}
            </section>

          {sideOpponents[1] &&
            renderOpponent(sideOpponents[1], "seat--side seat--side-right")}
        </div>

        <section className="you-area" aria-label="你的手牌与赃物">
          <PendingPanel
            view={view}
            myId={myId}
            now={now}
            onDogResponse={api.dogResponse}
          />

          <div
            className={[
              "hand-wrap",
              view.currentPlayerId === myId ? "is-current" : "",
              myCurrentBoss ? "is-boss-holder" : "",
              view.dogHolderId === myId ? "is-dog-holder" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="player-console">
              <div className="player-console__head">
                <span className="player-console__name">{myPlayer?.name ?? "你"}</span>
                <span className="player-console__meta">
                  本轮 {myPoints} 分 · {myAlibi} 白点
                </span>
                {myCurrentBoss && (
                  <span className="holder-seal holder-seal--boss" title="持有老板">
                    <BossIcon size={18} />
                    <b>老板</b>
                  </span>
                )}
                {view.dogHolderId === myId && (
                  <span className="holder-seal holder-seal--dog" title="持有看门狗">
                    <DogIcon size={18} />
                    <b>看门狗</b>
                  </span>
                )}
                <button
                  className="chat-trigger"
                  type="button"
                  onClick={() => {
                    sound.play("click");
                    setChatOpen((open) => !open);
                  }}
                  aria-label="快捷语"
                  aria-expanded={chatOpen}
                >
                  <ChatIcon size={18} />
                  <span>快捷语</span>
                </button>
                <div className="hand-meta hand-meta--inline">
                  {myTurn && (
                    <span className="self-turn">
                      <i />
                      轮到你出牌
                    </span>
                  )}
                  {pendingMine && (
                    <span className="self-turn self-turn--choice">
                      <i />
                      轮到你选择
                    </span>
                  )}
                  {selectedCard && (
                    <span className="hand-meta__label">已选：{cardLabel(selectedCard)}</span>
                  )}
                  {selectedCard && myTurn && (
                    <button
                      className="btn btn--primary btn--compact"
                      type="button"
                      onClick={playSelected}
                    >
                      打出这张牌
                    </button>
                  )}
                  {!myTurn && !pending && view.phase === "PLAYING" && (
                    <span className="hand-meta__wait">等对手出牌</span>
                  )}
                </div>
              </div>
              <div className="player-console__body">
                <div className="player-console__loot" data-loot={myId}>
                  {myLoot.length === 0 ? (
                    <span className="player-console__empty">还没有赃物</span>
                  ) : (
                    myLoot.map((tile) => (
                      <LootTile key={tile.id} tile={tile} size="sm" />
                    ))
                  )}
                  <VaultStacks tiles={myAllLoot.filter((tile) => tile.secured)} />
                </div>

                <div
                  className={["hand", myTurn ? "is-active" : ""].filter(Boolean).join(" ")}
                  data-hand="you"
                >
                  {view.you?.hand.map((card, index) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      selected={card.id === selectedCardId}
                      disabled={!myTurn}
                      onClick={
                        myTurn
                          ? () => {
                              sound.play("select");
                              setSelectedCardId(card.id);
                            }
                          : undefined
                      }
                      onDoubleClick={
                        myTurn
                          ? () => {
                              sound.play("click");
                              api.playCard(card.id);
                            }
                          : undefined
                      }
                      style={dealing ? { animationDelay: `${index * 45}ms` } : undefined}
                      className={dealing ? "card--deal" : ""}
                    />
                  ))}
                </div>
              </div>
            </div>

            {bubbles[myId]?.text && (
              <div className="chat-bubble chat-bubble--self" role="status">
                {bubbles[myId].text}
              </div>
            )}

            {chatOpen && (
              <div className="quick-chat" role="menu" aria-label="快捷语">
                <div className="quick-chat__head">
                  <span>快捷语</span>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    aria-label="关闭快捷语"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                {QUICK_CHAT.map((phrase) => (
                  <button
                    className="quick-chat__item"
                    type="button"
                    role="menuitem"
                    key={phrase.id}
                    onClick={() => {
                      playChatAudio(phrase.audio);
                      api.sendChat(phrase.id);
                      setChatOpen(false);
                    }}
                  >
                    {phrase.text}
                  </button>
                ))}
              </div>
            )}

            <p className="hand-hint">
              {myTurn
                ? "点一张牌选中，再点“打出”；也可以双击直接打出。按 Enter 确认，Esc 取消。"
                : pendingMine
                  ? "先完成上面的选择，才能继续。"
                  : "牌桌上的圆片和分数都是公开的，手牌只有你自己能看到。"}
            </p>
          </div>
        </section>
      </main>

      <ActionLayer view={view} myId={myId} />

      {view.phase === "RAID_END" && (
        <div className="round-overlay" key={`raid-${view.raid}`} role="status">
          <div className="round-overlay__card">
            <p className="eyebrow">RAID {view.raid} COMPLETE</p>
            <span className="round-overlay__number">0{view.raid}</span>
            <h2>{raidInfo.name}，分完了</h2>
            <p>{nextRaid ? `下一轮：${nextRaid.name}。手里的牌留着，牌堆不洗。` : "四轮结束，开始结算。"}</p>
            {bossLosses.length > 0 && (
              <div className="round-overlay__boss">
                <p className="round-overlay__boss-title">
                  <BossIcon size={18} />
                  老板失效 · {bossLosses.map((item) => item.name).join("、")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {view.phase === "GAME_END" && (
        <GameOver view={view} myId={myId} onRematch={api.rematch} onLeave={api.leave} />
      )}

      <ActionLogModal
        open={logOpen}
        entries={log}
        onClose={() => setLogOpen(false)}
      />
    </div>
  );
}

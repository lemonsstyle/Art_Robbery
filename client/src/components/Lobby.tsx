import { useEffect, useRef, useState } from "react";
import { MAX_PLAYERS, type GameView } from "@steal/shared";
import { CheckIcon, CopyIcon, LeaveIcon, LinkIcon, RulesIcon } from "./Icons";
import { copyText } from "../lib/clipboard";

interface LobbyProps {
  view: GameView;
  myId: string;
  onStart: () => void;
  onLeave: () => void;
  onRules: () => void;
}

export function Lobby({ view, myId, onStart, onLeave, onRules }: LobbyProps) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const me = view.players.find((player) => player.id === myId);
  const isHost = view.hostId === myId;
  const connectedCount = view.players.filter((player) => player.connected).length;
  const invite = `${location.origin}/?room=${view.code}`;

  useEffect(() => {
    if (!manualText) return;
    manualRef.current?.focus();
    manualRef.current?.select();
  }, [manualText]);

  const copy = async (kind: "link" | "code", text: string) => {
    const success = await copyText(text);
    if (!success) {
      setCopied(null);
      setManualText(text);
      setCopyHint("浏览器拦截了自动复制，请在下面手动复制：");
      return;
    }
    const message = kind === "link" ? "邀请链接已复制" : "房间码已复制";
    setCopied(kind);
    setCopyHint(message);
    setManualText(null);
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1800);
    window.setTimeout(() => setCopyHint((current) => (current === message ? null : current)), 2200);
  };

  return (
    <div className="lobby">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="brand__mark brand__mark--small">AR</span>
          <span className="topbar__title">神偷大盗</span>
        </div>
        <div className="topbar__center">
          <span className="room-chip">房间 {view.code}</span>
        </div>
        <div className="topbar__actions">
          <button className="icon-button" type="button" onClick={onRules} aria-label="规则">
            <RulesIcon size={20} />
          </button>
          <button className="icon-button" type="button" onClick={onLeave} aria-label="离开房间">
            <LeaveIcon size={20} />
          </button>
        </div>
      </header>

      <main className="lobby__main">
        <section className="lobby__intro">
          <p className="eyebrow">ROOM {view.code} · PRIVATE TABLE</p>
          <h1>
            等朋友
            <br />
            到齐。
          </h1>
          <p className="lobby__copy">
            把房间码或邀请链接发给他们。人齐之后，由房主开始分赃。
          </p>

          <div className="invite">
            <span className="invite__code" aria-label={`房间码 ${view.code}`}>
              {view.code}
            </span>
            <div className="invite__actions">
              <button
                className="btn btn--primary btn--compact"
                type="button"
                onClick={() => copy("link", invite)}
              >
                {copied === "link" ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
                {copied === "link" ? "已复制链接" : "复制邀请链接"}
              </button>
              <button
                className="btn btn--quiet btn--compact"
                type="button"
                onClick={() => copy("code", view.code)}
              >
                {copied === "code" ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
                {copied === "code" ? "已复制房间码" : "只复制房间码"}
              </button>
            </div>
            {copyHint && (
              <p className="lobby__copy-hint" role="status">
                {copyHint}
              </p>
            )}
            {manualText && (
              <div className="copy-fallback">
                <input
                  ref={manualRef}
                  readOnly
                  value={manualText}
                  aria-label="手动复制内容"
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                />
              </div>
            )}
          </div>

          <div className="lobby__steps">
            <div>
              <span>01</span>
              <p>等 2–5 人就位</p>
            </div>
            <div>
              <span>02</span>
              <p>房主开始牌局</p>
            </div>
            <div>
              <span>03</span>
              <p>四轮之后，分最高者胜</p>
            </div>
          </div>
        </section>

        <section className="lobby__seats" aria-label="玩家席位">
          <div className="lobby__seats-head">
            <h2>桌边的人</h2>
            <span>{connectedCount} / {MAX_PLAYERS}</span>
          </div>
          <ul className="seat-list">
            {Array.from({ length: MAX_PLAYERS }, (_, index) => {
              const player = view.players[index];
              if (!player) {
                return (
                  <li className="seat-row seat-row--empty" key={`empty-${index}`}>
                    <span className="seat-row__avatar">+</span>
                    <span className="seat-row__name">等待朋友…</span>
                  </li>
                );
              }
              return (
                <li
                  className={[
                    "seat-row",
                    player.id === myId ? "seat-row--you" : "",
                    player.connected ? "" : "seat-row--offline"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={player.id}
                >
                  <span className="seat-row__avatar" aria-hidden="true">
                    {player.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="seat-row__name">
                    {player.name}
                    {player.id === myId && <em>你</em>}
                  </span>
                  <span className="seat-row__tags">
                    {player.isHost && <span className="tag">房主</span>}
                    <span className={player.connected ? "tag tag--live" : "tag tag--off"}>
                      {player.connected ? "已就位" : "离线"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="lobby__action">
            {isHost ? (
              <>
                <button
                  className="btn btn--primary btn--wide"
                  type="button"
                  onClick={onStart}
                  disabled={connectedCount < 2}
                >
                  {connectedCount < 2 ? "至少需要 2 人" : "开始分赃"}
                </button>
                <p className="lobby__hint">
                  {me?.name}，你是房主。开始后手牌会立刻发到每个人手里。
                </p>
              </>
            ) : (
              <>
                <div className="lobby__waiting" role="status">
                  <span className="dot dot--live" />
                  等待房主开始…
                </div>
                <p className="lobby__hint">可以先点右上角的规则，熟悉一下四轮流程。</p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { Landing } from "./components/Landing";
import { Lobby } from "./components/Lobby";
import { GameTable } from "./components/GameTable";
import { RulesModal } from "./components/RulesModal";
import { CloseIcon } from "./components/Icons";
import { sound } from "./lib/sound";

function ReconnectSplash({
  connected,
  onCancel
}: {
  connected: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="splash">
      <div className="splash__mark">AR</div>
      <p className="eyebrow">ART ROBBERY</p>
      <h1>正在回到牌桌</h1>
      <p className="splash__copy">
        {connected ? "正在恢复你的座位和手牌…" : "服务器连接中，稍等一下。"}
      </p>
      <span className="splash__spinner" aria-hidden="true" />
      <button className="text-link" type="button" onClick={onCancel}>
        取消，回到首页
      </button>
    </div>
  );
}

export default function App() {
  const api = useSocket();
  const [rulesOpen, setRulesOpen] = useState(false);
  const view = api.view;
  const session = api.session;

  useEffect(() => {
    if (!api.error) return;
    sound.play("error");
    const timer = window.setTimeout(() => api.dismissError(), 6000);
    return () => window.clearTimeout(timer);
  }, [api.error]);

  return (
    <div className="app">
      {!view && session && (
        <ReconnectSplash connected={api.connected} onCancel={api.leave} />
      )}

      {!view && !session && (
        <Landing
          connected={api.connected}
          onCreate={(name) => {
            sound.unlock();
            sound.play("click");
            api.create(name);
          }}
          onJoin={(code, name) => {
            sound.unlock();
            sound.play("click");
            api.join(code, name);
          }}
          onRules={() => {
            sound.play("click");
            setRulesOpen(true);
          }}
        />
      )}

      {view && session && view.phase === "LOBBY" && (
        <Lobby
          view={view}
          myId={session.playerId}
          onStart={() => {
            sound.play("click");
            api.start();
          }}
          onLeave={() => {
            sound.play("click");
            api.leave();
          }}
          onRules={() => {
            sound.play("click");
            setRulesOpen(true);
          }}
        />
      )}

      {view && session && view.phase !== "LOBBY" && (
        <GameTable
          view={view}
          myId={session.playerId}
          connected={api.connected}
          api={api}
          onRules={() => setRulesOpen(true)}
        />
      )}

      {api.error && (
        <div className="toast toast--error" role="alert">
          <span>{api.error}</span>
          <button type="button" onClick={api.dismissError} aria-label="关闭提示">
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

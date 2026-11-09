import { useMemo, useState } from "react";
import { CardBack } from "./PlayingCard";
import { RulesIcon } from "./Icons";
import { savedName } from "../hooks/useSocket";

interface LandingProps {
  connected: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onRules: () => void;
}

export function Landing({ connected, onCreate, onJoin, onRules }: LandingProps) {
  const initialCode = useMemo(() => {
    const room = new URLSearchParams(location.search).get("room");
    return room ? room.toUpperCase().slice(0, 4) : "";
  }, []);
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(initialCode);
  const [hint, setHint] = useState("");

  const requireName = (): boolean => {
    if (!name.trim()) {
      setHint("先给自己起个名字。");
      return false;
    }
    setHint("");
    return true;
  };

  return (
    <div className="landing">
      <section className="landing__hero">
        <div className="landing__shapes" aria-hidden="true">
          <span className="shape shape--disc" />
          <span className="shape shape--arc" />
          <span className="shape shape--line" />
          <span className="shape shape--block" />
        </div>

        <header className="brand">
          <span className="brand__mark">AR</span>
          <span className="brand__name">神偷大盗</span>
          <span className="brand__rule" />
          <span className="brand__meta">ART ROBBERY</span>
        </header>

        <div className="landing__headline">
          <p className="eyebrow">A GAME OF SHARING THE SPOILS</p>
          <h1>
            神偷
            <br />
            大盗
          </h1>
          <p className="landing__english">ART ROBBERY</p>
          <p className="landing__tagline">
            赃物已经到手。
            <br />
            现在，最难的是分赃。
          </p>
          <div className="landing__facts">
            <span>2–5 人</span>
            <span>约 20 分钟</span>
            <span>8 岁以上</span>
          </div>
        </div>

        <div className="landing__stack" aria-hidden="true">
          <CardBack className="landing__stack-card landing__stack-card--left" />
          <CardBack className="landing__stack-card landing__stack-card--right" />
          <CardBack className="landing__stack-card landing__stack-card--center" />
        </div>
      </section>

      <section className="landing__panel">
        <div className="panel panel--enter">
          <div className="panel__heading">
            <p className="eyebrow">PRIVATE TABLE · 朋友局</p>
            <h2>进入今晚的局</h2>
            <p className="panel__copy">开一间房，把链接发给朋友。2 到 5 个人就能开局。</p>
          </div>

          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!requireName()) return;
              onCreate(name.trim());
            }}
          >
            <label className="field">
              <span className="field__label">你的名字</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：阿飞"
                maxLength={16}
                autoComplete="nickname"
                autoFocus
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={!connected}>
              {connected ? "开一间新房" : "正在连接服务器…"}
            </button>
          </form>

          <div className="divider">
            <span>或者加入朋友的房间</span>
          </div>

          <form
            className="form form--join"
            onSubmit={(event) => {
              event.preventDefault();
              if (!requireName()) return;
              if (code.length !== 4) {
                setHint("房间码是 4 个字母。");
                return;
              }
              onJoin(code, name.trim());
            }}
          >
            <label className="field">
              <span className="field__label">房间码</span>
              <input
                className="input input--code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))
                }
                placeholder="ABCD"
                maxLength={4}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button className="btn btn--ghost" type="submit" disabled={!connected}>
              加入房间
            </button>
          </form>

          {hint && <p className="form__hint" role="status">{hint}</p>}

          <button className="text-link" type="button" onClick={onRules}>
            <RulesIcon size={18} />
            先看看怎么玩
          </button>
        </div>

        <footer className="landing__footer">
          <span>一个关于贪婪、狗和不在场证明的分赃游戏</span>
          <span className={connected ? "dot dot--live" : "dot"} />
          <span>{connected ? "服务器在线" : "正在重连"}</span>
        </footer>
      </section>
    </div>
  );
}

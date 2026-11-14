import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, GameView } from "@steal/shared";

const SESSION_KEY = "art-robbery.session.v1";
const NAME_KEY = "art-robbery.name.v1";

export interface Session {
  code: string;
  playerId: string;
  token: string;
  name: string;
}

export interface SocketApi {
  connected: boolean;
  booting: boolean;
  view: GameView | null;
  session: Session | null;
  chat: ChatMessage | null;
  error: string | null;
  dismissError: () => void;
  create: (name: string) => void;
  join: (code: string, name: string) => void;
  start: () => void;
  playCard: (cardId: string) => void;
  chooseTile: (tileId: string) => void;
  chooseSteal: (playerId: string) => void;
  chooseGreedy: (tileId: string) => void;
  dogResponse: (giveDog: boolean) => void;
  sendChat: (messageId: string) => void;
  rematch: () => void;
  leave: () => void;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.code === "string" &&
      typeof parsed.playerId === "string" &&
      typeof parsed.token === "string" &&
      typeof parsed.name === "string"
    ) {
      return parsed as Session;
    }
  } catch {
    return null;
  }
  return null;
}

export function savedName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

function socketUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV && location.port === "5173") {
    return `${protocol}//${location.hostname}:8787/ws`;
  }
  return `${protocol}//${location.host}/ws`;
}

export function useSocket(): SocketApi {
  const [connected, setConnected] = useState(false);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<GameView | null>(null);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const awaitingRejoin = useRef(false);
  const revoked = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("连接断开了，正在重连…");
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sessionRef.current = null;
    setSession(null);
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry = 0;
    let reconnectTimer: number | undefined;
    let bootTimer: number | undefined;

    const connect = () => {
      if (disposed || revoked.current) return;
      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        setConnected(true);
        setBooting(false);
        retry = 0;
        const current = sessionRef.current;
        if (current) {
          awaitingRejoin.current = true;
          socket.send(
            JSON.stringify({
              type: "rejoin",
              code: current.code,
              playerId: current.playerId,
              token: current.token
            })
          );
        }
      };

      socket.onmessage = (event) => {
        let message: { type?: string; [key: string]: unknown };
        try {
          message = JSON.parse(event.data as string) as typeof message;
        } catch {
          return;
        }
        switch (message.type) {
          case "session": {
            const next: Session = {
              code: String(message.code ?? ""),
              playerId: String(message.playerId ?? ""),
              token: String(message.token ?? ""),
              name: String(message.name ?? "")
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(next));
            sessionRef.current = next;
            awaitingRejoin.current = false;
            setChat(null);
            setSession(next);
            break;
          }
          case "state":
            awaitingRejoin.current = false;
            setView(message.view as GameView);
            setBooting(false);
            break;
          case "chat":
            setChat(message as unknown as ChatMessage);
            break;
          case "error": {
            const text = String(message.message ?? "操作失败");
            setError(text);
            if (
              awaitingRejoin.current &&
              sessionRef.current &&
              /房间不存在|无法恢复|座位/.test(text)
            ) {
              awaitingRejoin.current = false;
              clearSession();
              setView(null);
              setBooting(false);
            }
            break;
          }
          case "left":
            awaitingRejoin.current = false;
            setChat(null);
            clearSession();
            setView(null);
            break;
          case "superseded":
            revoked.current = true;
            awaitingRejoin.current = false;
            sessionRef.current = null;
            setChat(null);
            setSession(null);
            setView(null);
            setBooting(false);
            setError("这个座位已在另一个窗口打开，请使用那个窗口");
            socket.close();
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        if (disposed || revoked.current) return;
        setConnected(false);
        const delay = Math.min(5000, 400 * 2 ** retry);
        retry += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();
    bootTimer = window.setTimeout(() => {
      if (!disposed) setBooting(false);
    }, 2500);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (bootTimer) clearTimeout(bootTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [clearSession]);

  const create = useCallback(
    (name: string) => {
      localStorage.setItem(NAME_KEY, name);
      send({ type: "create", name });
    },
    [send]
  );

  const join = useCallback(
    (code: string, name: string) => {
      localStorage.setItem(NAME_KEY, name);
      send({ type: "join", code: code.trim().toUpperCase(), name });
    },
    [send]
  );

  const leave = useCallback(() => {
    send({ type: "leave" });
    clearSession();
    setView(null);
  }, [clearSession, send]);

  return {
    connected,
    booting,
    view,
    session,
    chat,
    error,
    dismissError: () => setError(null),
    create,
    join,
    start: () => send({ type: "start" }),
    playCard: (cardId) => send({ type: "play", cardId }),
    chooseTile: (tileId) => send({ type: "chooseTile", tileId }),
    chooseSteal: (playerId) => send({ type: "chooseSteal", playerId }),
    chooseGreedy: (tileId) => send({ type: "chooseGreedy", tileId }),
    dogResponse: (giveDog) => send({ type: "dogResponse", giveDog }),
    sendChat: (messageId) => send({ type: "quickChat", messageId }),
    rematch: () => send({ type: "rematch" }),
    leave
  };
}

import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { startServer } from "../src/index";

interface Message {
  type: string;
  [key: string]: unknown;
}

class Peer {
  readonly socket: WebSocket;
  private readonly queue: Message[] = [];

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      this.queue.push(JSON.parse(raw.toString()) as Message);
    });
  }

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket.once("open", () => resolve());
      this.socket.once("error", reject);
    });
  }

  send(message: Record<string, unknown>): void {
    this.socket.send(JSON.stringify(message));
  }

  async next(type: string, timeout = 4000): Promise<Message> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const index = this.queue.findIndex((message) => message.type === type);
      if (index >= 0) return this.queue.splice(index, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`timed out waiting for ${type}`);
  }

  close(): void {
    this.socket.close();
  }
}

async function stateWithPhase(peer: Peer, phase: string): Promise<Message> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const message = await peer.next("state");
    const view = message.view as { phase: string };
    if (view.phase === phase) return message;
  }
  throw new Error(`no state in phase ${phase}`);
}

async function stateWithEvent(peer: Peer, type: string): Promise<Message> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const message = await peer.next("state");
    const view = message.view as { events: Array<{ type: string }> };
    if (view.events.some((event) => event.type === type)) return message;
  }
  throw new Error(`no state with event ${type}`);
}

const apps: Array<ReturnType<typeof startServer>> = [];

afterEach(async () => {
  while (apps.length) {
    const app = apps.pop();
    await app?.close();
  }
});

describe("websocket flow", () => {
  it("supersedes the older socket when the same seat rejoins", async () => {
    const app = startServer(0, "127.0.0.1");
    apps.push(app);
    if (!app.server.listening) {
      await new Promise<void>((resolve) => app.server.once("listening", () => resolve()));
    }
    const port = (app.server.address() as AddressInfo).port;
    const url = `ws://127.0.0.1:${port}/ws`;
    const a = new Peer(url);
    await a.open();
    a.send({ type: "create", name: "原窗口" });
    const session = await a.next("session");
    await a.next("state");

    const b = new Peer(url);
    await b.open();
    b.send({
      type: "rejoin",
      code: session.code,
      playerId: session.playerId,
      token: session.token
    });
    await b.next("session");
    await b.next("state");
    const superseded = await a.next("superseded");
    expect(superseded.type).toBe("superseded");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(a.socket.readyState).not.toBe(WebSocket.OPEN);

    a.close();
    b.close();
  });

  it("creates a room, joins, starts and plays a card", async () => {
    const app = startServer(0, "127.0.0.1");
    apps.push(app);
    if (!app.server.listening) {
      await new Promise<void>((resolve) => app.server.once("listening", () => resolve()));
    }
    const port = (app.server.address() as AddressInfo).port;
    const url = `ws://127.0.0.1:${port}/ws`;
    const a = new Peer(url);
    const b = new Peer(url);
    await Promise.all([a.open(), b.open()]);

    a.send({ type: "create", name: "阿飞" });
    const sessionA = await a.next("session");
    await a.next("state");
    expect(sessionA.code).toMatch(/^[A-Z]{4}$/);

    b.send({ type: "join", code: sessionA.code, name: "小满" });
    await b.next("session");
    const lobby = await b.next("state");
    expect((lobby.view as { players: unknown[] }).players).toHaveLength(2);

    a.send({ type: "start" });
    const stateA = await stateWithPhase(a, "PLAYING");
    const stateB = await stateWithPhase(b, "PLAYING");
    const viewA = stateA.view as {
      phase: string;
      currentPlayerId: string;
      you: { hand: Array<{ id: string }> };
    };
    const viewB = stateB.view as {
      phase: string;
      currentPlayerId: string;
      you: { hand: Array<{ id: string }> };
    };
    expect(viewA.phase).toBe("PLAYING");
    expect(viewA.you.hand).toHaveLength(5);
    expect(viewB.you.hand).toHaveLength(5);

    const currentId = viewA.currentPlayerId;
    const currentView = currentId === sessionA.playerId ? viewA : viewB;
    const currentPeer = currentId === sessionA.playerId ? a : b;
    const card = currentView.you.hand[0];
    currentPeer.send({ type: "play", cardId: card.id });

    const played = [await stateWithEvent(a, "play"), await stateWithEvent(b, "play")];
    const playedView = played[0].view as { events: Array<{ type: string }>; phase: string };
    expect(playedView.phase).toBe("PLAYING");
    expect(playedView.events.some((event) => event.type === "play")).toBe(true);

    a.send({ type: "quickChat", messageId: "praise" });
    const chats = await Promise.all([a.next("chat"), b.next("chat")]);
    expect(chats[0].text).toBe("你打的牌也太好啦！");
    expect(chats[1].playerId).toBe(sessionA.playerId);

    a.close();
    b.close();
  });
});

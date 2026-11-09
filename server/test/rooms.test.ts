import { describe, expect, it } from "vitest";
import { RoomStore } from "../src/rooms";
import { Game } from "@steal/shared";

describe("RoomStore", () => {
  it("creates a four-letter room and assigns the host", () => {
    const store = new RoomStore();
    const { room, player } = store.create("阿飞");
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.hostId).toBe(player.id);
    expect(player.connected).toBe(true);
    expect(store.buildView(room, player.id).phase).toBe("LOBBY");
  });

  it("accepts five players and rejects the sixth", () => {
    const store = new RoomStore();
    const { room } = store.create("P1");
    for (let index = 2; index <= 5; index += 1) {
      store.join(room.code, `P${index}`);
    }
    expect(room.players).toHaveLength(5);
    expect(() => store.join(room.code, "P6")).toThrow("房间已满");
  });

  it("rejects duplicate names and restores a seat with the right token", () => {
    const store = new RoomStore();
    const { room, player } = store.create("阿飞");
    expect(() => store.join(room.code, "阿飞")).toThrow("名字已经有人用了");
    expect(() => store.rejoin(room.code, player.id, "wrong")).toThrow("无法恢复座位");
    const restored = store.rejoin(room.code, player.id, player.token);
    expect(restored.player.id).toBe(player.id);
  });

  it("transfers host to a connected player when a new player joins after the host leaves", () => {
    const store = new RoomStore();
    const { room } = store.create("旧房主");
    room.players[0].connected = false;
    const { player } = store.join(room.code, "新房主");
    expect(room.hostId).toBe(player.id);
  });

  it("starts a game with the connected seats", () => {
    const store = new RoomStore();
    const { room } = store.create("P1");
    store.join(room.code, "P2");
    const seats = store.seatsFor(room);
    const game = new Game(room.code, seats, { hostId: room.hostId });
    expect(game.players).toHaveLength(2);
    expect(game.getView(seats[0].id).phase).toBe("PLAYING");
  });
});

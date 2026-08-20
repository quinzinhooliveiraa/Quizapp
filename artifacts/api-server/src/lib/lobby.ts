import type { WebSocket } from "ws";
import crypto from "node:crypto";

export type GameMode = "both" | "turn";
export type LobbyPhase = "waiting" | "playing" | "revealing";

export interface LobbyPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  identity: "owner" | "guest" | "unknown";
  currentAnswer: string | null;
  hasSubmittedThisRound: boolean;
}

export interface Lobby {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  mode: GameMode;
  phase: LobbyPhase;
  themeId: string | null;
  currentQuestionId: string | null;
  currentTurnPlayerId: string | null;
  seenQuestionIds: string[];
  createdAt: number;
}

export const lobbies = new Map<string, Lobby>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLobbyCode(): string {
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (lobbies.has(code));
  return code;
}

export function generatePlayerId(): string {
  return crypto.randomBytes(6).toString("hex");
}

export function broadcastToLobby(lobby: Lobby, message: object, excludeId?: string): void {
  const payload = JSON.stringify(message);
  lobby.players.forEach((player) => {
    if (player.id !== excludeId && player.ws.readyState === 1) {
      try { player.ws.send(payload); } catch { /* noop */ }
    }
  });
}

export function playerListPayload(lobby: Lobby) {
  return lobby.players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.id === lobby.hostId,
    identity: player.identity,
    hasSubmitted: player.hasSubmittedThisRound,
  }));
}

export function resetAnswers(lobby: Lobby): void {
  lobby.players.forEach((player) => {
    player.currentAnswer = null;
    player.hasSubmittedThisRound = false;
  });
}

export function reapEmptyLobbies(): void {
  const now = Date.now();
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  for (const [code, lobby] of lobbies.entries()) {
    if (lobby.players.length === 0 || now - lobby.createdAt > FOUR_HOURS) {
      lobbies.delete(code);
    }
  }
}
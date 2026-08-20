import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import {
  broadcastToLobby,
  generateLobbyCode,
  generatePlayerId,
  lobbies,
  playerListPayload,
  reapEmptyLobbies,
  resetAnswers,
  type GameMode,
  type Lobby,
} from "./lobby";
import { logger } from "./logger";

const MAX_PLAYERS = 8;
const MIN_TO_START = 2;

export function attachLobbyServer(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (path !== "/ws/lobby" && path !== "/api/ws/lobby") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  setInterval(reapEmptyLobbies, 30 * 60 * 1000);

  wss.on("connection", (ws: WebSocket) => {
    let currentLobby: Lobby | null = null;
    const playerId = generatePlayerId();
    logger.info({ playerId }, "WS connected");

    ws.on("message", (raw) => {
      let msg: { type?: string; [key: string]: unknown };
      try { msg = JSON.parse(raw.toString()) as { type?: string; [key: string]: unknown }; } catch { return; }

      if (msg.type === "create") {
        const mode: GameMode = msg.mode === "turn" ? "turn" : "both";
        const code = generateLobbyCode();
        const lobby: Lobby = {
          code,
          hostId: playerId,
          players: [{
            ws,
            id: playerId,
            name: String(msg.name || "").trim().slice(0, 40) || "Jogador",
            identity: (msg.identity === "owner" || msg.identity === "guest") ? msg.identity : "unknown",
            currentAnswer: null,
            hasSubmittedThisRound: false,
          }],
          mode,
          phase: "waiting",
          themeId: null,
          currentQuestionId: null,
          currentTurnPlayerId: null,
          seenQuestionIds: [],
          createdAt: Date.now(),
        };
        lobbies.set(code, lobby);
        currentLobby = lobby;
        logger.info({ code, mode, playerId }, "Lobby created");
        ws.send(JSON.stringify({
          type: "created",
          code,
          playerId,
          mode,
          players: playerListPayload(lobby),
        }));
      } else if (msg.type === "join") {
        const code = String(msg.code || "").trim().toUpperCase();
        logger.info({ code, playerId, lobbiesCount: lobbies.size }, "Join attempt");
        const lobby = lobbies.get(code);
        if (!lobby) {
          logger.warn({ code, availableLobbies: [...lobbies.keys()] }, "Lobby not found on join");
          ws.send(JSON.stringify({ type: "error", message: "Sala não encontrada. Confirme o código." }));
          return;
        }
        if (lobby.players.length >= MAX_PLAYERS) {
          ws.send(JSON.stringify({ type: "error", message: `Sala cheia (máx ${MAX_PLAYERS})` }));
          return;
        }
        if (lobby.phase !== "waiting") {
          ws.send(JSON.stringify({ type: "error", message: "Este jogo já começou. Peça pra criarem uma nova sala." }));
          return;
        }
        lobby.players.push({
          ws,
          id: playerId,
          name: String(msg.name || "").trim().slice(0, 40) || "Jogador",
          identity: (msg.identity === "owner" || msg.identity === "guest") ? msg.identity : "unknown",
          currentAnswer: null,
          hasSubmittedThisRound: false,
        });
        currentLobby = lobby;
        ws.send(JSON.stringify({
          type: "joined",
          code: lobby.code,
          playerId,
          hostId: lobby.hostId,
          mode: lobby.mode,
          themeId: lobby.themeId,
          players: playerListPayload(lobby),
        }));
        broadcastToLobby(lobby, { type: "player_joined", players: playerListPayload(lobby) }, playerId);
      } else if (msg.type === "set_theme" && currentLobby && currentLobby.hostId === playerId) {
        currentLobby.themeId = typeof msg.themeId === "string" ? msg.themeId : null;
        currentLobby.currentQuestionId = null;
        currentLobby.seenQuestionIds = [];
        resetAnswers(currentLobby);
        broadcastToLobby(currentLobby, { type: "theme_changed", themeId: currentLobby.themeId });
      } else if (msg.type === "start" && currentLobby && currentLobby.hostId === playerId) {
        if (currentLobby.players.length < MIN_TO_START) {
          ws.send(JSON.stringify({ type: "error", message: `Precisa de pelo menos ${MIN_TO_START} pessoas pra começar.` }));
          return;
        }
        if (!currentLobby.themeId) {
          ws.send(JSON.stringify({ type: "error", message: "Escolha um tema primeiro." }));
          return;
        }
        currentLobby.phase = "playing";
        currentLobby.currentTurnPlayerId = currentLobby.players[0].id;
        resetAnswers(currentLobby);
        broadcastToLobby(currentLobby, {
          type: "game_started",
          mode: currentLobby.mode,
          themeId: currentLobby.themeId,
          currentTurnPlayerId: currentLobby.currentTurnPlayerId,
          players: playerListPayload(currentLobby),
        });
      } else if (msg.type === "next_question" && currentLobby && currentLobby.phase !== "waiting") {
        const available: string[] = Array.isArray(msg.availableQuestionIds) ? msg.availableQuestionIds : [];
        if (available.length === 0) return;
        const unseen = available.filter((id) => !currentLobby!.seenQuestionIds.includes(id));
        const pool = unseen.length > 0 ? unseen : available;
        const next = pool[Math.floor(Math.random() * pool.length)];
        if (unseen.length === 0) currentLobby.seenQuestionIds = [];
        currentLobby.currentQuestionId = next;
        currentLobby.seenQuestionIds.push(next);
        currentLobby.phase = "playing";
        resetAnswers(currentLobby);

        if (currentLobby.mode === "turn") {
          const index = currentLobby.players.findIndex((player) => player.id === currentLobby!.currentTurnPlayerId);
          const nextIndex = index < 0 ? 0 : (index + 1) % currentLobby.players.length;
          currentLobby.currentTurnPlayerId = currentLobby.players[nextIndex].id;
        }

        broadcastToLobby(currentLobby, {
          type: "question_changed",
          questionId: next,
          themeId: currentLobby.themeId,
          currentTurnPlayerId: currentLobby.currentTurnPlayerId,
          players: playerListPayload(currentLobby),
        });
      } else if (msg.type === "submit_answer" && currentLobby && currentLobby.phase === "playing") {
        const answer = String(msg.answer || "").trim().slice(0, 1000);
        const player = currentLobby.players.find((item) => item.id === playerId);
        if (!player || player.hasSubmittedThisRound) return;

        if (currentLobby.mode === "turn" && playerId !== currentLobby.currentTurnPlayerId) {
          ws.send(JSON.stringify({ type: "error", message: "Não é sua vez ainda." }));
          return;
        }

        player.currentAnswer = answer;
        player.hasSubmittedThisRound = true;
        broadcastToLobby(currentLobby, {
          type: "player_submitted",
          playerId,
          playerName: player.name,
          players: playerListPayload(currentLobby),
        });

        const shouldReveal = currentLobby.mode === "turn"
          ? player.id === currentLobby.currentTurnPlayerId
          : currentLobby.players.every((item) => item.hasSubmittedThisRound);

        if (shouldReveal) {
          currentLobby.phase = "revealing";
          broadcastToLobby(currentLobby, {
            type: "answers_revealed",
            answers: currentLobby.players
              .filter((item) => item.currentAnswer !== null)
              .map((item) => ({ playerId: item.id, playerName: item.name, answer: item.currentAnswer })),
            questionId: currentLobby.currentQuestionId,
          });
        }
      } else if (msg.type === "leave") {
        removePlayer();
      }
    });

    ws.on("close", removePlayer);

    function removePlayer(): void {
      if (!currentLobby) return;
      currentLobby.players = currentLobby.players.filter((player) => player.id !== playerId);
      if (currentLobby.players.length === 0) {
        lobbies.delete(currentLobby.code);
      } else {
        if (currentLobby.hostId === playerId) {
          currentLobby.hostId = currentLobby.players[0].id;
        }
        broadcastToLobby(currentLobby, {
          type: "player_left",
          players: playerListPayload(currentLobby),
          hostId: currentLobby.hostId,
        });
      }
      currentLobby = null;
    }
  });

  logger.info({ path: "/ws/lobby" }, "Lobby WebSocket server attached");
}
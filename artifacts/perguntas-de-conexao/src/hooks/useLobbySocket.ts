import { useCallback, useEffect, useRef, useState } from 'react';

export type LobbyMode = 'both' | 'turn';
export type LobbyPhase = 'idle' | 'waiting' | 'playing' | 'revealing';
export type LobbyPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  identity?: 'owner' | 'guest' | 'unknown';
  hasSubmitted?: boolean;
};
export type LobbyAnswer = { playerId: string; playerName: string; answer: string };
export type LobbyEvent =
  | { type: 'created'; code: string; playerId: string; mode: LobbyMode; players: LobbyPlayer[] }
  | { type: 'joined'; code: string; playerId: string; hostId: string; mode: LobbyMode; themeId: string | null; players: LobbyPlayer[] }
  | { type: 'player_joined'; players: LobbyPlayer[] }
  | { type: 'player_left'; players: LobbyPlayer[]; hostId: string }
  | { type: 'theme_changed'; themeId: string | null }
  | { type: 'game_started'; mode: LobbyMode; themeId: string; currentTurnPlayerId: string; players: LobbyPlayer[] }
  | { type: 'question_changed'; questionId: string; themeId: string | null; currentTurnPlayerId: string | null; players: LobbyPlayer[] }
  | { type: 'player_submitted'; playerId: string; playerName: string; players: LobbyPlayer[] }
  | { type: 'answers_revealed'; answers: LobbyAnswer[]; questionId: string | null }
  | { type: 'error'; message: string };

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

function lobbyUrl() {
  const configured = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (configured) {
    try {
      const url = new URL(configured);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws/lobby';
      url.search = '';
      return url.toString();
    } catch {
      // Fall through to the current host when the environment value is not an absolute URL.
    }
  }
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/lobby`;
}

export function useLobbySocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [lastEvent, setLastEvent] = useState<LobbyEvent | null>(null);
  const [error, setError] = useState('');

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;
    setStatus('connecting');
    setError('');
    const socket = new WebSocket(lobbyUrl());
    socketRef.current = socket;
    socket.onopen = () => setStatus('open');
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as LobbyEvent;
        setLastEvent(message);
        if (message.type === 'error') {
          setError(message.message);
          setStatus('error');
        }
      } catch {
        setError('Recebemos uma mensagem inesperada.');
      }
    };
    socket.onerror = () => {
      setStatus('error');
      setError('Não foi possível encontrar a sala agora.');
    };
    socket.onclose = () => {
      setStatus('closed');
      socketRef.current = null;
    };
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    setError('A conexão ainda está chegando. Tente de novo em um instante.');
    return false;
  }, []);

  const create = useCallback((name: string, mode: LobbyMode, identity: string) => send({ type: 'create', name, mode, identity }), [send]);
  const join = useCallback((code: string, name: string, identity: string) => send({ type: 'join', code, name, identity }), [send]);
  const setTheme = useCallback((themeId: string) => send({ type: 'set_theme', themeId }), [send]);
  const start = useCallback(() => send({ type: 'start' }), [send]);
  const nextQuestion = useCallback((availableQuestionIds: string[]) => send({ type: 'next_question', availableQuestionIds }), [send]);
  const submitAnswer = useCallback((answer: string) => send({ type: 'submit_answer', answer }), [send]);
  const leave = useCallback(() => {
    send({ type: 'leave' });
    socketRef.current?.close();
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  return { status, error, lastEvent, connect, create, join, setTheme, start, nextQuestion, submitAnswer, leave };
}
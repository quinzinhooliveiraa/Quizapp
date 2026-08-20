import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Clipboard, Feather, Link2, LoaderCircle, LockKeyhole, MessageCircle, RotateCw, Send, Sparkles, Users, Wifi, WifiOff, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { questions, themes } from '@workspace/connection-content';
import { type LobbyEvent, type LobbyMode, type LobbyPlayer, useLobbySocket } from '@/hooks/useLobbySocket';
import { apiBaseUrl } from '@/config';

type View = 'entry' | 'lobby' | 'game';

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';

function ConnectionBadge({ status }: { status: 'connecting' | 'open' | 'closed' | 'error' }) {
  const labels = { connecting: 'conectando', open: 'conectado', closed: 'desconectado', error: 'atenção na conexão' };
  return <span className={`play-connection play-connection-${status}`} data-testid="status-connection"><i /> {labels[status]}</span>;
}

export default function Play() {
  const [, navigate] = useLocation();
  const socket = useLobbySocket();
  const [view, setView] = useState<View>('entry');
  const [entryMode, setEntryMode] = useState<'create' | 'join'>('create');
  const [mode, setMode] = useState<LobbyMode>('both');
  const [name, setName] = useState(() => localStorage.getItem('conexao-name') || '');
  const [code, setCode] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [hostId, setHostId] = useState('');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [themeId, setThemeId] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [turnPlayerId, setTurnPlayerId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState<{ playerId: string; playerName: string; answer: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const selectedTheme = useMemo(() => themes.find(theme => theme.id === themeId), [themeId]);
  const currentQuestion = useMemo(() => questions.find(question => question.id === questionId), [questionId]);
  const availableQuestionIds = useMemo(() => questions.filter(question => question.themeId === themeId).map(question => question.id), [themeId]);
  const me = players.find(player => player.id === playerId);
  const isHost = playerId === hostId || Boolean(me?.isHost);
  const submitted = Boolean(me?.hasSubmitted);
  const isMyTurn = mode === 'both' || turnPlayerId === playerId;
  const apiBase = apiBaseUrl;
  const sessionId = localStorage.getItem('conexao-session') || '';
  const guestToken = localStorage.getItem('conexao-guest-token') || '';

  useEffect(() => {
    const event = socket.lastEvent;
    if (!event) return;
    const applyPlayers = (items: LobbyPlayer[]) => setPlayers(items);
    const handleEvent = (message: LobbyEvent) => {
      if (message.type === 'created') {
        setView('lobby'); setLobbyCode(message.code); setPlayerId(message.playerId); setHostId(message.playerId); setMode(message.mode); applyPlayers(message.players);
      } else if (message.type === 'joined') {
        setView('lobby'); setLobbyCode(message.code); setPlayerId(message.playerId); setHostId(message.hostId); setMode(message.mode); setThemeId(message.themeId || ''); applyPlayers(message.players);
      } else if (message.type === 'player_joined') applyPlayers(message.players);
      else if (message.type === 'player_left') { applyPlayers(message.players); setHostId(message.hostId); }
      else if (message.type === 'theme_changed') setThemeId(message.themeId || '');
      else if (message.type === 'game_started') { setView('game'); setMode(message.mode); setThemeId(message.themeId); setTurnPlayerId(message.currentTurnPlayerId); applyPlayers(message.players); }
      else if (message.type === 'question_changed') { setView('game'); setQuestionId(message.questionId); setThemeId(message.themeId || ''); setTurnPlayerId(message.currentTurnPlayerId); setAnswers([]); setAnswer(''); applyPlayers(message.players); }
      else if (message.type === 'player_submitted') applyPlayers(message.players);
      else if (message.type === 'answers_revealed') setAnswers(message.answers);
      else if (message.type === 'error') setLocalError(message.message);
    };
    handleEvent(event);
  }, [socket.lastEvent]);

  useEffect(() => {
    if (socket.error) setLocalError(socket.error);
  }, [socket.error]);

  useEffect(() => {
    setSavedIds(new Set());
  }, [questionId]);

  const submitEntry = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) { setLocalError('Como vocês vão te chamar?'); return; }
    localStorage.setItem('conexao-name', cleanName);
    setLocalError('');
    if (entryMode === 'create') socket.create(cleanName, mode, localStorage.getItem('conexao-role') || 'unknown');
    else {
      const cleanCode = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
      if (cleanCode.length !== 5) { setLocalError('O código precisa ter 5 caracteres.'); return; }
      socket.join(cleanCode, cleanName, localStorage.getItem('conexao-role') || 'unknown');
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(lobbyCode).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }).catch(() => setLocalError('Não foi possível copiar o código.'));
  };
  const exit = () => { socket.leave(); navigate('/app'); };
  const sendAnswer = (event: FormEvent) => { event.preventDefault(); if (answer.trim() && isMyTurn) socket.submitAnswer(answer.trim()); };
  const chooseTheme = (id: string) => { setThemeId(id); socket.setTheme(id); };
  const saveMoment = async (item: { playerId: string; playerName: string; answer: string }) => {
    if (!currentQuestion || !themeId) return;
    const key = `${item.playerId}:${currentQuestion.id}`;
    if (savedIds.has(key)) return;
    if (!sessionId && !guestToken) {
      setLocalError('Entre na sua conta para guardar momentos.');
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          guestToken: guestToken || undefined,
          questionId: currentQuestion.id,
          themeId,
          fromPlayerName: item.playerName,
          answerText: item.answer,
          roomCode: lobbyCode,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setSavedIds(previous => new Set(previous).add(key));
    } catch {
      setLocalError('Não conseguimos guardar esse momento agora.');
    }
  };

  return <main className="play-page" data-testid="page-play">
    <div className="play-stars" aria-hidden="true"><span /><span /><span /></div>
    <header className="play-header">
      <Link href="/app" className="play-back" data-testid="link-back-app"><ArrowLeft size={16} /> Meu espaço</Link>
      <Link href="/" className="play-brand" data-testid="link-play-brand"><span><Feather size={16} /></span><b>Perguntas<br /><i>de Conexão</i></b></Link>
      <ConnectionBadge status={socket.status} />
    </header>
    {localError && <div className="play-alert" role="alert" data-testid="status-play-error"><span><WifiOff size={15} /> {localError}</span><button onClick={() => setLocalError('')} aria-label="Fechar aviso" data-testid="button-dismiss-play-error"><X size={15} /></button></div>}
    {view === 'entry' && <section className="play-entry" data-testid="section-play-entry">
      <div className="play-intro">
        <span className="play-eyebrow"><Sparkles size={13} /> uma sala para estar junto</span>
        <h1>Tem uma conversa<br /><em>esperando vocês.</em></h1>
        <p>Joguem de onde estiverem. Uma pergunta aparece para todo mundo, e cada resposta chega no seu tempo.</p>
        <div className="play-ritual-note"><MessageCircle size={16} /><span><strong>Sem pressa, sem plateia.</strong><small>O que acontece na sala fica entre vocês.</small></span></div>
      </div>
      <form className="play-entry-card" onSubmit={submitEntry}>
        <div className="play-mode-tabs"><button type="button" className={entryMode === 'create' ? 'is-active' : ''} onClick={() => setEntryMode('create')} data-testid="button-mode-create"><span className="mode-number">01</span> Criar uma sala</button><button type="button" className={entryMode === 'join' ? 'is-active' : ''} onClick={() => setEntryMode('join')} data-testid="button-mode-join"><span className="mode-number">02</span> Entrar com código</button></div>
        <label className="play-field"><span>Como podemos te chamar?</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" maxLength={40} autoComplete="name" data-testid="input-play-name" /></label>
        {entryMode === 'create' ? <fieldset className="play-mode-field"><legend>Como vocês querem jogar?</legend><button type="button" className={mode === 'both' ? 'is-selected' : ''} onClick={() => setMode('both')} data-testid="button-mode-both"><strong>Todo mundo responde</strong><small>Cada pessoa escreve e revela junto.</small><Check size={16} /></button><button type="button" className={mode === 'turn' ? 'is-selected' : ''} onClick={() => setMode('turn')} data-testid="button-mode-turn"><strong>Uma pessoa por vez</strong><small>A pergunta gira pela sala, com calma.</small><Check size={16} /></button></fieldset> : <label className="play-field play-code-field"><span>Código da sala</span><input value={code} onChange={event => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase())} placeholder="A7K2P" inputMode="text" maxLength={5} autoComplete="off" data-testid="input-lobby-code" /><small>Peça o código para quem criou a sala.</small></label>}
        <button className="play-primary-button" type="submit" disabled={socket.status !== 'open'} data-testid={`button-submit-${entryMode}`}>{socket.status === 'connecting' ? <><LoaderCircle size={16} className="play-spin" /> Abrindo conexão</> : entryMode === 'create' ? <>Criar sala <ArrowRight size={16} /></> : <>Entrar na conversa <ArrowRight size={16} /></>}</button>
        {socket.status === 'error' && <button type="button" className="play-retry" onClick={socket.connect} data-testid="button-retry-connection"><RotateCw size={14} /> Tentar conexão novamente</button>}
      </form>
    </section>}
    {view === 'lobby' && <section className="play-room" data-testid="section-lobby">
      <div className="play-room-heading"><div><span className="play-eyebrow">sala aberta</span><h1>O espaço está<br /><em>quase pronto.</em></h1><p>Compartilhe o código e escolham um tema juntos.</p></div><div className="lobby-code"><small>código da sala</small><strong data-testid="text-lobby-code">{lobbyCode}</strong><button onClick={copyCode} data-testid="button-copy-lobby-code">{copied ? <><Check size={14} /> Copiado</> : <><Clipboard size={14} /> Copiar</>}</button></div></div>
      <div className="play-lobby-grid"><section className="play-panel players-panel"><div className="panel-heading"><span><Users size={16} /> Quem chegou</span><b data-testid="text-player-count">{players.length}/8</b></div><div className="player-list" data-testid="list-lobby-players">{players.map((player, index) => <div className="player-row" key={player.id} data-testid={`row-player-${player.id}`}><span className={`player-avatar avatar-${index % 4}`}>{initials(player.name)}</span><span><strong>{player.name}{player.id === playerId ? ' (você)' : ''}</strong><small>{player.id === hostId ? 'host da sala' : 'jogando com vocês'}</small></span>{player.id === hostId && <span className="host-mark"><LockKeyhole size={12} /> host</span>}</div>)}</div><div className="room-presence"><span className="presence-pulse" /> A sala atualiza em tempo real</div></section><section className="play-panel theme-panel"><div className="panel-heading"><span><Feather size={16} /> Escolham um tema</span><small>{isHost ? 'você decide' : 'o host escolhe'}</small></div>{isHost ? <div className="theme-choice-grid" data-testid="list-lobby-themes">{themes.filter(theme => theme.kind === 'tema').slice(0, 8).map((theme, index) => <button key={theme.id} className={`theme-choice theme-choice-${index % 5} ${themeId === theme.id ? 'is-selected' : ''}`} onClick={() => chooseTheme(theme.id)} data-testid={`button-lobby-theme-${theme.id}`}><span>{theme.title}</span><small>{theme.description}</small><i>{theme.count} cartas</i>{themeId === theme.id && <Check size={15} />}</button>)}</div> : <div className="waiting-theme" data-testid="status-waiting-theme"><span><LoaderCircle size={22} className="play-spin" /></span><p>A escolha do tema está<br /><strong>nas mãos de {players.find(player => player.id === hostId)?.name || 'quem criou a sala'}.</strong></p></div>}{themeId && <div className="selected-theme" data-testid="text-selected-theme"><span>Tema escolhido</span><strong>{selectedTheme?.title}</strong><Check size={15} /></div>}</section></div>
      <div className="lobby-footer"><button className="play-quiet-button" onClick={exit} data-testid="button-leave-lobby"><ArrowLeft size={15} /> Sair da sala</button>{isHost && <button className="play-primary-button" onClick={() => socket.start()} disabled={players.length < 2 || !themeId} data-testid="button-start-game">Começar a conversa <ArrowRight size={16} /></button>}</div>
      {!isHost && <p className="play-waiting-message" data-testid="status-waiting-host"><span className="presence-pulse" /> Quando todo mundo chegar, o host começa.</p>}
    </section>}
    {view === 'game' && <section className="play-game" data-testid="section-game">
      <div className="game-topbar"><button className="play-quiet-button" onClick={exit} data-testid="button-leave-game"><ArrowLeft size={15} /> Sair</button><span className="game-room-label"><span className="presence-pulse" /> sala {lobbyCode}</span><span className="game-round-label">{selectedTheme?.title || 'conversa'}</span></div>
       <div className="game-layout"><aside className="game-side-panel"><div className="panel-heading"><span><Users size={16} /> Na sala</span><b>{players.length}</b></div><div className="game-player-list" data-testid="list-game-players">{players.map((player, index) => <div className={`game-player ${player.id === playerId ? 'is-me' : ''}`} key={player.id} data-testid={`game-player-${player.id}`}><span className={`player-avatar avatar-${index % 4}`}>{initials(player.name)}</span><span>{player.name}</span>{player.hasSubmitted && <Check size={14} />}</div>)}</div><div className="game-mode-caption"><span>{mode === 'both' ? 'todos respondem' : 'uma pessoa por vez'}</span></div></aside><div className="question-stage">{!currentQuestion ? <div className="question-empty"><Sparkles size={22} /><h2>A primeira pergunta<br /><em>vai chegar agora.</em></h2><p>Um pequeno silêncio antes de começar.</p>{isHost && <button className="play-primary-button" onClick={() => socket.nextQuestion(availableQuestionIds)} data-testid="button-next-question">Puxar primeira pergunta <ArrowRight size={16} /></button>}</div> : <><div className="question-meta"><span>pergunta para vocês</span><span>{answers.length ? 'respostas reveladas' : submitted ? 'resposta enviada' : 'escutem com calma'}</span></div><article className="live-question-card" data-testid={`card-live-question-${currentQuestion.id}`}><div className="question-orbit" /><span className="question-number">Q. {String(availableQuestionIds.indexOf(currentQuestion.id) + 1).padStart(2, '0')}</span><blockquote data-testid={`text-live-question-${currentQuestion.id}`}>{currentQuestion.text}</blockquote><span className="question-card-signature">perguntas de conexão</span></article>{answers.length > 0 && <div className="answer-reveal" data-testid="list-revealed-answers"><div className="reveal-heading"><span><Sparkles size={15} /> agora, escutem</span><small>{answers.length} resposta{answers.length > 1 ? 's' : ''}</small></div>{answers.map(item => <div className="revealed-answer" key={item.playerId} data-testid={`text-revealed-answer-${item.playerId}`}><span className="player-avatar avatar-2">{initials(item.playerName)}</span><p><small>{item.playerName}</small>{item.answer}</p>{item.playerId !== playerId && <button type="button" className="play-save-moment" onClick={() => saveMoment(item)} disabled={savedIds.has(`${item.playerId}:${currentQuestion.id}`)} data-testid={`button-save-moment-${item.playerId}`}><Bookmark size={14} fill={savedIds.has(`${item.playerId}:${currentQuestion.id}`) ? 'currentColor' : 'none'} />{savedIds.has(`${item.playerId}:${currentQuestion.id}`) ? 'Momento guardado' : 'Guardar esse momento'}</button>}</div>)}</div>}{!answers.length && <form className="answer-form" onSubmit={sendAnswer}><label htmlFor="live-answer">Sua resposta</label><textarea id="live-answer" value={answer} onChange={event => setAnswer(event.target.value)} disabled={submitted || !isMyTurn} placeholder={isMyTurn ? 'Escreva o que veio primeiro…' : `${players.find(player => player.id === turnPlayerId)?.name || 'Outra pessoa'} está com a palavra…`} maxLength={1000} data-testid="textarea-live-answer" /><div className="answer-form-footer"><span>{submitted ? 'Sua resposta chegou. Agora é ouvir.' : isMyTurn ? 'Não existe resposta certa.' : 'Aguarde sua vez.'}</span><button className="play-primary-button" type="submit" disabled={submitted || !answer.trim() || !isMyTurn} data-testid="button-submit-answer">{submitted ? <><Check size={16} /> Enviada</> : <><Send size={15} /> Enviar</>}</button></div></form>}{answers.length > 0 && isHost && <button className="play-primary-button next-question-button" onClick={() => socket.nextQuestion(availableQuestionIds)} data-testid="button-next-question">Próxima pergunta <ArrowRight size={16} /></button>}</>}</div></div>
    </section>}
    <footer className="play-footer"><span><Link2 size={13} /> conexão protegida pela presença de vocês</span><span>PC · online</span></footer>
  </main>;
}
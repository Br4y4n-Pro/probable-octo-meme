import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { unlockAudio } from '../sound.js';
import {
  api,
  clearSession,
  loadSession,
  openConnection,
  saveSession,
  type ServerSocket,
  type StoredSession,
} from './net.js';
import {
  initialOnlineState,
  onlineReducer,
  type OnlineAction,
} from './state.js';
import { Lobby } from './screens/Lobby.js';
import { Waiting } from './screens/Waiting.js';
import { OnlinePlacement } from './screens/OnlinePlacement.js';
import { OnlinePlay } from './screens/OnlinePlay.js';
import { OnlineGameOver } from './screens/OnlineGameOver.js';
import { RoomClosed } from './screens/RoomClosed.js';

type Props = {
  onExit: () => void;
};

export function OnlineApp({ onExit }: Props) {
  const [state, dispatch] = useReducer(onlineReducer, initialOnlineState);
  const socketRef = useRef<ServerSocket | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);

  // Mirror session to a ref so socket handlers always see the latest token
  useEffect(() => {
    if (state.session) {
      sessionRef.current = {
        code: state.session.code,
        role: state.session.role,
        sessionToken: state.session.sessionToken,
        size: state.session.size,
        nickname: state.session.nickname,
      };
      saveSession(sessionRef.current);
    }
  }, [state.session]);

  // ─── Open socket once, register listeners ──────────────────────────────
  useEffect(() => {
    const socket = openConnection();
    socketRef.current = socket;

    const attemptReconnect = async () => {
      const stored = sessionRef.current ?? loadSession();
      if (!stored) return;
      const res = await api.reconnect(
        socket,
        stored.code,
        stored.role,
        stored.sessionToken,
      );
      if (!res.ok) {
        clearSession();
        sessionRef.current = null;
        return;
      }
      dispatch({
        type: 'reconnect_snapshot',
        session: {
          code: stored.code,
          role: stored.role,
          sessionToken: stored.sessionToken,
          size: stored.size,
          nickname: res.snapshot.yourNickname,
        },
        phase: res.snapshot.phase,
        myShips: res.snapshot.yourBoard,
        shotsByMe: res.snapshot.shotsByMe,
        shotsAtMe: res.snapshot.shotsAtMe,
        turn: res.snapshot.turn,
        yourReady: res.snapshot.yourReady,
        opponentReady: res.snapshot.opponentReady,
        opponentPresent: res.snapshot.opponentPresent,
        opponentNickname: res.snapshot.opponentNickname,
        winner: res.snapshot.winner,
      });
    };

    socket.on('connect', () => {
      dispatch({ type: 'connection_status', status: 'connected' });
      // On the *first* connect there's no session yet; reconnect_session is a no-op.
      // On subsequent reconnects (network blip), this resumes us.
      if (sessionRef.current ?? loadSession()) {
        void attemptReconnect();
      }
    });
    socket.on('disconnect', () => {
      dispatch({ type: 'connection_status', status: 'reconnecting' });
    });
    socket.io.on('reconnect_failed', () => {
      dispatch({ type: 'connection_status', status: 'disconnected' });
    });

    socket.on('opponent_joined', (e) =>
      dispatch({ type: 'opponent_joined', nickname: e.nickname }),
    );
    socket.on('opponent_left', (e) =>
      dispatch({ type: 'opponent_left', graceSeconds: e.graceSeconds }),
    );
    socket.on('opponent_reconnected', () =>
      dispatch({ type: 'opponent_reconnected' }),
    );
    socket.on('opponent_ready', () => dispatch({ type: 'opponent_ready' }));
    socket.on('game_started', (e) =>
      dispatch({
        type: 'game_started',
        firstTurn: e.firstTurn,
        turnDeadline: e.turnDeadline,
        powerups: e.powerups,
      }),
    );
    socket.on('shot_result', (e) =>
      dispatch({
        type: 'shot_result',
        byPlayer: e.byPlayer,
        cell: e.cell,
        outcome: e.outcome,
        ...(e.sunkShip ? { sunkShip: e.sunkShip } : {}),
        nextTurn: e.nextTurn,
        ...(e.turnDeadline !== undefined ? { turnDeadline: e.turnDeadline } : {}),
        ...(e.consumedPowerup ? { consumedPowerup: e.consumedPowerup } : {}),
      }),
    );
    socket.on('radar_reveal', (e) =>
      dispatch({ type: 'radar_reveal', cell: e.cell }),
    );
    socket.on('game_over', (e) =>
      dispatch({ type: 'game_over', winner: e.winner, reason: e.reason }),
    );
    socket.on('emote', (e) =>
      dispatch({
        type: 'emote_received',
        code: e.code,
        label: e.label,
        from: e.from,
      }),
    );
    socket.on('rematch_requested', () =>
      dispatch({ type: 'rematch_requested_by_opponent' }),
    );
    socket.on('rematch_started', () => dispatch({ type: 'rematch_started' }));
    socket.on('room_closed', (e) => {
      clearSession();
      sessionRef.current = null;
      dispatch({ type: 'room_closed', reason: e.reason });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ─── Action dispatchers used by screens ────────────────────────────────

  const onCreateRoom = useCallback(
    async (size: 8 | 10 | 12 | 15 | 30, nickname: string) => {
      const socket = socketRef.current;
      if (!socket) return;
      const res = await api.createRoom(socket, size, nickname);
      if (!res.ok) {
        dispatch({ type: 'lobby_error', reason: res.reason });
        return;
      }
      dispatch({
        type: 'session_created',
        session: {
          code: res.code,
          role: res.role,
          sessionToken: res.sessionToken,
          size: res.size,
          nickname: res.nickname,
        },
      });
    },
    [],
  );

  const onJoinRoom = useCallback(async (code: string, nickname: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    const normalized = code.trim().toUpperCase();
    const res = await api.joinRoom(socket, normalized, nickname);
    if (!res.ok) {
      dispatch({ type: 'lobby_error', reason: res.reason });
      return;
    }
    dispatch({
      type: 'session_joined',
      session: {
        code: normalized,
        role: res.role,
        sessionToken: res.sessionToken,
        size: res.size,
        nickname: res.nickname,
      },
      opponentPresent: res.opponentPresent,
      opponentNickname: res.opponentNickname,
    });
  }, []);

  const onQuickPlace = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    const res = await api.quickPlace(socket);
    if (!res.ok) return;
    // Server already validated and applied. Mirror it client-side.
    dispatch({ type: 'auto_place_local', ships: res.ships });
    dispatch({ type: 'placement_submitted' });
  }, []);

  const onConfirmPlacement = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !state.session) return;
    const ships = state.myBoard.ships.map((s) => ({
      pieceId: s.pieceId,
      origin: s.origin,
      rotation: s.rotation,
    }));
    const placeRes = await api.placeShips(socket, ships);
    if (!placeRes.ok) {
      // shouldn't happen if local validation is consistent
      return;
    }
    dispatch({ type: 'placement_submitted' });
    const readyRes = await api.ready(socket);
    if (!readyRes.ok) return;
    dispatch({ type: 'ready_submitted' });
  }, [state.myBoard, state.session]);

  const onShoot = useCallback(
    async (cell: { x: number; y: number }) => {
      const socket = socketRef.current;
      if (!socket) return;
      await api.shoot(socket, cell);
      // State updates arrive via shot_result event broadcast.
    },
    [],
  );

  const onSendEmote = useCallback(
    async (entry: { code: string; label: string }) => {
      const socket = socketRef.current;
      if (!socket) return;
      await api.sendEmote(socket, entry);
    },
    [],
  );

  const onLeave = useCallback(() => {
    const socket = socketRef.current;
    if (socket) api.leave(socket);
    clearSession();
    sessionRef.current = null;
    onExit();
  }, [onExit]);

  const onRematch = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    dispatch({ type: 'rematch_local' });
    await api.rematch(socket);
  }, []);

  const onReturnToLobby = useCallback(() => {
    clearSession();
    sessionRef.current = null;
    dispatch({ type: 'reset_to_lobby' });
  }, []);

  // ─── Audio unlock on first interaction ─────────────────────────────────
  const onAnyClick = useCallback(() => unlockAudio(), []);

  // ─── Connection banner ─────────────────────────────────────────────────
  const connectionBanner = useMemo(() => {
    if (state.connection === 'connected') return null;
    if (state.connection === 'connecting')
      return <div className="conn-banner conn-banner--info">Conectando…</div>;
    if (state.connection === 'reconnecting')
      return (
        <div className="conn-banner conn-banner--warn">
          Reconectando al servidor…
        </div>
      );
    return (
      <div className="conn-banner conn-banner--error">
        Sin conexión al servidor
      </div>
    );
  }, [state.connection]);

  // ─── Route to current view ─────────────────────────────────────────────
  const view = state.view;
  let screen: React.JSX.Element;
  if (view.kind === 'lobby') {
    screen = (
      <Lobby
        view={view}
        connection={state.connection}
        onCreate={onCreateRoom}
        onJoin={onJoinRoom}
        onCodeChange={(v) => dispatch({ type: 'lobby_code_input', value: v })}
        onBack={onExit}
      />
    );
  } else if (view.kind === 'waiting') {
    screen = (
      <Waiting
        code={state.session?.code ?? ''}
        nickname={state.session?.nickname ?? ''}
        opponentPresent={state.opponentPresent}
        onCancel={onLeave}
      />
    );
  } else if (view.kind === 'placement' || view.kind === 'placement_waiting') {
    screen = (
      <OnlinePlacement
        state={state}
        view={view}
        dispatch={dispatch as (a: OnlineAction) => void}
        onQuickPlace={onQuickPlace}
        onConfirm={onConfirmPlacement}
        onLeave={onLeave}
      />
    );
  } else if (view.kind === 'playing') {
    screen = (
      <OnlinePlay
        state={state}
        view={view}
        onShoot={onShoot}
        onSendEmote={onSendEmote}
        onClearEmote={() => dispatch({ type: 'emote_clear' })}
        onLeave={onLeave}
      />
    );
  } else if (view.kind === 'gameover') {
    screen = (
      <OnlineGameOver
        winner={view.winner}
        reason={view.reason}
        myRole={state.session?.role ?? 'A'}
        myNickname={state.session?.nickname ?? ''}
        opponentNickname={state.opponentNickname}
        meWantsRematch={state.meWantsRematch}
        opponentWantsRematch={state.opponentWantsRematch}
        opponentPresent={state.opponentPresent}
        onRematch={onRematch}
        onReturn={onReturnToLobby}
        onExit={onExit}
      />
    );
  } else {
    screen = (
      <RoomClosed
        reason={view.reason}
        onReturn={onReturnToLobby}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="app online-app" onClick={onAnyClick}>
      {connectionBanner}
      {screen}
    </div>
  );
}

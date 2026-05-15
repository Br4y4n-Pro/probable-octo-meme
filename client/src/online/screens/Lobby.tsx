import { useEffect, useState } from 'react';
import {
  BOARD_SIZES,
  NICKNAME_REGEX,
  ROOM_CODE_REGEX,
  type BoardSize,
  type OpenRoom,
  getFleet,
} from '@battlenaval/shared';
import type { ConnectionStatus, OnlineView } from '../state.js';
import { Avatar } from '../../components/Avatar.js';
import { loadNickname, loadStoredPlaylist, saveNickname } from '../net.js';

const SIZE_LABELS: Record<BoardSize, string> = {
  8: 'Pequeño',
  10: 'Clásico',
  12: 'Grande',
  15: 'Enorme',
  30: 'Masivo',
};

type Props = {
  view: Extract<OnlineView, { kind: 'lobby' }>;
  connection: ConnectionStatus;
  openRooms: OpenRoom[];
  onCreate: (size: BoardSize, nickname: string, importPlaylist: boolean) => void;
  onJoin: (code: string, nickname: string) => void;
  onRefreshRooms: () => void;
  onCodeChange: (v: string) => void;
  onBack: () => void;
};

export function Lobby({
  view,
  connection,
  openRooms,
  onCreate,
  onJoin,
  onRefreshRooms,
  onCodeChange,
  onBack,
}: Props) {
  const [size, setSize] = useState<BoardSize>(10);
  const [nickname, setNickname] = useState<string>(() => loadNickname());
  const [storedPlaylist] = useState<string[]>(() => loadStoredPlaylist());
  const [importPlaylist, setImportPlaylist] = useState(true);
  const trimmedNick = nickname.trim();
  const nickValid = NICKNAME_REGEX.test(trimmedNick);
  const disabled = connection !== 'connected' || !nickValid;
  const codeValid = ROOM_CODE_REGEX.test(view.pendingCode);
  const fleet = getFleet(size);

  useEffect(() => {
    if (nickValid) saveNickname(trimmedNick);
  }, [trimmedNick, nickValid]);

  return (
    <div className="screen screen--lobby">
      <div className="brand">
        <span className="brand__mark">⚓</span>
        <span className="brand__name">
          Batalla <em>Naval</em>
        </span>
      </div>
      <h1>Jugar online</h1>
      <p className="lede">Crea una sala o únete a la de un amigo</p>

      <section className="card lobby-nick-card">
        <div className="lobby-nick-row">
          <Avatar nickname={trimmedNick || '?'} size={56} />
          <label className="lobby-nick-field">
            <span className="muted small">Tu nombre</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="Ej. Capitán Pez"
              className="lobby-nick-input"
              spellCheck={false}
            />
            {!nickValid && nickname.length > 0 && (
              <span className="lobby-nick-error">
                Entre 2 y 20 caracteres (letras, números, espacios, .'_-)
              </span>
            )}
          </label>
        </div>
      </section>

      <div className="lobby-grid">
        <section className="card lobby-card">
          <h2>🪐 Crear sala</h2>
          <p className="muted small">
            Elige el tamaño y te daré un código para compartir.
          </p>
          <div className="size-grid size-grid--compact">
            {BOARD_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={`size-option ${s === size ? 'size-option--active' : ''}`}
                onClick={() => setSize(s)}
              >
                <span className="size-option__num">
                  {s}×{s}
                </span>
                <span className="size-option__label">{SIZE_LABELS[s]}</span>
                <span className="size-option__fleet">
                  {getFleet(s).length} barcos
                </span>
              </button>
            ))}
          </div>
          <p className="muted small lobby-fleet-summary">
            <strong>{fleet.length} barcos</strong> ·{' '}
            {fleet.reduce((a, p) => a + p.shape.length, 0)} celdas
          </p>
          {storedPlaylist.length > 0 && (
            <label className="lobby-import">
              <input
                type="checkbox"
                checked={importPlaylist}
                onChange={(e) => setImportPlaylist(e.target.checked)}
              />
              <span>
                🎵 Importar mi playlist guardada ({storedPlaylist.length}{' '}
                {storedPlaylist.length === 1 ? 'canción' : 'canciones'})
              </span>
            </label>
          )}
          <button
            type="button"
            className="btn btn--primary btn--big lobby-btn-wide"
            disabled={disabled}
            onClick={() =>
              onCreate(
                size,
                trimmedNick,
                importPlaylist && storedPlaylist.length > 0,
              )
            }
          >
            Crear sala
          </button>
        </section>

        <section className="card lobby-card">
          <h2>🔑 Unirse a sala</h2>
          <p className="muted small">
            Pídele a tu rival el código de 6 caracteres.
          </p>
          <label className="lobby-code-field">
            <span className="muted small">Código</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABC-234"
              maxLength={7}
              value={view.pendingCode}
              onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
              className="lobby-code-input"
            />
          </label>
          {view.pendingError && (
            <p className="lobby-error">{translateError(view.pendingError)}</p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--big lobby-btn-wide"
            disabled={disabled || !codeValid}
            onClick={() => onJoin(view.pendingCode, trimmedNick)}
          >
            Unirme
          </button>
        </section>
      </div>

      <section className="card lobby-rooms">
        <div className="lobby-rooms__head">
          <h2>🛰️ Salas abiertas</h2>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={onRefreshRooms}
            disabled={connection !== 'connected'}
          >
            ↻ Actualizar
          </button>
        </div>
        {openRooms.length === 0 ? (
          <p className="muted small">
            No hay salas esperando jugadores ahora mismo. Crea una o pídele el
            código a tu rival.
          </p>
        ) : (
          <>
            {!nickValid && (
              <p className="lobby-rooms__hint">
                ✏️ Escribe tu nombre arriba para poder unirte a una sala.
              </p>
            )}
            {connection !== 'connected' && nickValid && (
              <p className="lobby-rooms__hint">
                ⏳ Sin conexión al servidor — espera a reconectar.
              </p>
            )}
          <ul className="room-list">
            {openRooms.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  className="room-list__item"
                  disabled={disabled}
                  title={
                    nickValid
                      ? `Unirme a la sala de ${r.hostNickname}`
                      : 'Escribe tu nombre primero'
                  }
                  onClick={() => onJoin(r.code, trimmedNick)}
                >
                  <Avatar nickname={r.hostNickname} size={38} />
                  <span className="room-list__info">
                    <span className="room-list__host">{r.hostNickname}</span>
                    <span className="muted small">
                      {r.size}×{r.size} · {SIZE_LABELS[r.size]} ·{' '}
                      <span className="room-list__code">{r.code}</span>
                    </span>
                  </span>
                  <span className="room-list__join">Unirme →</span>
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>

      <button
        type="button"
        className="btn btn--ghost lobby-back"
        onClick={onBack}
      >
        ← Volver al menú
      </button>
    </div>
  );
}

function translateError(reason: string): string {
  switch (reason) {
    case 'not-found':
      return 'No encontramos esa sala. Verifica el código.';
    case 'full':
      return 'La sala está llena.';
    case 'in-progress':
      return 'Esa partida ya empezó.';
    case 'invalid-code':
      return 'Formato de código inválido (ej. ABC-234).';
    case 'invalid-nickname':
      return 'El nombre no es válido (2-20 caracteres).';
    case 'already-in-room':
      return 'Ya estás en otra sala.';
    case 'invalid-size':
      return 'Tamaño de tablero inválido.';
    default:
      return `Error: ${reason}`;
  }
}

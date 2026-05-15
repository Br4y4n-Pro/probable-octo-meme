import { useEffect, useState } from 'react';
import {
  BOARD_SIZES,
  NICKNAME_REGEX,
  ROOM_CODE_REGEX,
  type BoardSize,
  getFleet,
} from '@battlenaval/shared';
import type { ConnectionStatus, OnlineView } from '../state.js';
import { Avatar } from '../../components/Avatar.js';
import { loadNickname, saveNickname } from '../net.js';

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
  onCreate: (size: BoardSize, nickname: string) => void;
  onJoin: (code: string, nickname: string) => void;
  onCodeChange: (v: string) => void;
  onBack: () => void;
};

export function Lobby({
  view,
  connection,
  onCreate,
  onJoin,
  onCodeChange,
  onBack,
}: Props) {
  const [size, setSize] = useState<BoardSize>(10);
  const [nickname, setNickname] = useState<string>(() => loadNickname());
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
          <button
            type="button"
            className="btn btn--primary btn--big lobby-btn-wide"
            disabled={disabled}
            onClick={() => onCreate(size, trimmedNick)}
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

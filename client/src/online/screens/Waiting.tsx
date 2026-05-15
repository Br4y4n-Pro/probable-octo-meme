import { useState } from 'react';
import { Avatar } from '../../components/Avatar.js';

type Props = {
  code: string;
  nickname: string;
  opponentPresent: boolean;
  onCancel: () => void;
};

export function Waiting({ code, nickname, opponentPresent, onCancel }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  };

  return (
    <div className="screen screen--waiting">
      <div className="card card--centered">
        <div className="waiting-me">
          <Avatar nickname={nickname} size={64} />
          <span className="waiting-me__name">{nickname}</span>
        </div>
        <p className="muted">{opponentPresent ? 'Listo, empezando...' : 'Sala creada'}</p>
        <h1 className="waiting-title">Comparte este código</h1>
        <div className="room-code">
          <span className="room-code__text">{code}</span>
          <button
            type="button"
            className="btn btn--small"
            onClick={copy}
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="waiting-anim">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <p className="muted">Esperando a que tu rival se una…</p>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

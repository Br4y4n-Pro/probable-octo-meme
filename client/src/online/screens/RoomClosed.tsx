type Props = {
  reason: string;
  onReturn: () => void;
  onExit: () => void;
};

const REASONS: Record<string, string> = {
  'host-left': 'El creador de la sala se fue.',
  'guest-left': 'Tu rival se fue.',
  'opponent-timeout': 'Tu rival no volvió a tiempo.',
  manual: 'La sala fue cerrada.',
};

export function RoomClosed({ reason, onReturn, onExit }: Props) {
  return (
    <div className="screen screen--gameover">
      <div className="card card--centered">
        <p className="muted">Sala cerrada</p>
        <h1>👋 Partida terminada</h1>
        <p className="muted">{REASONS[reason] ?? `Razón: ${reason}`}</p>
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={onReturn}>
            Volver al lobby
          </button>
          <button type="button" className="btn" onClick={onExit}>
            Menú principal
          </button>
        </div>
      </div>
    </div>
  );
}

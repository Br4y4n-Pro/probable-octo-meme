type Props = {
  onPickLocal: () => void;
  onPickOnline: () => void;
  onPickLeaderboard: () => void;
};

export function MainMenu({ onPickLocal, onPickOnline, onPickLeaderboard }: Props) {
  return (
    <div className="screen screen--menu">
      <div className="brand brand--big">
        <span className="brand__mark">⚓</span>
        <span className="brand__name">
          Batalla <em>Naval</em>
        </span>
      </div>
      <p className="lede menu-tagline">Hunde la flota enemiga</p>

      <div className="menu-options">
        <button type="button" className="menu-card" onClick={onPickLocal}>
          <span className="menu-card__icon">🪑</span>
          <span className="menu-card__title">Jugar local</span>
          <span className="menu-card__desc">
            Dos personas en el mismo dispositivo
          </span>
        </button>
        <button
          type="button"
          className="menu-card menu-card--primary"
          onClick={onPickOnline}
        >
          <span className="menu-card__icon">🌐</span>
          <span className="menu-card__title">Jugar online</span>
          <span className="menu-card__desc">
            Crea una sala y juega con un amigo
          </span>
        </button>
        <button type="button" className="menu-card" onClick={onPickLeaderboard}>
          <span className="menu-card__icon">🏆</span>
          <span className="menu-card__title">Marcador</span>
          <span className="menu-card__desc">
            Top de victorias globales del servidor
          </span>
        </button>
      </div>
    </div>
  );
}

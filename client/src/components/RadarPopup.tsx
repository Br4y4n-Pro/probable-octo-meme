type Props = {
  /** 1-indexed coordinates of the revealed enemy ship cell. */
  x: number;
  y: number;
  /** Pass a fresh key per fire to re-trigger the entry animation. */
};

export function RadarPopup({ x, y }: Props) {
  return (
    <div className="radar-popup" aria-live="polite">
      <div className="radar-popup__icon">📡</div>
      <div className="radar-popup__title">¡RADAR!</div>
      <div className="radar-popup__name">
        Barco enemigo detectado en ({x}, {y})
      </div>
    </div>
  );
}

type Props = {
  shipName: string;
  /** Pass a fresh key per fire to re-trigger the entry animation. */
};

export function SunkPopup({ shipName }: Props) {
  return (
    <div className="sunk-popup" aria-live="polite">
      <div className="sunk-popup__bang">💥</div>
      <div className="sunk-popup__title">¡HUNDIDO!</div>
      <div className="sunk-popup__name">{shipName}</div>
    </div>
  );
}

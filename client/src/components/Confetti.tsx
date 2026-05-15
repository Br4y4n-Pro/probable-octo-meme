import { useMemo, type CSSProperties } from 'react';

export type ConfettiType = 'win' | 'lose';

type Props = {
  type: ConfettiType;
  count?: number;
};

type Particle = {
  className: string;
  style: CSSProperties;
  content: string;
};

const WIN_COLORS = [
  '#ff7a59',
  '#fbbf24',
  '#10b981',
  '#06b6d4',
  '#a855f7',
  '#f472b6',
  '#fde68a',
  '#ffffff',
];

const SKULLS = ['💀', '☠️', '💀', '☠️', '💀'];

function makeParticle(type: ConfettiType, index: number): Particle {
  const left = Math.random() * 100;
  // Stagger start times so particles enter continuously, not all at once
  const delay = Math.random() * 5;
  const duration = 3 + Math.random() * 3;
  const rotateStart = Math.random() * 360;
  const rotateEnd =
    rotateStart + (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540);
  const xDrift = (Math.random() - 0.5) * 30;

  const style: CSSProperties = {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    // Custom props consumed by the keyframes
    ['--rotate-start' as string]: `${rotateStart}deg`,
    ['--rotate-end' as string]: `${rotateEnd}deg`,
    ['--x-drift' as string]: `${xDrift}vw`,
  } as CSSProperties;

  if (type === 'win') {
    const color = WIN_COLORS[index % WIN_COLORS.length];
    const w = 7 + Math.random() * 6;
    const h = 11 + Math.random() * 8;
    return {
      className: 'confetti-piece confetti-piece--rect',
      style: { ...style, background: color, width: `${w}px`, height: `${h}px` },
      content: '',
    };
  }

  const size = 20 + Math.random() * 24;
  return {
    className: 'confetti-piece confetti-piece--skull',
    style: { ...style, fontSize: `${size}px` },
    content: SKULLS[index % SKULLS.length] ?? '💀',
  };
}

export function Confetti({ type, count = 70 }: Props) {
  const particles = useMemo<Particle[]>(
    () => Array.from({ length: count }, (_, i) => makeParticle(type, i)),
    [type, count],
  );

  return (
    <div className="confetti-overlay" aria-hidden>
      {particles.map((p, i) => (
        <div key={i} className={p.className} style={p.style}>
          {p.content}
        </div>
      ))}
    </div>
  );
}

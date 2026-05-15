import {
  Bomb,
  Fire,
  HandWaving,
  Handshake,
  HandsPraying,
  Question,
  SmileyMeh,
  Sunglasses,
  Target,
  type Icon,
} from '@phosphor-icons/react';

/** Maps emote codes (sent over the wire) to Phosphor icon components. */
const REGISTRY: Record<string, Icon> = {
  'hand-waving': HandWaving,
  sunglasses: Sunglasses,
  target: Target,
  'hands-praying': HandsPraying,
  bomb: Bomb,
  'smiley-meh': SmileyMeh,
  fire: Fire,
  handshake: Handshake,
};

type Props = {
  code: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
};

export function EmoteIcon({ code, size = 28, weight = 'fill' }: Props) {
  const IconComp = REGISTRY[code] ?? Question;
  return <IconComp size={size} weight={weight} />;
}

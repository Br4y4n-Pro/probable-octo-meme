type Props = {
  nickname: string;
  size?: number;
  /** DiceBear style. Default 'fun-emoji'. */
  style?: 'fun-emoji' | 'bottts' | 'lorelei' | 'avataaars';
  className?: string;
};

/**
 * Renders a deterministic SVG avatar for `nickname` via the DiceBear public API.
 * No JS bundle cost — it's just an <img>. Browser caches per URL.
 */
export function Avatar({
  nickname,
  size = 40,
  style = 'fun-emoji',
  className,
}: Props) {
  const seed = encodeURIComponent(nickname.trim() || '?');
  const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`avatar ${className ?? ''}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

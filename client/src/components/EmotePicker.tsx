import { EMOTES, type EmoteEntry } from '../state.js';
import { EmoteIcon } from './EmoteIcon.js';

type Props = {
  open: boolean;
  onPick: (entry: EmoteEntry) => void;
  onClose: () => void;
};

export function EmotePicker({ open, onPick, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="emote-overlay" onClick={onClose} />
      <div className="emote-picker">
        {EMOTES.map((e) => (
          <button
            type="button"
            key={e.code}
            className="emote-btn"
            onClick={() => {
              onPick(e);
              onClose();
            }}
          >
            <span className="emote-btn__code">
              <EmoteIcon code={e.code} size={30} />
            </span>
            <span className="emote-btn__label">{e.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

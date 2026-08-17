import React from 'react';
import { DiceStyle } from '../dice-engine/types/DiceStyle';
import { standardPreviews } from '../dice-engine/sets/diceSets';
import clsx from 'clsx';
import { Icons } from './ui/Icons';

const AVAILABLE_STYLES: { id: DiceStyle; name: string; desc: string }[] = [
  { id: 'GEMSTONE', name: 'Gemstone', desc: 'Lustrous crystalline finish' },
  { id: 'GALAXY', name: 'Galaxy', desc: 'Cosmic purple starry texture' },
  { id: 'GLASS', name: 'Glass', desc: 'Translucent frosted crystal' },
  { id: 'IRON', name: 'Iron', desc: 'Heavy battle-forged steel' },
  { id: 'NEBULA', name: 'Nebula', desc: 'Deep space interstellar dust' },
  { id: 'SUNRISE', name: 'Sunrise', desc: 'Radiant golden morning glow' },
  { id: 'SUNSET', name: 'Sunset', desc: 'Warm twilight amber gradient' },
  { id: 'WALNUT', name: 'Walnut', desc: 'Carved natural dark woodgrain' },
];

interface DiceStylePickerProps {
  currentStyle: DiceStyle;
  onSelect: (style: DiceStyle) => void;
  compact?: boolean;
}

export const DiceStylePicker: React.FC<DiceStylePickerProps> = ({
  currentStyle,
  onSelect,
  compact = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">3D Dice Skin</h4>
          <p className="text-xs text-zinc-400">Default style for standard dice (D4, D6, D8, D10, D12, D20, D100)</p>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
          {currentStyle}
        </span>
      </div>

      <div className={clsx(
        "grid gap-2",
        compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"
      )}>
        {AVAILABLE_STYLES.map((style) => {
          const isSelected = currentStyle === style.id;
          const previewImg = standardPreviews[style.id];

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(style.id)}
              className={clsx(
                "relative group flex flex-col items-center p-2.5 rounded-xl border transition-all text-center",
                isSelected
                  ? "bg-accent/15 border-accent shadow-lg shadow-accent/10 ring-1 ring-accent"
                  : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60"
              )}
            >
              {/* Selected indicator badge */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center text-[10px] shadow">
                  <Icons.Check size={10} />
                </div>
              )}

              {/* Preview Image */}
              <div className="w-12 h-12 flex items-center justify-center mb-1.5 rounded-lg overflow-hidden transition-transform group-hover:scale-110">
                {previewImg ? (
                  <img
                    src={previewImg}
                    alt={style.name}
                    className="w-10 h-10 object-contain drop-shadow-md"
                  />
                ) : (
                  <Icons.Dice size={28} className="text-zinc-500" />
                )}
              </div>

              {/* Name */}
              <span className={clsx(
                "text-xs font-semibold tracking-wide",
                isSelected ? "text-accent font-bold" : "text-zinc-300 group-hover:text-white"
              )}>
                {style.name}
              </span>

              {!compact && (
                <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  {style.desc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

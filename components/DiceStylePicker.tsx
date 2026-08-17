import React, { useState, useEffect } from 'react';
import { DiceStyle } from '../dice-engine/types/DiceStyle';
import { standardPreviews } from '../dice-engine/sets/diceSets';
import { DiceCustomization, DEFAULT_DICE_CUSTOMIZATION } from '../types';
import { OBRStorage } from '../obr';
import clsx from 'clsx';
import { Icons } from './ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';

export const AVAILABLE_STYLES: { id: DiceStyle; name: string; desc: string }[] = [
  { id: 'GEMSTONE', name: 'Gemstone', desc: 'Lustrous crystalline finish' },
  { id: 'GALAXY', name: 'Galaxy', desc: 'Cosmic purple starry texture' },
  { id: 'GLASS', name: 'Glass', desc: 'Translucent frosted crystal' },
  { id: 'IRON', name: 'Iron', desc: 'Heavy battle-forged steel' },
  { id: 'NEBULA', name: 'Nebula', desc: 'Deep space interstellar dust' },
  { id: 'SUNRISE', name: 'Sunrise', desc: 'Radiant golden morning glow' },
  { id: 'SUNSET', name: 'Sunset', desc: 'Warm twilight amber gradient' },
  { id: 'WALNUT', name: 'Walnut', desc: 'Carved natural dark woodgrain' },
];

export const PRESET_THEMES: {
  id: string;
  name: string;
  desc: string;
  icon: string;
  config: Partial<DiceCustomization>;
}[] = [
  {
    id: 'classic',
    name: 'Classic Daggerheart',
    desc: 'Golden Sunrise Hope, Cosmic Galaxy Fear, Gemstone polyhedrals',
    icon: '🌟',
    config: {
      standardStyle: 'GEMSTONE',
      hopeStyle: 'SUNRISE',
      fearStyle: 'GALAXY',
      negativeStyle: 'IRON',
      hopeGlowColor: '#eab308',
      fearGlowColor: '#a855f7',
    },
  },
  {
    id: 'blood_steel',
    name: 'Blood & Steel',
    desc: 'Radiant Sunrise Hope, Forged Iron Fear, Battle Iron polyhedrals',
    icon: '⚔️',
    config: {
      standardStyle: 'IRON',
      hopeStyle: 'SUNRISE',
      fearStyle: 'IRON',
      negativeStyle: 'IRON',
      hopeGlowColor: '#f59e0b',
      fearGlowColor: '#ef4444',
    },
  },
  {
    id: 'ancient_grove',
    name: 'Ancient Grove',
    desc: 'Emerald Gemstone Hope, Dark Walnut Fear, Carved Walnut polyhedrals',
    icon: '🌲',
    config: {
      standardStyle: 'WALNUT',
      hopeStyle: 'GEMSTONE',
      fearStyle: 'WALNUT',
      negativeStyle: 'IRON',
      hopeGlowColor: '#10b981',
      fearGlowColor: '#78350f',
    },
  },
  {
    id: 'astral_void',
    name: 'Astral Void',
    desc: 'Nebula Hope, Deep Galaxy Fear, Translucent Glass polyhedrals',
    icon: '🔮',
    config: {
      standardStyle: 'GLASS',
      hopeStyle: 'NEBULA',
      fearStyle: 'GALAXY',
      negativeStyle: 'IRON',
      hopeGlowColor: '#06b6d4',
      fearGlowColor: '#6366f1',
    },
  },
  {
    id: 'solar_eclipse',
    name: 'Solar Eclipse',
    desc: 'Blazing Sunrise Hope, Amber Sunset Fear, Frosted Glass polyhedrals',
    icon: '🌅',
    config: {
      standardStyle: 'GLASS',
      hopeStyle: 'SUNRISE',
      fearStyle: 'SUNSET',
      negativeStyle: 'IRON',
      hopeGlowColor: '#fbbf24',
      fearGlowColor: '#f97316',
    },
  },
];

export const HOPE_COLOR_SWATCHES = [
  { label: 'Gold', color: '#eab308' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Azure', color: '#06b6d4' },
  { label: 'Radiant White', color: '#f8fafc' },
  { label: 'Rose Gold', color: '#f43f5e' },
];

export const FEAR_COLOR_SWATCHES = [
  { label: 'Purple', color: '#a855f7' },
  { label: 'Crimson', color: '#ef4444' },
  { label: 'Void Indigo', color: '#6366f1' },
  { label: 'Shadow Slate', color: '#475569' },
  { label: 'Abyssal Black', color: '#1e1b4b' },
];

type ActiveSlot = 'hope' | 'fear' | 'standard' | 'negative';

interface DiceStylePickerProps {
  currentStyle?: DiceStyle;
  customization?: DiceCustomization;
  onSelect?: (style: DiceStyle) => void;
  onUpdateCustomization?: (customization: DiceCustomization) => void;
  compact?: boolean;
}

export const DiceStylePicker: React.FC<DiceStylePickerProps> = ({
  currentStyle,
  customization: initialCustomization,
  onSelect,
  onUpdateCustomization,
  compact = false,
}) => {
  const [activeSlot, setActiveSlot] = useState<ActiveSlot>('hope');
  const [config, setConfig] = useState<DiceCustomization>(
    initialCustomization || {
      ...DEFAULT_DICE_CUSTOMIZATION,
      standardStyle: currentStyle || DEFAULT_DICE_CUSTOMIZATION.standardStyle,
    }
  );

  useEffect(() => {
    const loadStored = async () => {
      try {
        const stored = await OBRStorage.getDiceCustomization();
        if (stored) {
          setConfig(stored);
        }
      } catch (e) {
        console.error('Failed to load dice customization:', e);
      }
    };
    loadStored();
  }, []);

  const updateConfig = async (partial: Partial<DiceCustomization>) => {
    const updated: DiceCustomization = { ...config, ...partial };
    setConfig(updated);
    await OBRStorage.setDiceCustomization(updated);
    if (partial.standardStyle && onSelect) {
      onSelect(partial.standardStyle);
    }
    if (onUpdateCustomization) {
      onUpdateCustomization(updated);
    }
  };

  const handleSelectStyleForSlot = (style: DiceStyle) => {
    switch (activeSlot) {
      case 'hope':
        updateConfig({ hopeStyle: style });
        break;
      case 'fear':
        updateConfig({ fearStyle: style });
        break;
      case 'standard':
        updateConfig({ standardStyle: style });
        break;
      case 'negative':
        updateConfig({ negativeStyle: style });
        break;
    }
  };

  const currentSelectedStyleForSlot = (): DiceStyle => {
    switch (activeSlot) {
      case 'hope':
        return config.hopeStyle;
      case 'fear':
        return config.fearStyle;
      case 'standard':
        return config.standardStyle;
      case 'negative':
        return config.negativeStyle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Icons.Dice className="text-accent" size={18} />
            3D Dice Customizer & Theme Studio
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Personalize your Hope die, Fear die, Standard dice, and glowing roll HUD accents.
          </p>
        </div>
      </div>

      {/* Preset Theme Quick Bar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Quick Preset Themes</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PRESET_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => updateConfig(theme.config)}
              className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-accent hover:bg-zinc-800/80 transition-all text-left group shadow-sm active:scale-95"
            >
              <span className="text-xl">{theme.icon}</span>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">{theme.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">{theme.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Active Dice Preview Deck */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Dice Loadout (Click to Customize)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Hope Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('hope')}
            className={clsx(
              "relative p-3 rounded-2xl border transition-all flex flex-col items-center text-center shadow-lg",
              activeSlot === 'hope'
                ? "bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/50 shadow-amber-500/10"
                : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 font-mono shadow-sm"
              style={{ backgroundColor: `${config.hopeGlowColor || '#eab308'}25`, color: config.hopeGlowColor || '#eab308' }}
            >
              Hope Die (D12)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.hopeStyle]}
                alt="Hope Die"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1">{config.hopeStyle}</span>
            <span className="text-[10px] text-zinc-400">Positive Check Die</span>
          </button>

          {/* Fear Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('fear')}
            className={clsx(
              "relative p-3 rounded-2xl border transition-all flex flex-col items-center text-center shadow-lg",
              activeSlot === 'fear'
                ? "bg-purple-500/10 border-purple-400 ring-2 ring-purple-400/50 shadow-purple-500/10"
                : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 font-mono shadow-sm"
              style={{ backgroundColor: `${config.fearGlowColor || '#a855f7'}25`, color: config.fearGlowColor || '#a855f7' }}
            >
              Fear Die (D12)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.fearStyle]}
                alt="Fear Die"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1">{config.fearStyle}</span>
            <span className="text-[10px] text-zinc-400">GM Resource Die</span>
          </button>

          {/* Standard Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('standard')}
            className={clsx(
              "relative p-3 rounded-2xl border transition-all flex flex-col items-center text-center shadow-lg",
              activeSlot === 'standard'
                ? "bg-accent/10 border-accent ring-2 ring-accent/50 shadow-accent/10"
                : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 font-mono bg-accent/20 text-accent">
              Standard Dice
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.standardStyle]}
                alt="Standard Dice"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1">{config.standardStyle}</span>
            <span className="text-[10px] text-zinc-400">D4, D6, D8, D10, D20</span>
          </button>

          {/* Negative Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('negative')}
            className={clsx(
              "relative p-3 rounded-2xl border transition-all flex flex-col items-center text-center shadow-lg",
              activeSlot === 'negative'
                ? "bg-zinc-800 border-zinc-400 ring-2 ring-zinc-400/50"
                : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 font-mono bg-zinc-800 text-zinc-300">
              Subtracted (-)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.negativeStyle]}
                alt="Negative Dice"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1">{config.negativeStyle}</span>
            <span className="text-[10px] text-zinc-400">Negative Penalty Dice</span>
          </button>
        </div>
      </div>

      {/* Style Selector Grid for Active Slot */}
      <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Choose Skin for:</span>
              <span className="text-accent px-2 py-0.5 rounded bg-accent/20 font-mono">
                {activeSlot.toUpperCase()} DIE
              </span>
            </h4>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Selected: <strong className="text-white">{currentSelectedStyleForSlot()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {AVAILABLE_STYLES.map((style) => {
            const isSelected = currentSelectedStyleForSlot() === style.id;
            const previewImg = standardPreviews[style.id];

            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleSelectStyleForSlot(style.id)}
                className={clsx(
                  "relative group flex flex-col items-center p-3 rounded-xl border transition-all text-center",
                  isSelected
                    ? "bg-accent/20 border-accent shadow-lg shadow-accent/15 ring-1 ring-accent"
                    : "bg-zinc-950/80 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center text-[10px] shadow">
                    <Icons.Check size={10} />
                  </div>
                )}

                <div className="w-12 h-12 flex items-center justify-center mb-1.5 rounded-lg overflow-hidden transition-transform group-hover:scale-110">
                  <img
                    src={previewImg}
                    alt={style.name}
                    className="w-10 h-10 object-contain drop-shadow"
                  />
                </div>

                <span className={clsx(
                  "text-xs font-semibold tracking-wide",
                  isSelected ? "text-accent font-bold" : "text-zinc-200 group-hover:text-white"
                )}>
                  {style.name}
                </span>
                <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  {style.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Glow Tint Options for Hope & Fear Slots */}
        {activeSlot === 'hope' && (
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-zinc-300">Hope Glow Accent Color:</span>
            <div className="flex items-center gap-2">
              {HOPE_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => updateConfig({ hopeGlowColor: swatch.color })}
                  className={clsx(
                    "w-6 h-6 rounded-full border-2 transition-transform",
                    config.hopeGlowColor === swatch.color ? "scale-125 border-white shadow-md" : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>
        )}

        {activeSlot === 'fear' && (
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-zinc-300">Fear Glow Accent Color:</span>
            <div className="flex items-center gap-2">
              {FEAR_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => updateConfig({ fearGlowColor: swatch.color })}
                  className={clsx(
                    "w-6 h-6 rounded-full border-2 transition-transform",
                    config.fearGlowColor === swatch.color ? "scale-125 border-white shadow-md" : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Physics Throw Speed Multiplier */}
      <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">3D Physics Throw Speed</h4>
          <p className="text-[11px] text-zinc-400 mt-0.5">Control how fast dice tumble and settle into the tray.</p>
        </div>

        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
          {[
            { label: 'Normal (1.0x)', speed: 1.0 },
            { label: 'Fast (1.5x)', speed: 1.5 },
            { label: 'Turbo (2.0x)', speed: 2.0 },
          ].map((item) => (
            <button
              key={item.speed}
              type="button"
              onClick={() => updateConfig({ diceSpeedMultiplier: item.speed })}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                (config.diceSpeedMultiplier || 1.0) === item.speed
                  ? "bg-accent text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

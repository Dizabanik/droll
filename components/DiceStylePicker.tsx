import React, { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { DiceStyle } from '../dice-engine/types/DiceStyle';
import { standardPreviews } from '../dice-engine/sets/diceSets';
import { DiceCustomization, DEFAULT_DICE_CUSTOMIZATION } from '../types';
import { OBRStorage } from '../obr';
import clsx from 'clsx';
import { Icons } from './ui/Icons';

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
  IconComponent: LucideIcon;
  iconColor: string;
  config: Partial<DiceCustomization>;
}[] = [
  {
    id: 'classic',
    name: 'Classic Daggerheart',
    desc: 'Golden Sunrise Hope, Cosmic Galaxy Fear, Gemstone polyhedrals',
    IconComponent: Icons.Magic,
    iconColor: 'text-amber-400',
    config: {
      standardStyle: 'GEMSTONE',
      hopeStyle: 'SUNRISE',
      fearStyle: 'GALAXY',
      negativeStyle: 'IRON',
    },
  },
  {
    id: 'blood_steel',
    name: 'Blood & Steel',
    desc: 'Radiant Sunrise Hope, Forged Iron Fear, Battle Iron polyhedrals',
    IconComponent: Icons.Attack,
    iconColor: 'text-rose-400',
    config: {
      standardStyle: 'IRON',
      hopeStyle: 'SUNRISE',
      fearStyle: 'IRON',
      negativeStyle: 'IRON',
    },
  },
  {
    id: 'ancient_grove',
    name: 'Ancient Grove',
    desc: 'Emerald Gemstone Hope, Dark Walnut Fear, Carved Walnut polyhedrals',
    IconComponent: Icons.Defense,
    iconColor: 'text-emerald-400',
    config: {
      standardStyle: 'WALNUT',
      hopeStyle: 'GEMSTONE',
      fearStyle: 'WALNUT',
      negativeStyle: 'IRON',
    },
  },
  {
    id: 'astral_void',
    name: 'Astral Void',
    desc: 'Nebula Hope, Deep Galaxy Fear, Translucent Glass polyhedrals',
    IconComponent: Icons.Psychic,
    iconColor: 'text-purple-400',
    config: {
      standardStyle: 'GLASS',
      hopeStyle: 'NEBULA',
      fearStyle: 'GALAXY',
      negativeStyle: 'IRON',
    },
  },
  {
    id: 'solar_eclipse',
    name: 'Solar Eclipse',
    desc: 'Blazing Sunrise Hope, Amber Sunset Fear, Frosted Glass polyhedrals',
    IconComponent: Icons.Radiant,
    iconColor: 'text-yellow-400',
    config: {
      standardStyle: 'GLASS',
      hopeStyle: 'SUNRISE',
      fearStyle: 'SUNSET',
      negativeStyle: 'IRON',
    },
  },
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
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <Icons.Dice className="text-white" size={16} />
            3D Dice Appearance
          </h3>
          <p className="text-[11px] text-muted font-mono mt-0.5">
            Configure skins for Hope, Fear, and Polyhedral dice.
          </p>
        </div>
      </div>

      {/* Preset Theme Quick Bar */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Curated Palettes</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PRESET_THEMES.map((theme) => {
            const IconComp = theme.IconComponent;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => updateConfig(theme.config)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-surface/50 border border-neutral-800 hover:border-neutral-600 hover:bg-surface transition-all text-left group shadow-fey-subtle active:scale-95"
              >
                <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center border border-neutral-800 shrink-0">
                  <IconComp size={14} className="text-white" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-white truncate">{theme.name}</div>
                  <div className="text-[9px] text-muted truncate font-mono">{theme.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Active Dice Preview Deck */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Dice Slots (Select to Customize)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Hope Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('hope')}
            className={clsx(
              "relative p-3.5 rounded-2xl border transition-all flex flex-col items-center text-center shadow-fey-subtle",
              activeSlot === 'hope'
                ? "bg-surface border-signal shadow-fey-signal"
                : "bg-surface/40 border-neutral-800 hover:border-neutral-700"
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2 font-mono bg-signal/15 text-signal border border-signal/30">
              Hope (D12)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.hopeStyle]}
                alt="Hope Die"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1 font-mono">{config.hopeStyle}</span>
            <span className="text-[10px] text-muted">Player Die</span>
          </button>

          {/* Fear Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('fear')}
            className={clsx(
              "relative p-3.5 rounded-2xl border transition-all flex flex-col items-center text-center shadow-fey-subtle",
              activeSlot === 'fear'
                ? "bg-surface border-ember shadow-fey-ember"
                : "bg-surface/40 border-neutral-800 hover:border-neutral-700"
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2 font-mono bg-ember/15 text-ember border border-ember/30">
              Fear (D12)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.fearStyle]}
                alt="Fear Die"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1 font-mono">{config.fearStyle}</span>
            <span className="text-[10px] text-muted">GM Die</span>
          </button>

          {/* Standard Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('standard')}
            className={clsx(
              "relative p-3.5 rounded-2xl border transition-all flex flex-col items-center text-center shadow-fey-subtle",
              activeSlot === 'standard'
                ? "bg-surface border-white shadow-fey-glow"
                : "bg-surface/40 border-neutral-800 hover:border-neutral-700"
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2 font-mono bg-white/10 text-white border border-white/20">
              Standard
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.standardStyle]}
                alt="Standard Dice"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1 font-mono">{config.standardStyle}</span>
            <span className="text-[10px] text-muted">d4, d6, d8, d10, d20</span>
          </button>

          {/* Negative Slot */}
          <button
            type="button"
            onClick={() => setActiveSlot('negative')}
            className={clsx(
              "relative p-3.5 rounded-2xl border transition-all flex flex-col items-center text-center shadow-fey-subtle",
              activeSlot === 'negative'
                ? "bg-surface border-neutral-400 shadow-fey-subtle"
                : "bg-surface/40 border-neutral-800 hover:border-neutral-700"
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2 font-mono bg-elevated text-muted border border-neutral-700">
              Penalty (-)
            </span>
            <div className="w-12 h-12 flex items-center justify-center my-1">
              <img
                src={standardPreviews[config.negativeStyle]}
                alt="Negative Dice"
                className="w-10 h-10 object-contain drop-shadow"
              />
            </div>
            <span className="text-xs font-bold text-white mt-1 font-mono">{config.negativeStyle}</span>
            <span className="text-[10px] text-muted">Subtracted dice</span>
          </button>
        </div>
      </div>

      {/* Style Selector Grid for Active Slot */}
      <div className="p-4 bg-surface rounded-2xl border border-neutral-800 space-y-3.5 shadow-fey-subtle">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div>
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono flex items-center gap-2">
              <span>Apply Texture to:</span>
              <span className="text-white px-2 py-0.5 rounded-full bg-elevated border border-neutral-700 font-mono">
                {activeSlot.toUpperCase()}
              </span>
            </h4>
          </div>
          <span className="text-[11px] font-mono text-muted">
            Current: <strong className="text-white">{currentSelectedStyleForSlot()}</strong>
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
                    ? "bg-elevated border-white shadow-fey-glow"
                    : "bg-surface/50 border-neutral-800/80 hover:border-neutral-700 hover:bg-elevated/50"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[9px] shadow-fey-subtle font-bold">
                    <Icons.Check size={10} />
                  </div>
                )}

                <div className="w-12 h-12 flex items-center justify-center mb-1.5 rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                  <img
                    src={previewImg}
                    alt={style.name}
                    className="w-10 h-10 object-contain drop-shadow"
                  />
                </div>

                <span className={clsx(
                  "text-xs font-semibold tracking-wide",
                  isSelected ? "text-white font-bold" : "text-mist group-hover:text-white"
                )}>
                  {style.name}
                </span>
                <span className="text-[9px] text-muted line-clamp-1 mt-0.5 font-mono">
                  {style.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};


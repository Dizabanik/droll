import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DicePreview } from '../dice-engine/previews/DicePreview';
import { DiceType } from '../dice-engine/types/DiceType';
import { DicePreset } from '../types';
import { generateId } from '../utils/engine';
import { Icons } from './ui/Icons';
import clsx from 'clsx';

interface QuickDiceToolbarProps {
  onRollPreset: (preset: DicePreset, itemName: string) => void;
  className?: string;
}

const DIE_TYPES: Array<{ type: DiceType; label: string; sides: number }> = [
  { type: 'D20', label: 'd20', sides: 20 },
  { type: 'D12', label: 'd12', sides: 12 },
  { type: 'D10', label: 'd10', sides: 10 },
  { type: 'D8', label: 'd8', sides: 8 },
  { type: 'D6', label: 'd6', sides: 6 },
  { type: 'D4', label: 'd4', sides: 4 },
  { type: 'D100', label: 'd100', sides: 100 },
];

export const QuickDiceToolbar: React.FC<QuickDiceToolbarProps> = ({ onRollPreset, className }) => {
  const [selectedDice, setSelectedDice] = useState<Record<DiceType, number>>({
    D20: 0,
    D12: 0,
    D10: 0,
    D8: 0,
    D6: 0,
    D4: 0,
    D100: 0,
  });
  const [isHidden, setIsHidden] = useState(false);

  const totalDiceCount = Object.values(selectedDice).reduce((a, b) => a + b, 0);

  // Trigger immediate Duality Roll (1 Hope d12 + 1 Fear d12)
  const handleRollDuality = () => {
    const dualityPreset: DicePreset = {
      id: `duality-roll-${generateId()}`,
      name: 'Duality Roll',
      variables: [],
      steps: [
        {
          id: 'dh_duality_step',
          label: 'Duality Roll',
          type: 'daggerheart',
          formula: '2d12',
          damageType: 'none',
          addToSum: true,
          isCrit: true,
        },
      ],
    };
    onRollPreset(dualityPreset, 'Duality (Hope & Fear)');
  };

  // Add die to staged pool
  const handleDieClick = (type: DiceType) => {
    setSelectedDice((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
  };

  // Clear staged dice
  const handleClear = () => {
    setSelectedDice({
      D20: 0,
      D12: 0,
      D10: 0,
      D8: 0,
      D6: 0,
      D4: 0,
      D100: 0,
    });
  };

  // Roll all staged dice
  const handleExecutePoolRoll = () => {
    if (totalDiceCount === 0) return;

    const formulaParts: string[] = [];
    Object.entries(selectedDice).forEach(([type, count]) => {
      if (count > 0) {
        const sides = type === 'D100' ? 100 : parseInt(type.replace('D', ''), 10);
        formulaParts.push(`${count}d${sides}`);
      }
    });

    const combinedFormula = formulaParts.join('+');
    const poolPreset: DicePreset = {
      id: `pool-roll-${generateId()}`,
      name: `Roll ${combinedFormula}`,
      variables: [],
      steps: [
        {
          id: 'pool_step',
          label: combinedFormula,
          type: 'standard',
          formula: combinedFormula,
          damageType: 'none',
          addToSum: true,
          isCrit: false,
        },
      ],
    };

    onRollPreset(poolPreset, `Quick Roll (${combinedFormula})`);
    handleClear();
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-2 p-2 bg-zinc-950/80 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto select-none",
        className
      )}
    >
      {/* 1. Duality Dice Button (Replaces set picker at the top) */}
      <button
        onClick={handleRollDuality}
        className="group relative flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-b from-amber-500/20 via-purple-500/20 to-zinc-900/80 border border-amber-500/40 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-purple-500/20"
        title="Roll Duality Dice (Hope & Fear)"
      >
        <div className="flex items-center -space-x-2">
          {/* Hope Mini Preview (Sunrise) */}
          <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-400/60 shadow-sm flex items-center justify-center bg-amber-950/40">
            <DicePreview diceStyle="SUNRISE" diceType="D12" size="small" />
          </div>
          {/* Fear Mini Preview (Galaxy) */}
          <div className="w-6 h-6 rounded-full overflow-hidden border border-purple-400/60 shadow-sm flex items-center justify-center bg-purple-950/40">
            <DicePreview diceStyle="GALAXY" diceType="D12" size="small" />
          </div>
        </div>
        <span className="text-[9px] font-bold tracking-wider text-amber-300 group-hover:text-amber-200 mt-1 uppercase">
          Duality
        </span>
      </button>

      <div className="w-8 h-px bg-zinc-800 my-0.5" />

      {/* 2. Standard Polyhedral Dice */}
      <div className="flex flex-col gap-1.5">
        {DIE_TYPES.map(({ type, label, sides }) => {
          const count = selectedDice[type];
          return (
            <button
              key={type}
              onClick={() => handleDieClick(type)}
              className={clsx(
                "relative p-1.5 rounded-xl border transition-all flex items-center justify-center hover:scale-105 active:scale-95",
                count > 0
                  ? "bg-accent/20 border-accent text-white shadow-md shadow-accent/20"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              )}
              title={`Add ${label} to roll`}
            >
              <DicePreview diceStyle="GEMSTONE" diceType={type} size="medium" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-black font-bold text-[10px] flex items-center justify-center shadow-md animate-in zoom-in-50">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Actions / Roll Trigger when dice are staged */}
      <AnimatePresence>
        {totalDiceCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.8 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-1 mt-1 w-full"
          >
            <div className="w-8 h-px bg-zinc-800" />
            <button
              onClick={handleExecutePoolRoll}
              className="w-full py-2 px-1 rounded-xl bg-accent text-zinc-950 font-bold text-xs hover:bg-accent/90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1"
              title="Roll selected dice"
            >
              <Icons.Dice size={14} />
              <span>Roll ({totalDiceCount})</span>
            </button>
            <button
              onClick={handleClear}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 py-0.5 transition-colors"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

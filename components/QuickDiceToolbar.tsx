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
  const [modifier, setModifier] = useState<number>(0);

  const activeDiceEntries = Object.entries(selectedDice).filter(([_, count]) => count !== 0);
  const hasStagedRoll = activeDiceEntries.length > 0 || modifier !== 0;

  // Left click: increment count (+1)
  const handleLeftClick = (type: DiceType) => {
    setSelectedDice((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
  };

  // Right click: decrement count. If 0, becomes -1 (subtracting die)
  const handleRightClick = (type: DiceType, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedDice((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) - 1,
    }));
  };

  // Reset all staged dice and modifier
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
    setModifier(0);
  };

  // Roll Duality Dice (Hope & Fear d12s) with current modifier
  const handleRollDuality = () => {
    const modString = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';
    const formula = `2d12${modString}`;
    const dualityPreset: DicePreset = {
      id: `duality-roll-${generateId()}`,
      name: `Duality Roll ${modString}`,
      variables: [],
      steps: [
        {
          id: 'dh_duality_step',
          label: `Duality Roll ${modString}`,
          type: 'daggerheart',
          formula,
          damageType: 'none',
          addToSum: true,
          isCrit: true,
        },
      ],
    };
    onRollPreset(dualityPreset, `Duality (Hope & Fear) ${modString}`);
  };

  // Execute the composite roll from staged dice + modifier
  const handleExecutePoolRoll = () => {
    if (!hasStagedRoll) return;

    const formulaParts: string[] = [];

    // 1. Positive Dice
    activeDiceEntries
      .filter(([_, count]) => count > 0)
      .forEach(([type, count]) => {
        const sides = type === 'D100' ? 100 : parseInt(type.replace('D', ''), 10);
        formulaParts.push(`${count}d${sides}`);
      });

    // 2. Negative Dice (subtracted)
    activeDiceEntries
      .filter(([_, count]) => count < 0)
      .forEach(([type, count]) => {
        const sides = type === 'D100' ? 100 : parseInt(type.replace('D', ''), 10);
        const absCount = Math.abs(count);
        formulaParts.push(`-${absCount}d${sides}`);
      });

    // 3. Modifier
    if (modifier !== 0) {
      formulaParts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
    }

    // Build formula string (e.g. "1d20+1d4-1d6+2")
    let combinedFormula = formulaParts.join('+').replace(/\+\-/g, '-');
    if (combinedFormula.startsWith('+')) {
      combinedFormula = combinedFormula.slice(1);
    }
    if (!combinedFormula) {
      combinedFormula = '1d20';
    }

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
        "flex flex-col items-center gap-1.5 p-1.5 bg-zinc-950/90 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto select-none",
        className
      )}
    >
      {/* 1. Duality Dice Button (Replaces set picker at the top) */}
      <button
        onClick={handleRollDuality}
        className="group relative flex flex-col items-center justify-center p-1.5 rounded-xl bg-gradient-to-b from-amber-500/25 via-purple-500/20 to-zinc-900/90 border border-amber-500/40 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-purple-500/30"
        title="Roll Duality Dice (Hope & Fear)"
      >
        <div className="flex items-center -space-x-2">
          {/* Hope Mini Preview (Sunrise) */}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/70 shadow-sm flex items-center justify-center bg-amber-950/50">
            <DicePreview diceStyle="SUNRISE" diceType="D12" size="small" />
          </div>
          {/* Fear Mini Preview (Galaxy) */}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-purple-400/70 shadow-sm flex items-center justify-center bg-purple-950/50">
            <DicePreview diceStyle="GALAXY" diceType="D12" size="small" />
          </div>
        </div>
        <span className="text-[8px] font-black tracking-wider text-amber-300 group-hover:text-amber-200 mt-0.5 uppercase">
          Duality
        </span>
      </button>

      <div className="w-8 h-px bg-zinc-800 my-0.5" />

      {/* 2. Standard Polyhedral Dice */}
      <div className="flex flex-col gap-1">
        {DIE_TYPES.map(({ type, label }) => {
          const count = selectedDice[type] || 0;
          const isPositive = count > 0;
          const isNegative = count < 0;

          return (
            <button
              key={type}
              onClick={() => handleLeftClick(type)}
              onContextMenu={(e) => handleRightClick(type, e)}
              className={clsx(
                "relative p-1 rounded-xl border transition-all flex items-center justify-center hover:scale-105 active:scale-95",
                isPositive && "bg-accent/25 border-accent text-white shadow-md shadow-accent/20",
                isNegative && "bg-rose-950/40 border-rose-500 text-rose-300 shadow-md shadow-rose-900/30",
                !isPositive && !isNegative && "bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              )}
              title={`${label} (Left-click: +1 | Right-click: -1 / Subtract)`}
            >
              <DicePreview
                diceStyle={isNegative ? "IRON" : "GEMSTONE"}
                diceType={type}
                size="medium"
              />

              {/* Count Badge */}
              {count !== 0 && (
                <span
                  className={clsx(
                    "absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full font-black text-[9px] flex items-center justify-center shadow-md animate-in zoom-in-50",
                    isPositive ? "bg-accent text-black" : "bg-rose-600 text-white"
                  )}
                >
                  {count > 0 ? `+${count}` : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="w-8 h-px bg-zinc-800 my-0.5" />

      {/* 3. Manual Flat Modifier Stepper (+- buttons) */}
      <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-lg p-0.5" title="Manual Roll Modifier">
        <button
          onClick={() => setModifier((m) => m - 1)}
          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors font-bold text-xs active:scale-90"
          title="Decrease Modifier (-1)"
        >
          -
        </button>

        <span
          onClick={() => setModifier(0)}
          className={clsx(
            "min-w-6 text-center text-[10px] font-mono font-bold cursor-pointer transition-colors px-0.5",
            modifier > 0 && "text-amber-400",
            modifier < 0 && "text-rose-400",
            modifier === 0 && "text-zinc-500 hover:text-zinc-300"
          )}
          title="Click to Reset Modifier"
        >
          {modifier >= 0 ? `+${modifier}` : `${modifier}`}
        </span>

        <button
          onClick={() => setModifier((m) => m + 1)}
          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-accent hover:bg-zinc-800 transition-colors font-bold text-xs active:scale-90"
          title="Increase Modifier (+1)"
        >
          +
        </button>
      </div>

      {/* 4. Action Buttons when Dice / Modifiers are staged */}
      <AnimatePresence>
        {hasStagedRoll && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.8 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-1 mt-0.5 w-full"
          >
            <button
              onClick={handleExecutePoolRoll}
              className="w-full py-1.5 px-1 rounded-xl bg-accent text-zinc-950 font-bold text-[11px] hover:bg-accent/90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1"
              title="Roll selected dice"
            >
              <Icons.Dice size={13} />
              <span>Roll</span>
            </button>
            <button
              onClick={handleClear}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 py-0.5 transition-colors"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

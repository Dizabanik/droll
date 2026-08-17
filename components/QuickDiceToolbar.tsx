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
  const [hasDuality, setHasDuality] = useState<boolean>(false);
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
  const [isCrit, setIsCrit] = useState<boolean>(false);

  const activeDiceEntries = Object.entries(selectedDice).filter(([_, count]) => count !== 0);
  const hasStagedRoll = hasDuality || activeDiceEntries.length > 0 || modifier !== 0;

  // Toggle Duality Dice (only 0 or 1)
  const handleToggleDuality = () => {
    setHasDuality((prev) => !prev);
  };

  // Left click: increment count (+1)
  const handleLeftClick = (type: DiceType) => {
    setSelectedDice((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
  };

  // Right click: decrement count. If <= 0, becomes negative (subtracted die)
  const handleRightClick = (type: DiceType, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedDice((prev) => ({
      ...prev,
      [type]: (prev[type] || 0) - 1,
    }));
  };

  // Reset all staged dice, duality, crit, and modifier
  const handleClear = () => {
    setHasDuality(false);
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
    setIsCrit(false);
  };

  // Execute the composite roll from staged dice + duality + modifier + crit
  const handleExecutePoolRoll = () => {
    if (!hasStagedRoll) return;

    const formulaParts: string[] = [];

    // 1. Duality base (2d12) if selected
    if (hasDuality) {
      formulaParts.push('2d12');
    }

    // 2. Positive Extra Dice
    activeDiceEntries
      .filter(([_, count]) => count > 0)
      .forEach(([type, count]) => {
        const sides = type === 'D100' ? 100 : parseInt(type.replace('D', ''), 10);
        formulaParts.push(`${count}d${sides}`);
      });

    // 3. Negative Extra Dice (subtracted)
    activeDiceEntries
      .filter(([_, count]) => count < 0)
      .forEach(([type, count]) => {
        const sides = type === 'D100' ? 100 : parseInt(type.replace('D', ''), 10);
        const absCount = Math.abs(count);
        formulaParts.push(`-${absCount}d${sides}`);
      });

    // 4. Modifier
    if (modifier !== 0) {
      formulaParts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
    }

    // Build formula string
    let combinedFormula = formulaParts.join('+').replace(/\+\-/g, '-');
    if (combinedFormula.startsWith('+')) {
      combinedFormula = combinedFormula.slice(1);
    }
    if (!combinedFormula) {
      combinedFormula = '1d20';
    }

    const presetName = hasDuality
      ? `Duality Roll (${combinedFormula})`
      : `Roll ${combinedFormula}`;

    const poolPreset: DicePreset = {
      id: `pool-roll-${generateId()}`,
      name: isCrit ? `${presetName} [CRIT]` : presetName,
      variables: [],
      steps: [
        {
          id: 'pool_step',
          label: combinedFormula,
          type: hasDuality ? 'daggerheart' : 'standard',
          formula: combinedFormula,
          damageType: 'none',
          addToSum: true,
          isCrit: isCrit,
        },
      ],
    };

    const labelName = hasDuality
      ? `Duality (Hope & Fear)${isCrit ? ' [CRIT]' : ''}`
      : `Quick Roll${isCrit ? ' [CRIT]' : ''}`;

    onRollPreset(poolPreset, labelName);
    handleClear();
  };

  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-1.5 p-1.5 bg-zinc-950/90 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto select-none",
        className
      )}
    >
      {/* 1. Duality Dice Button (Icon only, no text) */}
      <button
        onClick={handleToggleDuality}
        onContextMenu={(e) => {
          e.preventDefault();
          handleToggleDuality();
        }}
        className={clsx(
          "group relative flex items-center justify-center p-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 shadow-lg",
          hasDuality
            ? "bg-gradient-to-b from-amber-500/30 via-purple-500/25 to-zinc-900 border-amber-400 shadow-amber-500/30 ring-1 ring-amber-400/50"
            : "bg-zinc-900/80 border-zinc-800 hover:border-amber-500/50 opacity-70 hover:opacity-100"
        )}
        title="Duality Dice (1 Hope + 1 Fear d12) - Click to toggle in pool"
      >
        <div className="flex items-center -space-x-2 py-0.5">
          {/* Hope Mini Preview (Sunrise) */}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/80 shadow-sm flex items-center justify-center bg-amber-950/60">
            <DicePreview diceStyle="SUNRISE" diceType="D12" size="small" />
          </div>
          {/* Fear Mini Preview (Galaxy) */}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-purple-400/80 shadow-sm flex items-center justify-center bg-purple-950/60">
            <DicePreview diceStyle="GALAXY" diceType="D12" size="small" />
          </div>
        </div>

        {/* Selected indicator badge */}
        {hasDuality && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-black font-black text-[9px] flex items-center justify-center shadow-md animate-in zoom-in-50">
            1
          </span>
        )}
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

      {/* 3. Manual Flat Modifier Stepper with Direct Input */}
      <div className="flex items-center gap-0.5 bg-zinc-900/90 border border-zinc-800 rounded-lg p-0.5 w-full justify-between" title="Manual Roll Modifier (type number or click +/-)">
        <button
          onClick={() => setModifier((m) => m - 1)}
          className="w-4 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors font-bold text-xs active:scale-90"
          title="Decrease Modifier (-1)"
        >
          -
        </button>

        <input
          type="number"
          value={modifier === 0 ? '' : modifier}
          placeholder="0"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setModifier(isNaN(val) ? 0 : val);
          }}
          className={clsx(
            "w-9 bg-transparent text-center text-[10px] font-mono font-bold focus:outline-none border-b border-transparent focus:border-zinc-500",
            modifier > 0 && "text-amber-400",
            modifier < 0 && "text-rose-400",
            modifier === 0 && "text-zinc-500"
          )}
        />

        <button
          onClick={() => setModifier((m) => m + 1)}
          className="w-4 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-accent hover:bg-zinc-800 transition-colors font-bold text-xs active:scale-90"
          title="Increase Modifier (+1)"
        >
          +
        </button>
      </div>

      {/* 4. CRIT Toggle Button */}
      <button
        onClick={() => setIsCrit((c) => !c)}
        className={clsx(
          "w-full py-1 px-1 rounded-lg border font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95",
          isCrit
            ? "bg-yellow-500/25 border-yellow-400 text-yellow-300 shadow-md shadow-yellow-500/30 ring-1 ring-yellow-400/40"
            : "bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
        )}
        title="Toggle Critical Hit (Maximizes positive dice values + roll + mod)"
      >
        <Icons.Target size={11} className={isCrit ? "text-yellow-400" : "text-zinc-500"} />
        <span>Crit</span>
      </button>

      {/* 5. Actions / Roll Trigger when Dice / Modifiers / Duality are staged */}
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
              title="Roll staged dice"
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

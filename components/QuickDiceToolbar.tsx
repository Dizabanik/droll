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
  onFoldChange?: (folded: boolean) => void;
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

export const QuickDiceToolbar: React.FC<QuickDiceToolbarProps> = ({
  onRollPreset,
  className,
  onFoldChange,
}) => {
  const [isFolded, setIsFolded] = useState<boolean>(false);
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

  const toggleFold = () => {
    setIsFolded((prev) => {
      const next = !prev;
      onFoldChange?.(next);
      return next;
    });
  };

  // Toggle Duality Dice (0 or 1)
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

  // Execute the composite roll
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
        "flex flex-col items-center select-none bg-transparent pointer-events-auto",
        className
      )}
    >
      {/* 1. Fold / Unfold Toggle Button at Absolute Top */}
      <button
        onClick={toggleFold}
        className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md backdrop-blur-md",
          isFolded
            ? "bg-zinc-900/90 text-accent border border-zinc-700/80 hover:bg-zinc-800 hover:scale-110"
            : "bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-zinc-800/50 mb-1"
        )}
        title={isFolded ? "Unfold Dice Toolbar" : "Fold Dice Toolbar"}
      >
        {isFolded ? (
          <Icons.Dice size={15} className="text-accent" />
        ) : (
          <Icons.ChevronUp size={14} />
        )}
      </button>

      {/* 2. Unfolded Toolbar Content */}
      <AnimatePresence>
        {!isFolded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.85, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col items-center gap-1 overflow-hidden"
          >
            {/* Duality Die Button (Clean minimal icon) */}
            <button
              onClick={handleToggleDuality}
              onContextMenu={(e) => {
                e.preventDefault();
                handleToggleDuality();
              }}
              className={clsx(
                "group relative flex items-center justify-center p-1 rounded-xl transition-all hover:scale-110 active:scale-95",
                hasDuality
                  ? "bg-gradient-to-b from-amber-500/20 via-purple-500/20 to-transparent ring-1 ring-amber-400/80 shadow-lg shadow-amber-500/20"
                  : "opacity-75 hover:opacity-100 hover:bg-white/5"
              )}
              title="Duality Dice (1 Hope + 1 Fear d12) - Click to toggle in pool"
            >
              <div className="flex items-center -space-x-2">
                {/* Hope Mini Preview */}
                <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/80 shadow-sm flex items-center justify-center bg-amber-950/40">
                  <DicePreview diceStyle="SUNRISE" diceType="D12" size="small" />
                </div>
                {/* Fear Mini Preview */}
                <div className="w-5 h-5 rounded-full overflow-hidden border border-purple-400/80 shadow-sm flex items-center justify-center bg-purple-950/40">
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

            {/* Standard Polyhedral Dice */}
            <div className="flex flex-col gap-0.5 my-0.5">
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
                      "relative p-0.5 rounded-xl transition-all flex items-center justify-center hover:scale-110 active:scale-95",
                      isPositive && "ring-1 ring-accent bg-accent/15 shadow-sm shadow-accent/30",
                      isNegative && "ring-1 ring-rose-500 bg-rose-950/30 shadow-sm shadow-rose-900/30",
                      !isPositive && !isNegative && "opacity-80 hover:opacity-100 hover:bg-white/5"
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
                          "absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full font-black text-[8px] flex items-center justify-center shadow-md animate-in zoom-in-50",
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

            {/* Modifier Stepper & Input */}
            <div
              className="flex items-center gap-0.5 bg-zinc-900/80 border border-zinc-800/80 rounded-full px-1 py-0.5 shadow-sm my-0.5"
              title="Modifier (+/-)"
            >
              <button
                onClick={() => setModifier((m) => m - 1)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors font-bold text-xs active:scale-90"
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
                  "w-7 bg-transparent text-center text-[10px] font-mono font-bold focus:outline-none",
                  modifier > 0 && "text-amber-400",
                  modifier < 0 && "text-rose-400",
                  modifier === 0 && "text-zinc-500"
                )}
              />

              <button
                onClick={() => setModifier((m) => m + 1)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-400 hover:text-accent hover:bg-white/10 transition-colors font-bold text-xs active:scale-90"
              >
                +
              </button>
            </div>

            {/* CRIT Toggle Button */}
            <button
              onClick={() => setIsCrit((c) => !c)}
              className={clsx(
                "w-full py-0.5 px-1.5 rounded-full font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 my-0.5",
                isCrit
                  ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400/70 shadow-sm shadow-yellow-500/20"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
              title="Toggle Critical Hit (Max dice + actual roll)"
            >
              <Icons.Target size={10} className={isCrit ? "text-yellow-400" : "text-zinc-500"} />
              <span>Crit</span>
            </button>

            {/* Actions / Roll Trigger when staged */}
            <AnimatePresence>
              {hasStagedRoll && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center gap-0.5 mt-0.5 w-full"
                >
                  <button
                    onClick={handleExecutePoolRoll}
                    className="w-full py-1 px-2 rounded-full bg-accent text-zinc-950 font-bold text-[10px] hover:bg-accent/90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                    title="Roll staged dice"
                  >
                    <Icons.Dice size={12} />
                    <span>Roll</span>
                  </button>
                  <button
                    onClick={handleClear}
                    className="text-[8px] text-zinc-500 hover:text-zinc-300 py-0.5 transition-colors"
                  >
                    Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

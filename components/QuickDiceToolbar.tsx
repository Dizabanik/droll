import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DicePreview } from '../dice-engine/previews/DicePreview';
import { DiceType } from '../dice-engine/types/DiceType';
import { DicePreset } from '../types';
import { generateId, parseCustomDxFormula } from '../utils/engine';
import { Icons } from './ui/Icons';
import clsx from 'clsx';

interface QuickDiceToolbarProps {
  onRollPreset: (preset: DicePreset, itemName: string) => void;
  className?: string;
  onFoldChange?: (folded: boolean) => void;
  onCustomDxOpenChange?: (open: boolean) => void;
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
  onCustomDxOpenChange,
}) => {
  const [isFolded, setIsFolded] = useState<boolean>(false);
  const [hasDuality, setHasDuality] = useState<boolean>(false);
  const [isCustomDxOpen, setIsCustomDxOpen] = useState<boolean>(false);
  const [customDxFormula, setCustomDxFormula] = useState<string>('');
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
      if (next && isCustomDxOpen) {
        toggleCustomDx(false);
      }
      return next;
    });
  };

  const toggleCustomDx = (open?: boolean) => {
    setIsCustomDxOpen((prev) => {
      const next = open !== undefined ? open : !prev;
      onCustomDxOpenChange?.(next);
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

  // Execute standard pool roll
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

  // Parsed analysis of the typed custom dX formula in real-time
  const parsedCustom = useMemo(() => {
    if (!customDxFormula.trim()) return null;
    return parseCustomDxFormula(customDxFormula);
  }, [customDxFormula]);

  // Execute freeform custom dX formula roll
  const handleRollCustomDx = () => {
    if (!customDxFormula.trim()) return;
    const parsed = parseCustomDxFormula(customDxFormula);

    const presetName = parsed.hasDuality
      ? `Duality (${parsed.normalizedFormula})`
      : `Custom (${parsed.normalizedFormula})`;

    const poolPreset: DicePreset = {
      id: `custom-dx-${generateId()}`,
      name: isCrit ? `${presetName} [CRIT]` : presetName,
      variables: [],
      steps: [
        {
          id: 'dx_step',
          label: parsed.normalizedFormula,
          type: parsed.hasDuality ? 'daggerheart' : 'standard',
          formula: customDxFormula.trim(),
          damageType: 'none',
          addToSum: true,
          isCrit: isCrit,
        },
      ],
    };

    const labelName = parsed.hasDuality
      ? `Duality (${parsed.normalizedFormula})${isCrit ? ' [CRIT]' : ''}`
      : `Custom Roll (${parsed.normalizedFormula})${isCrit ? ' [CRIT]' : ''}`;

    onRollPreset(poolPreset, labelName);
    setCustomDxFormula('');
    toggleCustomDx(false);
  };

  return (
    <div
      className={clsx(
        "flex items-start select-none bg-transparent pointer-events-auto gap-2 overflow-visible",
        className
      )}
    >
      {/* Vertical Dice Selector Column */}
      <div className="flex flex-col items-center justify-start w-12 px-1 overflow-visible">
        {/* 1. Fold / Unfold Toggle Button at Absolute Top */}
        <button
          onClick={toggleFold}
          className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-fey-subtle backdrop-blur-md",
            isFolded
              ? "bg-surface text-white border border-neutral-700/80 hover:bg-elevated hover:scale-110"
              : "bg-surface/80 text-muted hover:text-white hover:bg-surface border border-neutral-800/80 mb-1"
          )}
          title={isFolded ? "Unfold Dice Toolbar" : "Fold Dice Toolbar"}
        >
          {isFolded ? (
            <Icons.Dice size={14} className="text-white" />
          ) : (
            <Icons.ChevronUp size={13} />
          )}
        </button>

        {/* 2. Unfolded Toolbar Content */}
        <AnimatePresence>
          {!isFolded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, height: 0 }}
              animate={{ opacity: 1, scale: 1, height: 'auto' }}
              exit={{ opacity: 0, scale: 0.85, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex flex-col items-center gap-1 overflow-visible w-full"
            >
              {/* Duality Die Button (Clean minimal icon) */}
              <button
                onClick={handleToggleDuality}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleToggleDuality();
                }}
                className={clsx(
                  "group relative flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:scale-105 active:scale-95",
                  hasDuality
                    ? "bg-surface text-signal border border-signal/80 shadow-fey-signal"
                    : "bg-surface/50 text-muted hover:text-white hover:bg-surface border border-neutral-800"
                )}
                title="Duality Dice (1 Hope + 1 Fear d12) - Click to toggle in pool"
              >
                <Icons.Duality size={18} className={hasDuality ? "text-signal stroke-[2]" : "text-mist"} />

                {/* Selected indicator badge */}
                {hasDuality && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-signal text-black font-black text-[9px] flex items-center justify-center shadow-md animate-in zoom-in-50">
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
                        isPositive && "ring-1 ring-white/90 bg-white/10 shadow-fey-subtle",
                        isNegative && "ring-1 ring-ember bg-ember/15 shadow-fey-ember",
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
                            isPositive ? "bg-white text-black" : "bg-ember text-black"
                          )}
                        >
                          {count > 0 ? `+${count}` : count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Custom Formula dX Button */}
                <button
                  type="button"
                  onClick={() => toggleCustomDx()}
                  className={clsx(
                    "relative w-7 h-7 rounded-xl font-mono font-bold text-[11px] transition-all flex items-center justify-center hover:scale-110 active:scale-95 shadow-fey-subtle my-0.5",
                    isCustomDxOpen
                      ? "bg-white text-black font-bold shadow-fey-glow"
                      : "bg-surface border border-neutral-800 text-mist hover:text-white hover:border-neutral-700"
                  )}
                  title="Write custom formula (e.g. 2d12+d4+6 or D+d6-2, supports d3, d7, etc.)"
                >
                  dX
                </button>
              </div>

              {/* Modifier Stepper & Input */}
              <div
                className="flex items-center gap-0.5 bg-surface border border-neutral-800 rounded-full px-1 py-0.5 shadow-fey-subtle my-0.5"
                title="Modifier (+/-)"
              >
                <button
                  onClick={() => setModifier((m) => m - 1)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors font-bold text-xs active:scale-90"
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
                    modifier > 0 && "text-growth",
                    modifier < 0 && "text-ember",
                    modifier === 0 && "text-muted"
                  )}
                />

                <button
                  onClick={() => setModifier((m) => m + 1)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors font-bold text-xs active:scale-90"
                >
                  +
                </button>
              </div>

              {/* CRIT Toggle Button */}
              <button
                onClick={() => setIsCrit((c) => !c)}
                className={clsx(
                  "w-full py-0.5 px-1.5 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 my-0.5 font-mono",
                  isCrit
                    ? "bg-ember/20 text-ember border border-ember/70 shadow-fey-ember"
                    : "text-muted hover:text-white hover:bg-white/5 border border-transparent"
                )}
                title="Toggle Critical Hit"
              >
                <Icons.Target size={10} className={isCrit ? "text-ember" : "text-muted"} />
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
                      className="w-full py-1 px-2 rounded-full bg-white text-black font-bold text-[10px] hover:bg-pale transition-all shadow-fey-subtle active:scale-95 flex items-center justify-center gap-1"
                      title="Roll staged dice"
                    >
                      <Icons.Dice size={12} />
                      <span>Roll</span>
                    </button>
                    <button
                      onClick={handleClear}
                      className="text-[8px] font-mono text-muted hover:text-white py-0.5 transition-colors uppercase tracking-wider"
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

      {/* Floating Custom dX Formula Input Popout */}
      <AnimatePresence>
        {isCustomDxOpen && !isFolded && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-56 p-3.5 bg-surface/95 backdrop-blur-md rounded-2xl border border-neutral-800 shadow-fey-xl space-y-2.5 z-50 text-left"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <span className="px-1.5 py-0.5 rounded-full bg-elevated border border-neutral-700 text-white text-[10px]">dX</span>
                Formula Roller
              </span>
              <button
                type="button"
                onClick={() => toggleCustomDx(false)}
                className="text-muted hover:text-white transition-colors p-0.5 rounded-full"
              >
                <Icons.Close size={12} />
              </button>
            </div>

            {/* Input Box */}
            <div className="space-y-1">
              <input
                type="text"
                value={customDxFormula}
                onChange={(e) => setCustomDxFormula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRollCustomDx();
                  }
                  if (e.key === 'Escape') {
                    toggleCustomDx(false);
                  }
                }}
                placeholder="2d12+d4+6 or D+d6-2"
                className="w-full px-2.5 py-1.5 bg-elevated border border-neutral-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-white/50"
                autoFocus
              />

              {/* Real-time Indicator Badges */}
              {parsedCustom && (
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  {parsedCustom.hasDuality ? (
                    <span className="text-signal font-medium">✨ Duality (Hope+Fear)</span>
                  ) : (
                    <span className="text-muted font-mono">{parsedCustom.normalizedFormula}</span>
                  )}

                  {parsedCustom.is3DSupported ? (
                    <span className="text-growth font-medium">🎲 3D Physics</span>
                  ) : (
                    <span className="text-mist font-medium">🔢 Math Roll</span>
                  )}
                </div>
              )}
            </div>

            {/* Example Formula Quick Chips */}
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-muted font-mono">Examples:</span>
              <div className="flex flex-wrap gap-1">
                {['D + d6 - 2', '2d12+d4+6', 'd3 + d7', '1d20+5'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setCustomDxFormula(example)}
                    className="px-2 py-0.5 rounded-full bg-elevated hover:bg-neutral-800 text-mist hover:text-white border border-neutral-800 text-[10px] font-mono transition-colors active:scale-95"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[9px] text-muted leading-tight">
              💡 <strong>'D'</strong> = Duality (Hope + Fear). Supports any dice (d2, d3, d7, etc.).
            </div>

            {/* Roll Button */}
            <button
              type="button"
              onClick={handleRollCustomDx}
              disabled={!customDxFormula.trim()}
              className={clsx(
                "w-full py-2 rounded-full font-bold text-xs transition-all shadow-fey-subtle flex items-center justify-center gap-1.5",
                customDxFormula.trim()
                  ? "bg-white hover:bg-pale text-black active:scale-95 cursor-pointer font-bold"
                  : "bg-elevated text-muted cursor-not-allowed border border-neutral-800"
              )}
            >
              <Icons.Dice size={14} />
              <span>Roll Formula</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

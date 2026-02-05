import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DicePreset, CharacterStats } from '../types';
import { PendingDie, getStepDiceConfig, checkCondition, resolveStepResult, createSkippedResult, getStatModifierValue, getStatLabel, parseFormula, generateId } from '../utils/engine';
import { RollResults } from './ui/RollResults';
import { OBRBroadcast, useOBR } from '../obr';
import { DicePlus, DicePlusResult } from '../utils/DicePlus';

interface RollerProps {
  preset: DicePreset | null;
  variables: Record<string, number>;
  characterStats: CharacterStats;
  itemName: string;
  onClose: () => void;
  hideCanvas?: boolean;
  showResultsUI?: boolean;
}

export const Roller: React.FC<RollerProps> = ({ preset, variables, characterStats, itemName, onClose, hideCanvas, showResultsUI = true }) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // Auto-close if UI is hidden
  useEffect(() => {
    if (isComplete && !showResultsUI) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000); // Brief delay to ensure broadcast went out
      return () => clearTimeout(timer);
    }
  }, [isComplete, showResultsUI, onClose]);

  // We keep configs to map results back to dice IDs
  const stepConfigsRef = useRef<Record<string, { dice: PendingDie[], baseModifier: number }>>({});
  const hasRolledRef = useRef(false);

  useEffect(() => {
    if (preset && !hasRolledRef.current) {
      hasRolledRef.current = true;
      executeSimultaneousRoll();
    }

    // Reset if preset changes (though Roller is usually unmounted/remounted)
    return () => {
      // Cleanup if needed
    };
  }, [preset]);

  const executeSimultaneousRoll = async () => {
    if (!preset) return;

    const configs: Record<string, { dice: PendingDie[], baseModifier: number }> = {};
    const formulaParts: string[] = [];

    // 1. Prepare Configs and Formulas
    preset.steps.forEach(step => {
      const config = getStepDiceConfig(step);

      // Override config dice for Daggerheart to match visual split logic
      if (step.type === 'daggerheart') {
        // Logic: N dice. Even: N/2 Hope, N/2 Fear. Odd: (N-1)/2 Hope, (N-1)/2 Fear, 1 Standard.
        const cleanFormula = (step.formula || '0').split('#')[0].trim();
        const match = cleanFormula.toLowerCase().match(/^(\d*)d(\d+)/);
        const count = match && match[1] ? parseInt(match[1]) : 1;
        const sides = match ? parseInt(match[2]) : 12; // Default to d12 if parsing fails for DH

        const hopeCount = Math.floor(count / 2);
        const fearCount = Math.floor(count / 2);
        const stdCount = count % 2;

        const dhDice: PendingDie[] = [];

        if (hopeCount > 0) formulaParts.push(`${hopeCount}d${sides}{Hope} # ${step.id}_hope`);
        if (fearCount > 0) formulaParts.push(`${fearCount}d${sides}{Fear} # ${step.id}_fear`);
        if (stdCount > 0) formulaParts.push(`${stdCount}d${sides} # ${step.id}_std`);

        // Rebuild config dice to match these expected pools for mapping later
        for (let i = 0; i < hopeCount; i++) dhDice.push({ id: generateId(), sides, type: 'hope' });
        for (let i = 0; i < fearCount; i++) dhDice.push({ id: generateId(), sides, type: 'fear' });
        // For the 'odd' standard die in DH, we treat it as standard type
        for (let i = 0; i < stdCount; i++) dhDice.push({ id: generateId(), sides, type: 'standard' });

        config.dice = dhDice;
      } else {
        // Standard: Extract DICE ONLY
        const cleanFormula = (step.formula || '0').split('#')[0].trim();
        const parsed = parseFormula(cleanFormula);

        if (parsed.count > 0 && parsed.sides > 0) {
          formulaParts.push(`${parsed.count}d${parsed.sides} # ${step.id}_std`);
        }
      }

      configs[step.id] = config;
    });

    stepConfigsRef.current = configs;

    // 2. Broadcast Start (Visuals)
    const allDice: PendingDie[] = Object.values(configs).flatMap(c => c.dice);

    OBRBroadcast.send({
      type: 'ROLL_START',
      playerId: playerId || 'unknown',
      playerName: playerName || 'Unknown Player',
      playerColor: playerColor || '#888888',
      presetName: preset.name,
      itemName: itemName,
      diceConfig: allDice,
      instant: false,
      steps: preset.steps.map(s => ({
        id: s.id,
        label: s.label,
        type: s.type,
        formula: s.formula,
        damageType: s.damageType,
        isCrit: s.isCrit
      })),
      variables,
    });

    // 3. Execute Dice+ Roll
    const combinedFormula = formulaParts.join(' + ');
    console.log("Dice+ Combined Formula:", combinedFormula);

    try {
      const result = await DicePlus.roll(combinedFormula);
      processRollResults(result);
    } catch (err) {
      console.error("Dice+ Roll Error", err);
      // TODO: Handle error visually?
    }
  };

  const processRollResults = (diceResult: DicePlusResult) => {
    if (!preset) return;

    const calculatedResults: StepResult[] = [];
    const globalDiceValues: Record<string, number> = {};
    const newDieOutcomes: Record<string, 'crit' | 'fail' | 'neutral'> = {};

    // 4. Parse Dice+ Groups into convenient map
    const tagMap: Record<string, number[]> = {};
    if (diceResult.groups) {
      diceResult.groups.forEach((group: any) => {
        const tag = group.description?.trim();
        if (tag) {
          if (!tagMap[tag]) tagMap[tag] = [];
          if (group.dice) {
            group.dice.forEach((d: any) => {
              tagMap[tag].push(d.value);
            });
          }
        }
      });
    }

    // A. First Pass: Collect Values & Determine Global Crit
    let chainHasCrit = false;

    // Temporary helper to store values per step for Second Pass
    const stepValueMap: Record<string, Record<string, number>> = {};

    preset.steps.forEach(step => {
      const config = stepConfigsRef.current[step.id];
      const stepDiceValues: Record<string, number> = {};

      if (step.type === 'daggerheart') {
        const hopeVals = [...(tagMap[`${step.id}_hope`] || [])];
        const fearVals = [...(tagMap[`${step.id}_fear`] || [])];
        const stdVals = [...(tagMap[`${step.id}_std`] || [])];

        config.dice.forEach(d => {
          let val;
          if (d.type === 'hope') val = hopeVals.shift();
          else if (d.type === 'fear') val = fearVals.shift();
          else val = stdVals.shift();

          if (val !== undefined) stepDiceValues[d.id] = val;
        });

        // DH Crit Logic: Check doubles specifically on Hope/Fear pairs?
        // User: "for 2d12 it rolls same value on both".
        // With >2 dice, we likely check if ANY hope matches ANY fear? Or specific pairs?
        // Or maybe just the HIGHEST hope vs HIGHEST fear?
        // Let's iterate all mapped hope/fear values.

        // ACTUALLY, strict Daggerheart is just 2 dice.
        // For "3d12", if the "normal" matches, does it count?
        // Let's stick to: if we find *any* pair of equal values on d12s in this step, it's a crit?
        // Or strictly Hope == Fear?
        // User said: "if roll on which crit is turned on IS CRIT ... for 2d12 it rolls same value on both".
        // Implicitly, check values.
        const values = Object.values(stepDiceValues);
        // Check for duplicates
        if (step.isCrit !== false && values.length >= 2) {
          const unique = new Set(values);
          if (unique.size < values.length) {
            // Found duplicates!
            chainHasCrit = true;
          }
        }

      } else {
        // Standard
        const vals = [...(tagMap[`${step.id}_std`] || [])];
        config.dice.forEach(d => {
          const val = vals.shift();
          if (val !== undefined) stepDiceValues[d.id] = val;

          // Crit Check
          // Only if step.isCrit is NOT explicitly off (undefined usually means "check natural")
          // Actually `step.isCrit` usually tracks "forced crit".
          // We need to check natural 20s (or max side).
          if (val === d.sides && val === 20) { // Natural 20 is always crit trigger if d20
            chainHasCrit = true;
          }
        });
      }

      stepValueMap[step.id] = stepDiceValues;
      Object.assign(globalDiceValues, stepDiceValues);
    });

    // B. Second Pass: Calculate Results
    preset.steps.forEach(step => {
      const shouldRun = checkCondition(step, calculatedResults, variables);
      if (!shouldRun) {
        calculatedResults.push(createSkippedResult(step));
        return;
      }

      const config = stepConfigsRef.current[step.id];
      const stepDiceValues = stepValueMap[step.id];

      const statMod = getStatModifierValue(characterStats, step.statModifier);
      const totalModifier = config.baseModifier + statMod;

      let displayFormula = step.formula;
      if (statMod !== 0 && step.statModifier) {
        const label = getStatLabel(characterStats, step.statModifier);
        displayFormula = `${step.formula} ${statMod >= 0 ? '+' : ''}${statMod} (${label})`;
      }

      // Calculate Total using Global Logic
      let total = 0;
      const rolls = config.dice.map(d => stepDiceValues[d.id] || 0);
      const sumRolls = rolls.reduce((a, b) => a + b, 0);

      if (step.type === 'daggerheart') {
        // DH Total is usually Hope + Fear + Mod?
        // Or just sum of all?
        // Standard DH is Hope+Fear.
        // If we have extra dice, we probably sum them all?
        total = sumRolls + totalModifier;
        // DH doesn't usually use the "Max + Roll" crit rule, but user said "if crit is turned on for roll".
        // If user sets DH step as "sum: on" & "crit: on", we might apply rule.
        // But normally DH Crit is just "Success with Fear/Hope".
        // Given user request seems focused on D&D damage ("2d12+4", "4d6+2"), let's apply the rule to 'standard' types mostly.
        // But if it IS D daggerheart type, we use standard logic unless...
        // Let's assume the "Max + Roll" rule applies primarily to STANDARD damage steps.
        // User example 1) is "2d12+4". That looks like Standard step (weapon damage), not DH check.

      } else {
        // Standard
        if (chainHasCrit && step.addToSum) {
          // CRIT LOGIC: Sum of MAX values + Actual Values + Modifiers
          const maxDiceSum = config.dice.reduce((acc, d) => acc + d.sides, 0);
          total = maxDiceSum + sumRolls + totalModifier;
        } else {
          // Normal
          total = sumRolls + totalModifier;
        }
      }

      // Build Result Object (Manually to handle custom total logic bypassing engine if needed)
      // Actually `resolveStepResult` does specific things.
      // We can use it but overwrite `total` if needed.

      const result = resolveStepResult(step, stepDiceValues, config.dice, totalModifier, displayFormula, chainHasCrit);

      // OVERRIDE TOTAL if we applied the special Crit Rule
      if (step.type === 'standard' && chainHasCrit && step.addToSum) {
        result.total = total;
        result.wasCrit = true;
      }

      // Daggerheart Visual Logic Override
      if (step.type === 'daggerheart') {
        // Recalculate Hope/Fear for visual display
        // We sum all Hope dice and all Fear dice?
        const hopeSum = config.dice.filter(d => d.type === 'hope').reduce((a, d) => a + (stepDiceValues[d.id] || 0), 0);
        const fearSum = config.dice.filter(d => d.type === 'fear').reduce((a, d) => a + (stepDiceValues[d.id] || 0), 0);

        result.dhHope = hopeSum;
        result.dhFear = fearSum;
        if (hopeSum === fearSum && hopeSum > 0) result.dhOutcome = 'crit';
        else if (hopeSum >= fearSum) result.dhOutcome = 'hope';
        else result.dhOutcome = 'fear';
      }

      calculatedResults.push(result);
    });

    setResults(calculatedResults);
    setIsComplete(true);

    // Calculate breakdown
    const includedResults = calculatedResults.filter(r => !r.skipped && r.addToSum);
    const grandTotal = includedResults.reduce((sum, r) => sum + r.total, 0);
    const groups: Record<string, number> = {};
    includedResults.forEach(r => {
      const type = r.damageType === 'none' ? 'typeless' : r.damageType;
      groups[type] = (groups[type] || 0) + r.total;
    });
    const breakdownParts = Object.entries(groups).map(([type, value]) => `${value} ${type}`);
    const breakdown = breakdownParts.length > 0 ? `(${breakdownParts.join(' + ')})` : '';

    // 6. Broadcast VALUES and COMPLETE
    // We can send D_VALUES first if listeners expect it, but ROLL_COMPLETE has results too.
    // OBRBroadcast.send({ ...DICE_VALUES... }) // Optional, visualizers might need it.

    OBRBroadcast.send({
      type: 'ROLL_COMPLETE',
      playerId: playerId || 'unknown',
      results: calculatedResults,
      grandTotal,
      breakdown,
    });
  };

  const { grandTotal, breakdown } = (() => {
    const includedResults = results.filter(r => !r.skipped && r.addToSum);
    const grandTotal = includedResults.reduce((sum, r) => sum + r.total, 0);
    const groups: Record<string, number> = {};
    includedResults.forEach(r => {
      const type = r.damageType === 'none' ? 'typeless' : r.damageType;
      groups[type] = (groups[type] || 0) + r.total;
    });
    const breakdownParts = Object.entries(groups).map(([type, value]) => `${value} ${type}`);
    const breakdown = breakdownParts.length > 0 ? `(${breakdownParts.join(' + ')})` : '';
    return { grandTotal, breakdown };
  })();

  if (!preset) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'transparent' }}
    >
      <AnimatePresence>
        {showResultsUI && results.length > 0 && (
          <RollResults
            results={results}
            isComplete={isComplete}
            onClose={onClose}
            grandTotal={grandTotal}
            breakdown={breakdown}
            itemName={itemName}
            presetName={preset ? preset.name : ''}
          />
        )}
      </AnimatePresence>

      {!hideCanvas && !isComplete && (
        <div className="text-white bg-black/50 px-4 py-2 rounded-full absolute bottom-10 animate-pulse">
          Rolling...
        </div>
      )}

      {!showResultsUI && !isComplete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-[60]">
          <div className="bg-zinc-900 border border-zinc-700 text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <span className="font-bold tracking-wider text-sm">ROLLING ON BOARD</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
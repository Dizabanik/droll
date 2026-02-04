import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DicePreset, CharacterStats } from '../types';
import { PendingDie, getStepDiceConfig, checkCondition, resolveStepResult, createSkippedResult, getStatModifierValue, getStatLabel, parseFormula } from '../utils/engine';
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
}

export const Roller: React.FC<RollerProps> = ({ preset, variables, characterStats, itemName, onClose, hideCanvas }) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

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
      configs[step.id] = config;

      if (step.type === 'daggerheart') {
        // Daggerheart: 1d12{Hope} + 1d12{Fear}
        formulaParts.push(`1d12{Hope} # ${step.id}_hope`);
        formulaParts.push(`1d12{Fear} # ${step.id}_fear`);
        // We do NOT send the modifier to Dice+ to avoid "label + mod" syntax issues.
        // The modifier is handled locally in processRollResults anyway.
      } else {
        // Standard: Extract DICE ONLY from formula to avoid syntax error with labels
        // e.g. "1d20+2" -> "1d20 # id" (We strip the +2 for the Dice+ visual request)
        const cleanFormula = (step.formula || '0').split('#')[0].trim();
        const parsed = parseFormula(cleanFormula);

        if (parsed.count > 0 && parsed.sides > 0) {
          formulaParts.push(`${parsed.count}d${parsed.sides} # ${step.id}_std`);
        }
        // If count is 0 (constant), we send nothing to Dice+.
      }
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

    // Map for visual Dice outcomes
    const newDieOutcomes: Record<string, 'crit' | 'fail' | 'neutral'> = {};
    let chainHasCrit = false;

    // 4. Parse Dice+ Groups into convenient map
    // Map: tag -> array of dice values
    const tagMap: Record<string, number[]> = {};

    if (diceResult.groups) {
      diceResult.groups.forEach((group: any) => {
        // Group description is our tag (e.g. "s1_std" or "s1_hope")
        const tag = group.description?.trim();
        if (tag) {
          if (!tagMap[tag]) tagMap[tag] = [];
          if (group.dice) {
            group.dice.forEach((d: any) => {
              // Use kept dice mainly? Or all dice?
              // Engine expects all dice rolled.
              // Dice+ keeps "dropped" dice in array with kept:false
              // We take ALL values because our engine might want to see dropped ones?
              // Actually resolveStepResult takes rolls[] and sums them.
              // If logic was kh1, we want the kept one.
              // But our engine is simple.
              // If `formula` was complex (2d20kh1), Dice+ returned `baseModifier: 0`.
              // `cleanFormula` sent to Dice+ is `2d20kh1`. Dice+ returns correct logic.
              // Dice+ group has `total`.
              // So we should use `group.total` logic whenever possible.

              tagMap[tag].push(d.value);
            });
          }
        }
      });
    }

    // 5. Iterate Steps Logic (Sequential Dependency)
    preset.steps.forEach(step => {
      // A. Check Condition
      const shouldRun = checkCondition(step, calculatedResults, variables);

      if (!shouldRun) {
        calculatedResults.push(createSkippedResult(step));
        return;
      }

      // B. Retrieve Config & Values
      const config = stepConfigsRef.current[step.id];
      const stepDiceValues: Record<string, number> = {};

      // Extract Values from Tag Map
      if (step.type === 'daggerheart') {
        const hopeVals = tagMap[`${step.id}_hope`] || []; // Should be 1
        const fearVals = tagMap[`${step.id}_fear`] || []; // Should be 1

        // Map to our PendingDie IDs
        const hopeDie = config.dice.find(d => d.type === 'hope');
        const fearDie = config.dice.find(d => d.type === 'fear');

        if (hopeDie && hopeVals[0] !== undefined) stepDiceValues[hopeDie.id] = hopeVals[0];
        if (fearDie && fearVals[0] !== undefined) stepDiceValues[fearDie.id] = fearVals[0];

      } else {
        const vals = tagMap[`${step.id}_std`] || [];
        // Map to dice in order
        config.dice.forEach((d, i) => {
          if (vals[i] !== undefined) stepDiceValues[d.id] = vals[i];
        });
      }

      // Update Global map
      Object.assign(globalDiceValues, stepDiceValues);

      // C. Calculate Modifiers
      const statMod = getStatModifierValue(characterStats, step.statModifier);
      const totalModifier = config.baseModifier + statMod;

      // Display String
      let displayFormula = step.formula;
      if (statMod !== 0 && step.statModifier) {
        const label = getStatLabel(characterStats, step.statModifier);
        displayFormula = `${step.formula} ${statMod >= 0 ? '+' : ''}${statMod} (${label})`;
      }

      // D. Resolve Result
      // For Standard, if formula was complex, our 'sum' logic in resolveStepResult fails.
      // Maybe we should pass the `group.total` from Dice+ if available?
      // Hard to find specific group by tag again without loop.
      // Simplification: We assume Simple Formulas for now as per Engine limitation.

      // Check for Crit Propagation
      let effectiveCrit = chainHasCrit || !!step.isCrit;

      // Daggerheart Crit Check
      if (step.type === 'daggerheart') {
        const h = Object.values(stepDiceValues)[0]; // simplistic, rely on resolveStepResult mainly
        const f = Object.values(stepDiceValues)[1];
        if (h === f) {
          chainHasCrit = true;
          effectiveCrit = true;
        }
      } else {
        // Standard Crit Check (Nat 20)
        config.dice.forEach(d => {
          if (stepDiceValues[d.id] === 20 && d.sides === 20) {
            chainHasCrit = true;
            effectiveCrit = true;
          }
        });
      }

      const result = resolveStepResult(step, stepDiceValues, config.dice, totalModifier, displayFormula, effectiveCrit);
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
        {results.length > 0 && (
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
    </motion.div>
  );
};
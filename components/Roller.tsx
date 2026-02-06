import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DicePreset, CharacterStats } from '../types';
import { PendingDie, getStepDiceConfig, checkCondition, resolveStepResult, createSkippedResult, getStatModifierValue, getStatLabel, parseFormula, generateId } from '../utils/engine';
import { RollResults } from './ui/RollResults';
import { OBRBroadcast, useOBR, OBRStorage } from '../obr';
import OBR from "@owlbear-rodeo/sdk";
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
        const cleanFormula = (step.formula || '0').split('#')[0].trim();

        // CHANGED: Use matchAll with global regex to find ALL dice terms (e.g. 2d12 AND 2d6)
        const diceRegex = /(\d*)d(\d+)/g;
        const matches = [...cleanFormula.matchAll(diceRegex)];

        const dhDice: PendingDie[] = [];

        if (matches.length > 0) {
          matches.forEach((match, index) => {
            const count = match[1] ? parseInt(match[1]) : 1;
            const sides = parseInt(match[2]);

            // Logic: The FIRST dice group found (index 0) gets the Hope/Fear split.
            if (index === 0) {
              const hopeCount = Math.floor(count / 2);
              const fearCount = Math.floor(count / 2);
              const stdCount = count % 2;

              if (hopeCount > 0) formulaParts.push(`${hopeCount}d${sides}{Hope} # ${step.id}_hope`);
              if (fearCount > 0) formulaParts.push(`${fearCount}d${sides}{Fear} # ${step.id}_fear`);
              if (stdCount > 0) formulaParts.push(`${stdCount}d${sides} # ${step.id}_std`);

              for (let i = 0; i < hopeCount; i++) dhDice.push({ id: generateId(), sides, type: 'hope' });
              for (let i = 0; i < fearCount; i++) dhDice.push({ id: generateId(), sides, type: 'fear' });
              for (let i = 0; i < stdCount; i++) dhDice.push({ id: generateId(), sides, type: 'standard' });
            }
            // Logic: All SUBSEQUENT dice groups are added as standard dice.
            else {
              formulaParts.push(`${count}d${sides} # ${step.id}_std`);
              for (let i = 0; i < count; i++) dhDice.push({ id: generateId(), sides, type: 'standard' });
            }
          });
        } else {
          // Fallback default if parsing fails completely
          const sides = 12;
          formulaParts.push(`1d${sides}{Hope} # ${step.id}_hope`);
          formulaParts.push(`1d${sides}{Fear} # ${step.id}_fear`);
          dhDice.push({ id: generateId(), sides, type: 'hope' });
          dhDice.push({ id: generateId(), sides, type: 'fear' });
        }

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
    console.log("[Roller] DicePlus groups:", diceResult.groups);
    if (diceResult.groups) {
      diceResult.groups.forEach((group: any) => {
        const tag = group.description?.trim();
        console.log("[Roller] Group:", { tag, dice: group.dice });
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
    console.log("[Roller] TagMap:", tagMap);

    // A. First Pass: Collect Values & Determine Global Crit
    let chainHasCrit = false;

    // Temporary helper to store values per step for Second Pass
    const stepValueMap: Record<string, Record<string, number>> = {};

    preset.steps.forEach(step => {
      const config = stepConfigsRef.current[step.id];
      const stepDiceValues: Record<string, number> = {};

      // Daggerheart Logic
      if (step.type === 'daggerheart') {
        const hopeVals = [...(tagMap[`${step.id}_hope`] || [])];
        const fearVals = [...(tagMap[`${step.id}_fear`] || [])];
        const stdVals = [...(tagMap[`${step.id}_std`] || [])];

        // Store values
        config.dice.forEach(d => {
          let val;
          if (d.type === 'hope') val = hopeVals.shift();
          else if (d.type === 'fear') val = fearVals.shift();
          else val = stdVals.shift();
          if (val !== undefined) stepDiceValues[d.id] = val;
        });

        // Crit Logic: Only if enabled for this step
        if (step.isCrit) {
          // Find the specific Hope and Fear dice for this step
          const hopeDie = config.dice.find(d => d.type === 'hope');
          const fearDie = config.dice.find(d => d.type === 'fear');

          if (hopeDie && fearDie) {
            const hVal = stepDiceValues[hopeDie.id];
            const fVal = stepDiceValues[fearDie.id];
            // DH Rule: Crit if Hope == Fear (duality dice match)
            if (hVal !== undefined && fVal !== undefined && hVal === fVal) {
              chainHasCrit = true;
            }
          }
        }

      } else {
        // Standard Logic
        const vals = [...(tagMap[`${step.id}_std`] || [])];
        config.dice.forEach(d => {
          const val = vals.shift();
          if (val !== undefined) stepDiceValues[d.id] = val;

          // Crit Logic: Only if enabled for this step
          if (step.isCrit) {
            // Standard Rule: Crit if rolled max value (e.g. 20 on d20)
            if (val === d.sides) {
              chainHasCrit = true;
            }
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
        if (hopeSum === fearSum && hopeSum > 0 && step.isCrit) result.dhOutcome = 'crit';
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

    // --- AUTO-UPDATE LOGIC START ---
    calculatedResults.forEach(async res => {
      if (res.type === 'daggerheart' && res.dhOutcome) {
        // Handle Global Fear
        if (res.dhOutcome === 'fear' && OBR.isAvailable) {
          try {
            const METADATA_KEY = 'com.fateweaver.fear';
            const metadata = await OBR.room.getMetadata();
            const currentFear = (metadata[METADATA_KEY] as number) || 0;

            if (currentFear < 12) { // Max fear
              const newFear = currentFear + 1;
              OBR.room.setMetadata({ [METADATA_KEY]: newFear });

              // Broadcast effect
              OBRBroadcast.send({
                type: 'FEAR_UPDATE',
                fear: newFear,
                showEffect: true,
              });
            }
          } catch (e) {
            console.error("Auto-Fear update failed:", e);
          }
        }

        // Handle Local Stats (Hope/Stress)
        try {
          const currentVitals = await OBRStorage.getDaggerheartVitals();
          if (currentVitals) {
            let newVitals = { ...currentVitals };
            let changed = false;

            // Hope roll -> +1 Hope
            if (res.dhOutcome === 'hope') {
              if (newVitals.hope < newVitals.hopeMax) {
                newVitals.hope += 1;
                changed = true;
              }
            }

            // Critical -> +1 Hope, -1 Stress
            if (res.dhOutcome === 'crit') {
              if (newVitals.hope < newVitals.hopeMax) {
                newVitals.hope += 1;
                changed = true;
              }
              if (newVitals.stress > 0) {
                newVitals.stress -= 1;
                changed = true;
              }
            }

            if (changed) {
              await OBRStorage.setDaggerheartVitals(newVitals);
              // Trigger a specialized broadcast if needed, or rely on existing sync
            }
          }
        } catch (e) {
          console.error("Auto-Vitals update failed:", e);
        }
      }
    });
    // --- AUTO-UPDATE LOGIC END ---

    OBRBroadcast.send({
      type: 'ROLL_COMPLETE',
      playerId: playerId || 'unknown',
      playerName: playerName || 'Unknown Player',
      presetName: preset.name,
      itemName: itemName,
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
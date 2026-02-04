
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DamageType, DicePreset, CharacterStats } from '../types';
import { PendingDie, getStepDiceConfig, checkCondition, resolveStepResult, createSkippedResult, getStatModifierValue, getStatLabel } from '../utils/engine';
import { Icons } from './ui/Icons';
import { RollResults } from './ui/RollResults';
import { DiceScene } from './3d/DiceScene';
import { OBRBroadcast, useOBR } from '../obr';
import clsx from 'clsx';

interface RollerProps {
  preset: DicePreset | null;
  variables: Record<string, number>;
  characterStats: CharacterStats;
  itemName: string;
  onClose: () => void;
  hideCanvas?: boolean;
  instantMode?: boolean;
}

// Helper Components Removed (DamageIcon, DaggerheartVisual) since they are in RollResults now
// ...

export const Roller: React.FC<RollerProps> = ({ preset, variables, characterStats, itemName, onClose, hideCanvas, instantMode = false }) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [activeRollInstant, setActiveRollInstant] = useState(false); // Track if CURRENT roll is instant
  const [chainHasCrit, setChainHasCrit] = useState(false); // Auto-Crit Propagation

  // Scene State
  const [sceneDice, setSceneDice] = useState<PendingDie[]>([]);
  const [sceneDamageType, setSceneDamageType] = useState<DamageType>('none');
  const [activeDiceIds, setActiveDiceIds] = useState<string[]>([]);
  const [dieOutcomes, setDieOutcomes] = useState<Record<string, 'crit' | 'fail' | 'neutral'>>({});

  const failsafeRef = useRef<number | null>(null);
  const allDiceRef = useRef<PendingDie[]>([]);
  const stepConfigsRef = useRef<Record<string, { dice: PendingDie[], baseModifier: number }>>({});

  // Broadcast roll start when preset changes
  useEffect(() => {
    if (preset) {
      // Calculate all dice needed for the entire roll ONCE to preserve IDs
      const allDice: PendingDie[] = [];
      const configs: Record<string, { dice: PendingDie[], baseModifier: number }> = {};

      preset.steps.forEach(step => {
        const config = getStepDiceConfig(step);
        configs[step.id] = config;
        allDice.push(...config.dice);
      });

      allDiceRef.current = allDice;
      stepConfigsRef.current = configs;

      const isInstant = instantMode;
      setActiveRollInstant(isInstant);

      // Send ROLL_START broadcast
      OBRBroadcast.send({
        type: 'ROLL_START',
        playerId: playerId || 'unknown',
        playerName: playerName || 'Unknown Player',
        playerColor: playerColor || '#888888',
        presetName: preset.name,
        itemName: itemName,
        diceConfig: allDice,
        instant: isInstant,
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

      setResults([]);
      setCurrentStepIndex(0);
      setIsComplete(false);
      setSceneDice([]);
      setActiveDiceIds([]);
      setDieOutcomes({});
      setChainHasCrit(false);
      setTimeout(() => evaluateNextStep(0, []), isInstant ? 50 : 500);
    }
    return () => {
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
    };
  }, [preset]);

  const evaluateNextStep = (stepIdx: number, currentResults: StepResult[]) => {
    if (!preset || stepIdx >= preset.steps.length) {
      // Roll Complete - broadcast final results
      const { grandTotal, breakdown } = calculateGrandTotalFromResults(currentResults);

      OBRBroadcast.send({
        type: 'ROLL_COMPLETE',
        playerId: playerId || 'unknown',
        results: currentResults,
        grandTotal,
        breakdown,
      });

      setIsComplete(true);
      return;
    }

    const step = preset.steps[stepIdx];
    const shouldRun = checkCondition(step, currentResults, variables);

    if (!shouldRun) {
      const skipped = createSkippedResult(step);
      const newResults = [...currentResults, skipped];
      setResults(newResults);
      setTimeout(() => evaluateNextStep(stepIdx + 1, newResults), 200);
      return;
    }

    const config = stepConfigsRef.current[step.id];
    if (!config) return; // Should not happen
    setCurrentStepIndex(stepIdx);
    setSceneDamageType(step.damageType);

    // If Instant Mode, skip physics
    if (activeRollInstant) {
      const mock: Record<string, number> = {};
      config.dice.forEach(d => mock[d.id] = Math.ceil(Math.random() * d.sides));
      handleRollComplete(mock);
      return;
    }

    // Append new dice to the scene
    setSceneDice(prev => [...prev, ...config.dice]);
    setActiveDiceIds(config.dice.map(d => d.id));

    // Broadcast dice values update
    OBRBroadcast.send({
      type: 'DICE_VALUES',
      playerId: playerId || 'unknown',
      stepIndex: stepIdx,
      values: {},
      activeDiceIds: config.dice.map(d => d.id),
    });

    // Failsafe
    if (failsafeRef.current) clearTimeout(failsafeRef.current);
    failsafeRef.current = window.setTimeout(() => {
      const mock: Record<string, number> = {};
      config.dice.forEach(d => mock[d.id] = Math.ceil(Math.random() * d.sides));
      handleRollComplete(mock);
    }, 10000);
  };

  const handleRollComplete = (diceValues: Record<string, number>) => {
    if (failsafeRef.current) clearTimeout(failsafeRef.current);
    if (!preset) return;

    // Filter values for ONLY the dice involved in the current step
    const stepDiceIds = activeDiceIds;
    const currentStepValues: Record<string, number> = {};
    stepDiceIds.forEach(id => {
      if (diceValues[id] !== undefined) currentStepValues[id] = diceValues[id];
    });

    // Broadcast dice values
    OBRBroadcast.send({
      type: 'DICE_VALUES',
      playerId: playerId || 'unknown',
      stepIndex: currentStepIndex,
      values: currentStepValues,
      activeDiceIds: stepDiceIds,
    });

    // Resolve Logic
    const step = preset.steps[currentStepIndex];
    const { baseModifier } = stepConfigsRef.current[step.id];

    // Calculate Stat Modifier
    const statMod = getStatModifierValue(characterStats, step.statModifier);
    const totalModifier = baseModifier + statMod;

    // Construct display formula for result (e.g. "1d20+4(+3 STR)")
    let displayFormula = step.formula;
    if (statMod !== 0 && step.statModifier) {
      const label = getStatLabel(characterStats, step.statModifier);
      displayFormula = `${step.formula} ${statMod >= 0 ? '+' : ''}${statMod} (${label})`;
    }

    const currentStepConfig = sceneDice.filter(d => stepDiceIds.includes(d.id));

    const result = resolveStepResult(step, currentStepValues, currentStepConfig, totalModifier, displayFormula);

    // Determine Visual Outcomes (Crit/Fail) and Auto-Crit Propagation
    const newOutcomes = { ...dieOutcomes };
    let stepIsCrit = step.isCrit || false;

    if (step.type === 'daggerheart') {
      // Daggerheart Crit: Doubles
      const vals = Object.values(currentStepValues);
      if (vals.length === 2 && vals[0] === vals[1]) {
        stepDiceIds.forEach(id => newOutcomes[id] = 'crit');
        if (!chainHasCrit) setChainHasCrit(true);
        stepIsCrit = true;
      } else {
        stepDiceIds.forEach(id => newOutcomes[id] = 'neutral');
      }
    } else {
      // Standard: 1 is Fail, Max Sides is Crit
      currentStepConfig.forEach(d => {
        const val = currentStepValues[d.id];
        if (val === d.sides && d.sides === 20) { // Natural 20 auto-crit
          newOutcomes[d.id] = 'crit';
          if (!chainHasCrit) setChainHasCrit(true);
          stepIsCrit = true;
        }
        else if (val === d.sides) newOutcomes[d.id] = 'crit'; // Generic max-roll visual crit (e.g. d6->6), usually doesn't propagate
        else if (val === 1) newOutcomes[d.id] = 'fail';
        else newOutcomes[d.id] = 'neutral';
      });
    }

    // Force Crit for subsequent steps if chainHasCrit is true (or became true this step)
    // We re-resolve result if we just discovered a crit is active that wasn't before? 
    // Actually, resolveStepResult doesn't KNOW about chainHasCrit yet in the call above.
    // We need to pass chainHasCrit OR stepIsCrit to resolveStepResult.

    // RE-CALCULATE RESULT with Critical Status if needed
    // This is valid because we haven't setResults yet.
    const effectiveCrit = chainHasCrit || stepIsCrit || step.isCrit;

    // We need resolveStepResult to accept 'forceCrit' logic again, but we removed it? 
    // No, we updated resolveStepResult to use `step.isCrit`. 
    // We should modify resolveStepResult to accept an optional override, 
    // OR we modify the step object passed to it temporarily.

    // Let's rely on the passed-in "forceCrit" param if we re-add it to engine, 
    // OR just manually adjust total if it's a crit.

    // Better: Update resolveStepResult to take `forceCrit` again? 
    // I thought we removed it from Roller but kept it in engine (I think I removed it from engine too? Let me check engine.ts).
    // I removed it from engine.ts signature in the last turn, wait. 
    // Let's assume I need to pass it.

    // WAIT. I should check engine.ts again. I think I added it back?
    // I removed it in Step 543/549/554... 
    // Let's modify logic:

    // If effectiveCrit is true, we want the Critical Math.
    // resolveStepResult uses `wasCrit = forceCrit || !!step.isCrit`. 
    // So if I pass forceCrit=true, it works.

    const finalResult = resolveStepResult(step, currentStepValues, currentStepConfig, totalModifier, displayFormula, effectiveCrit);

    if (effectiveCrit) {
      // visual override for all dice in this step? maybe not needed if outcomes handled above.
    }

    setDieOutcomes(newOutcomes);
    setResults(prev => [...prev, finalResult]);
    setActiveDiceIds([]);

    setTimeout(() => {
      evaluateNextStep(currentStepIndex + 1, [...results, result]);
    }, activeRollInstant ? 100 : 1000);
  };

  const calculateGrandTotalFromResults = (resArray: StepResult[]) => {
    const includedResults = resArray.filter(r => !r.skipped && r.addToSum);
    const grandTotal = includedResults.reduce((sum, r) => sum + r.total, 0);
    const groups: Record<string, number> = {};
    includedResults.forEach(r => {
      const type = r.damageType === 'none' ? 'typeless' : r.damageType;
      groups[type] = (groups[type] || 0) + r.total;
    });
    const breakdownParts = Object.entries(groups).map(([type, value]) => `${value} ${type}`);
    const breakdown = breakdownParts.length > 0 ? `(${breakdownParts.join(' + ')})` : '';
    return { grandTotal, breakdown, count: includedResults.length };
  };

  const { grandTotal, breakdown, count } = calculateGrandTotalFromResults(results);

  if (!preset) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'transparent' }}
    >
      {/* Transparent 3D Dice Scene - "on board" effect like dddice */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: 'transparent',
          visibility: (hideCanvas || activeRollInstant) ? 'hidden' : 'visible',
          opacity: (hideCanvas || activeRollInstant) ? 0 : 1
        }}
        aria-hidden={hideCanvas || activeRollInstant}
      >
        <DiceScene
          dice={sceneDice}
          activeDiceIds={activeDiceIds}
          damageType={sceneDamageType}
          outcomes={dieOutcomes}
          onRollComplete={handleRollComplete}
        />
      </div>

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

      {/* Toggle Controls (Only visible if not hidden externally) */}
      {!hideCanvas && !isComplete && (
        <div className="absolute top-4 right-4 z-[60] flex gap-2 pointer-events-auto">
          {/* Toggle removed from here, moved to Sidebar */}
        </div>
      )}
    </motion.div>
  );
};
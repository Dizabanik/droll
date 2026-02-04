
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
}

// Helper Components Removed (DamageIcon, DaggerheartVisual) since they are in RollResults now
// ...

export const Roller: React.FC<RollerProps> = ({ preset, variables, characterStats, itemName, onClose, hideCanvas }) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [instantMode, setInstantMode] = useState(false);
  const [activeRollInstant, setActiveRollInstant] = useState(false); // Track if CURRENT roll is instant

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

    // Determine Visual Outcomes (Crit/Fail)
    const newOutcomes = { ...dieOutcomes };

    if (step.isCrit) {
      stepDiceIds.forEach(id => newOutcomes[id] = 'crit');
    } else if (step.type === 'daggerheart') {
      // Daggerheart Crit: Doubles
      const vals = Object.values(currentStepValues);
      if (vals.length === 2 && vals[0] === vals[1]) {
        stepDiceIds.forEach(id => newOutcomes[id] = 'crit');
      } else {
        stepDiceIds.forEach(id => newOutcomes[id] = 'neutral');
      }
    } else {
      // Standard: 1 is Fail, Max Sides is Crit
      currentStepConfig.forEach(d => {
        const val = currentStepValues[d.id];
        if (val === d.sides) newOutcomes[d.id] = 'crit';
        else if (val === 1) newOutcomes[d.id] = 'fail';
        else newOutcomes[d.id] = 'neutral';
      });
    }

    setDieOutcomes(newOutcomes);
    setResults(prev => [...prev, result]);
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
          <button
            onClick={() => setInstantMode(!instantMode)}
            className={clsx(
              "p-2 rounded-full border transition-all shadow-lg",
              instantMode
                ? "bg-accent text-white border-accent"
                : "bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-white"
            )}
            title="Instant Roll (Skip 3D)"
          >
            <Icons.Dice size={20} />
            {instantMode && <span className="absolute -bottom-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></span>}
          </button>
        </div>
      )}
    </motion.div>
  );
};
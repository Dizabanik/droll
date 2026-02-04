
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DamageType, DicePreset, CharacterStats } from '../types';
import { PendingDie, getStepDiceConfig, checkCondition, resolveStepResult, createSkippedResult, getStatModifierValue, getStatLabel } from '../utils/engine';
import { Icons } from './ui/Icons';
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

const DamageIcon = ({ type }: { type: DamageType }) => {
  const size = 16;
  switch (type) {
    case 'fire': return <Icons.Fire size={size} className="text-orange-500" />;
    case 'cold': return <Icons.Cold size={size} className="text-cyan-400" />;
    case 'lightning': return <Icons.Lightning size={size} className="text-yellow-400" />;
    case 'necrotic': return <Icons.Necrotic size={size} className="text-purple-500" />;
    case 'radiant': return <Icons.Radiant size={size} className="text-yellow-200" />;
    case 'acid': return <Icons.Acid size={size} className="text-green-500" />;
    case 'poison': return <Icons.Poison size={size} className="text-emerald-600" />;
    case 'psychic': return <Icons.Psychic size={size} className="text-pink-500" />;
    case 'force': return <Icons.Force size={size} className="text-indigo-400" />;
    case 'magic': return <Icons.Magic size={size} className="text-fuchsia-400" />;
    case 'physical': return <Icons.Attack size={size} className="text-stone-400" />;
    case 'slashing':
    case 'piercing':
    case 'bludgeoning': return <Icons.Attack size={size} className="text-zinc-400" />;
    default: return <Icons.Dice size={size} className="text-zinc-500" />;
  }
};

const DaggerheartVisual = ({ result }: { result: StepResult }) => {
  if (result.type !== 'daggerheart') return null;

  const isHope = result.dhOutcome === 'hope';
  const isFear = result.dhOutcome === 'fear';
  const isCrit = result.dhOutcome === 'crit';

  return (
    <div className="flex flex-col gap-2 mt-2 bg-zinc-950/50 p-3 rounded-lg border border-white/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-1">Hope</span>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono text-xl">
            {result.dhHope}
          </div>
        </div>
        <div className="text-xs text-zinc-600 font-mono">VS</div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-1">Fear</span>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-mono text-xl">
            {result.dhFear}
          </div>
        </div>
      </div>
      <div className={clsx(
        "text-center text-xs font-bold uppercase tracking-wider py-1 rounded",
        isCrit && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        isHope && !isCrit && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        isFear && !isCrit && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      )}>
        {isCrit ? "Critical Success!" : (isHope ? "With Hope" : "With Fear")}
      </div>
    </div>
  );
};

export const Roller: React.FC<RollerProps> = ({ preset, variables, characterStats, itemName, onClose, hideCanvas }) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Scene State
  const [sceneDice, setSceneDice] = useState<PendingDie[]>([]);
  const [sceneDamageType, setSceneDamageType] = useState<DamageType>('none');
  const [activeDiceIds, setActiveDiceIds] = useState<string[]>([]);
  const [dieOutcomes, setDieOutcomes] = useState<Record<string, 'crit' | 'fail' | 'neutral'>>({});

  const failsafeRef = useRef<number | null>(null);
  const allDiceRef = useRef<PendingDie[]>([]);

  // Broadcast roll start when preset changes
  useEffect(() => {
    if (preset) {
      // Calculate all dice needed for the entire roll
      const allDice: PendingDie[] = [];
      preset.steps.forEach(step => {
        const config = getStepDiceConfig(step);
        allDice.push(...config.dice);
      });
      allDiceRef.current = allDice;

      // Send ROLL_START broadcast
      OBRBroadcast.send({
        type: 'ROLL_START',
        playerId: playerId || 'unknown',
        playerName: playerName || 'Unknown Player',
        playerColor: playerColor || '#888888',
        presetName: preset.name,
        itemName: itemName,
        diceConfig: allDice,
        steps: preset.steps.map(s => ({
          id: s.id,
          label: s.label,
          type: s.type,
          formula: s.formula,
          damageType: s.damageType,
        })),
        variables,
      });

      setResults([]);
      setCurrentStepIndex(0);
      setIsComplete(false);
      setSceneDice([]);
      setActiveDiceIds([]);
      setDieOutcomes({});
      setTimeout(() => evaluateNextStep(0, []), 500);
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

    const config = getStepDiceConfig(step);
    setCurrentStepIndex(stepIdx);
    setSceneDamageType(step.damageType);

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
    const { baseModifier } = getStepDiceConfig(step);

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

    if (step.type === 'daggerheart') {
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
    }, 1000);
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
        className={clsx("absolute inset-0 z-0 pointer-events-none")}
        style={{ visibility: hideCanvas ? 'hidden' : 'visible' }}
        aria-hidden={hideCanvas}
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
          <motion.div
            initial={{ scale: 0.9, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="z-10 w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-lg m-4 max-h-[70vh] flex flex-col absolute bottom-10 right-10 pointer-events-auto"
          >
            <div className="bg-zinc-950/90 p-3 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Icons.Magic className="text-accent" size={16} />
                {preset.name}
              </h2>
              {/* Only show close button when complete */}
              {isComplete && (
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                  <Icons.Close size={16} />
                </button>
              )}
            </div>

            <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {results.map((res) => (
                <motion.div
                  key={res.uniqueId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={clsx(
                    "relative p-3 rounded-lg border transition-all",
                    res.skipped
                      ? "bg-zinc-900/50 border-zinc-800 opacity-50 grayscale"
                      : "bg-zinc-800/80 border-zinc-700"
                  )}
                >
                  {res.skipped && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 z-10 rounded-lg">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest border border-zinc-700 px-2 py-0.5 rounded">Skipped</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-zinc-200 font-medium text-xs flex items-center gap-2">
                        {res.label}
                        <span className="text-[10px] text-zinc-500 font-normal font-mono">({res.formula})</span>
                        {res.addToSum && <span className="text-[10px] text-accent font-bold px-1.5 py-0.5 bg-accent/10 rounded">SUM</span>}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <DamageIcon type={res.damageType} />
                        <span className="text-[10px] text-zinc-400 capitalize">{res.damageType === 'none' ? 'Result' : res.damageType}</span>
                      </div>
                    </div>
                    <div className="text-xl font-mono font-bold text-white">
                      {res.total}
                    </div>
                  </div>

                  {res.type === 'daggerheart' && !res.skipped && (
                    <DaggerheartVisual result={res} />
                  )}
                </motion.div>
              ))}

              {!isComplete && (
                <div className="flex justify-center p-2">
                  <span className="text-xs text-zinc-500 animate-pulse">Rolling...</span>
                </div>
              )}
            </div>

            {isComplete && count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-zinc-950/90 border-t border-zinc-800"
              >
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Total Damage</span>
                  <div className="text-4xl font-black text-white my-1 font-mono tracking-tighter shadow-glow">
                    {grandTotal}
                  </div>
                  {breakdown && (
                    <span className="text-xs text-zinc-400">{breakdown}</span>
                  )}
                </div>
              </motion.div>
            )}

            {isComplete && (
              <div className="p-3 bg-zinc-950/80 border-t border-zinc-800 text-center">
                <button
                  onClick={onClose}
                  className="w-full bg-white text-black text-sm font-semibold py-2 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
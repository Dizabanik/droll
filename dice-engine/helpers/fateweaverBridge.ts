import { DicePreset, RollStep, StepResult, CharacterStats, DamageType, DiceCustomization, DEFAULT_DICE_CUSTOMIZATION } from '../../types';
import { generateId, parseFormulaAdvanced, parseFormula, checkCondition, getStatModifierValue, getStatLabel, resolveStepResult, createSkippedResult } from '../../utils/engine';
import { DiceRoll } from '../types/DiceRoll';
import { Die } from '../types/Die';
import { DiceType } from '../types/DiceType';
import { DiceStyle } from '../types/DiceStyle';
import { useDiceRollStore } from '../dice/store';
import { OBRBroadcast } from '../../obr/broadcast';
import { OBRStorage } from '../../obr/storage';
import OBR from '@owlbear-rodeo/sdk';

export interface DieStepAssociation {
  stepId: string;
  dieId: string;
  sides: number;
  sign: number; // +1 or -1
  type: 'standard' | 'hope' | 'fear';
}

export interface PreparedRoll {
  diceRoll: DiceRoll;
  associations: DieStepAssociation[];
  stepConfigs: Record<string, { baseModifier: number; statModifier: number; displayFormula: string }>;
}

export const mapSidesToDiceType = (sides: number): DiceType => {
  switch (sides) {
    case 4: return 'D4';
    case 6: return 'D6';
    case 8: return 'D8';
    case 10: return 'D10';
    case 12: return 'D12';
    case 20: return 'D20';
    case 100: return 'D100';
    default:
      if (sides <= 4) return 'D4';
      if (sides <= 6) return 'D6';
      if (sides <= 8) return 'D8';
      if (sides <= 10) return 'D10';
      if (sides <= 12) return 'D12';
      return 'D20';
  }
};

export const prepare3DRoll = (
  preset: DicePreset,
  characterStats: CharacterStats,
  customization?: Partial<DiceCustomization> | DiceStyle
): PreparedRoll => {
  const config: DiceCustomization = typeof customization === 'string'
    ? { ...DEFAULT_DICE_CUSTOMIZATION, standardStyle: customization }
    : { ...DEFAULT_DICE_CUSTOMIZATION, ...(customization || {}) };

  const standardStyle = config.standardStyle || 'GEMSTONE';
  const hopeStyle = config.hopeStyle || 'SUNRISE';
  const fearStyle = config.fearStyle || 'GALAXY';
  const negativeStyle = config.negativeStyle || 'IRON';

  const diceList: Die[] = [];
  const associations: DieStepAssociation[] = [];
  const stepConfigs: Record<string, { baseModifier: number; statModifier: number; displayFormula: string }> = {};

  for (const step of preset.steps) {
    const statMod = getStatModifierValue(characterStats, step.statModifier);
    let baseMod = 0;
    let displayFormula = step.formula;

    if (statMod !== 0 && step.statModifier) {
      const label = getStatLabel(characterStats, step.statModifier);
      displayFormula = `${step.formula} ${statMod >= 0 ? '+' : ''}${statMod} (${label})`;
    }

    if (step.type === 'daggerheart') {
      const { diceGroups, modifier } = parseFormulaAdvanced(step.formula || '');
      baseMod = modifier;

      // 1. Hope D12 (Customized Hope Style)
      const hopeId = generateId();
      diceList.push({ id: hopeId, type: 'D12', style: hopeStyle });
      associations.push({ stepId: step.id, dieId: hopeId, sides: 12, sign: 1, type: 'hope' });

      // 2. Fear D12 (Customized Fear Style)
      const fearId = generateId();
      diceList.push({ id: fearId, type: 'D12', style: fearStyle });
      associations.push({ stepId: step.id, dieId: fearId, sides: 12, sign: 1, type: 'fear' });

      // 3. Any extra dice in the formula (skipping the first 2 d12s if specified)
      let d12Count = 0;
      for (const group of diceGroups) {
        if (group.sides === 12 && d12Count < 2 && group.sign === 1) {
          d12Count++;
          continue;
        }
        for (let i = 0; i < group.count; i++) {
          const extraId = generateId();
          const diceType = mapSidesToDiceType(group.sides);
          const style = group.sign === -1 ? negativeStyle : standardStyle;
          diceList.push({ id: extraId, type: diceType, style });
          associations.push({ stepId: step.id, dieId: extraId, sides: group.sides, sign: group.sign, type: 'standard' });
        }
      }
    } else {
      // Standard roll (e.g. 1d4+1d12 or 2d6-1d4+3 or 1d20)
      const { diceGroups, modifier } = parseFormulaAdvanced(step.formula || '');
      baseMod = modifier;

      for (const group of diceGroups) {
        for (let i = 0; i < group.count; i++) {
          const dieId = generateId();
          const diceType = mapSidesToDiceType(group.sides);
          const style = group.sign === -1 ? negativeStyle : standardStyle;
          diceList.push({ id: dieId, type: diceType, style });
          associations.push({ stepId: step.id, dieId, sides: group.sides, sign: group.sign, type: 'standard' });
        }
      }
    }

    stepConfigs[step.id] = {
      baseModifier: baseMod,
      statModifier: statMod,
      displayFormula
    };
  }

  const diceRoll: DiceRoll = {
    dice: diceList,
    combination: 'SUM'
  };

  return {
    diceRoll,
    associations,
    stepConfigs
  };
};

export interface RollExecutionResult {
  results: StepResult[];
  grandTotal: number;
  breakdown: string;
}

export const execute3DFateRoll = async (
  preset: DicePreset,
  variables: Record<string, number>,
  characterStats: CharacterStats,
  itemName: string,
  playerInfo: { id: string; name: string; color: string },
  customization?: Partial<DiceCustomization> | DiceStyle
): Promise<RollExecutionResult> => {
  const prepared = prepare3DRoll(preset, characterStats, customization);

  // 1. Start 3D Rapier Physics Roll in store first to generate physics throws
  useDiceRollStore.getState().startRoll(prepared.diceRoll);
  const initialThrows = useDiceRollStore.getState().rollThrows;

  // 2. Broadcast roll start with exact physical throws for identical simulation
  OBRBroadcast.send({
    type: 'ROLL_START',
    playerId: playerInfo.id,
    playerName: playerInfo.name,
    playerColor: playerInfo.color,
    presetName: preset.name,
    itemName,
    diceRoll: prepared.diceRoll,
    rollThrows: initialThrows,
    diceConfig: prepared.associations.map(a => ({
      id: a.dieId,
      sides: a.sides,
      type: a.type
    })),
    steps: preset.steps.map(s => ({
      id: s.id,
      label: s.label,
      type: s.type,
      formula: s.formula,
      damageType: s.damageType,
      isCrit: s.isCrit
    })),
    variables
  });

  // Wait for all dice to settle
  const rollValues = await new Promise<Record<string, number>>((resolve) => {
    const unsubscribe = useDiceRollStore.subscribe((state) => {
      if (!state.roll) return;
      const values = state.rollValues;
      const ids = prepared.associations.map(a => a.dieId);
      const allFinished = ids.length > 0 && ids.every(id => values[id] !== null && values[id] !== undefined);

      if (allFinished) {
        unsubscribe();
        const resolvedMap: Record<string, number> = {};
        ids.forEach(id => {
          resolvedMap[id] = values[id]!;
        });
        resolve(resolvedMap);
      }
    });

    // Safety timeout in case a die gets stuck
    setTimeout(() => {
      const state = useDiceRollStore.getState();
      const values = state.rollValues;
      const ids = prepared.associations.map(a => a.dieId);
      const fallbackMap: Record<string, number> = {};
      ids.forEach(id => {
        fallbackMap[id] = values[id] !== null && values[id] !== undefined
          ? values[id]!
          : Math.ceil(Math.random() * (prepared.associations.find(a => a.dieId === id)?.sides || 20));
      });
      resolve(fallbackMap);
    }, 6000);
  });

  // Evaluate step results
  const calculatedResults: StepResult[] = [];

  // 1. Determine if any step with isCrit triggered a crit
  let chainHasCrit = false;
  preset.steps.forEach(step => {
    const stepAssocs = prepared.associations.filter(a => a.stepId === step.id);
    if (step.isCrit) {
      if (step.type === 'daggerheart') {
        const hopeDie = stepAssocs.find(a => a.type === 'hope');
        const fearDie = stepAssocs.find(a => a.type === 'fear');
        if (hopeDie && fearDie) {
          const hVal = rollValues[hopeDie.dieId];
          const fVal = rollValues[fearDie.dieId];
          if (hVal !== undefined && fVal !== undefined && hVal === fVal) {
            chainHasCrit = true;
          }
        }
      } else {
        stepAssocs.forEach(a => {
          if (rollValues[a.dieId] === a.sides) {
            chainHasCrit = true;
          }
        });
      }
    }
  });

  // 2. Resolve each step in order
  preset.steps.forEach(step => {
    const shouldRun = checkCondition(step, calculatedResults, variables);
    if (!shouldRun) {
      calculatedResults.push(createSkippedResult(step));
      return;
    }

    const stepAssocs = prepared.associations.filter(a => a.stepId === step.id);
    const config = prepared.stepConfigs[step.id];
    const totalModifier = config.baseModifier + config.statModifier;

    const stepPendingDice = stepAssocs.map(a => ({
      id: a.dieId,
      sides: a.sides,
      sign: a.sign,
      type: a.type
    }));

    const result = resolveStepResult(
      step,
      rollValues,
      stepPendingDice,
      totalModifier,
      config.displayFormula,
      chainHasCrit
    );

    // Apply special Critical Hit math to standard damage step if chain crit occurred
    if (step.type === 'standard' && chainHasCrit && step.addToSum) {
      const maxDice = stepAssocs.reduce((acc, a) => acc + a.sides, 0);
      const actualSum = stepAssocs.reduce((acc, a) => acc + (rollValues[a.dieId] || 0), 0);
      result.total = maxDice + actualSum + totalModifier;
      result.wasCrit = true;
    }

    calculatedResults.push(result);
  });

  // Calculate grand totals and damage breakdowns
  const includedResults = calculatedResults.filter(r => !r.skipped && r.addToSum);
  const grandTotal = includedResults.reduce((sum, r) => sum + r.total, 0);
  const groups: Record<string, number> = {};
  includedResults.forEach(r => {
    const type = r.damageType === 'none' ? 'typeless' : r.damageType;
    groups[type] = (groups[type] || 0) + r.total;
  });
  const breakdownParts = Object.entries(groups).map(([type, value]) => `${value} ${type}`);
  const breakdown = breakdownParts.length > 0 ? `(${breakdownParts.join(' + ')})` : '';

  // Auto-apply Daggerheart side effects
  for (const res of calculatedResults) {
    if (res.type === 'daggerheart' && res.dhOutcome) {
      // Fear outcome
      if (res.dhOutcome === 'fear' && OBR.isAvailable) {
        try {
          const METADATA_KEY = 'com.fateweaver.fear';
          const metadata = await OBR.room.getMetadata();
          const currentFear = (metadata[METADATA_KEY] as number) || 0;
          if (currentFear < 12) {
            const newFear = currentFear + 1;
            OBR.room.setMetadata({ [METADATA_KEY]: newFear });
            OBRBroadcast.send({
              type: 'FEAR_UPDATE',
              fear: newFear,
              showEffect: true
            });
          }
        } catch (e) {
          console.error('Auto-Fear update failed:', e);
        }
      }

      // Hope & Crit outcome
      try {
        const currentVitals = await OBRStorage.getDaggerheartVitals();
        if (currentVitals) {
          let newVitals = { ...currentVitals };
          let changed = false;

          if (res.dhOutcome === 'hope' || res.dhOutcome === 'crit') {
            if (newVitals.hope < newVitals.hopeMax) {
              newVitals.hope += 1;
              changed = true;
            }
          }
          if (res.dhOutcome === 'crit') {
            if (newVitals.stress > 0) {
              newVitals.stress -= 1;
              changed = true;
            }
          }
          if (changed) {
            await OBRStorage.setDaggerheartVitals(newVitals);
          }
        }
      } catch (e) {
        console.error('Auto-Vitals update failed:', e);
      }
    }
  }

  // Extract final settled transforms
  const finalTransforms = useDiceRollStore.getState().rollTransforms;
  const validTransforms: Record<string, any> = {};
  if (finalTransforms) {
    for (const [id, val] of Object.entries(finalTransforms)) {
      if (val) validTransforms[id] = val;
    }
  }

  // Broadcast completion to all players
  OBRBroadcast.send({
    type: 'ROLL_COMPLETE',
    playerId: playerInfo.id,
    playerName: playerInfo.name,
    presetName: preset.name,
    itemName,
    results: calculatedResults,
    grandTotal,
    breakdown,
    rollValues,
    rollTransforms: validTransforms
  });

  return {
    results: calculatedResults,
    grandTotal,
    breakdown
  };
};

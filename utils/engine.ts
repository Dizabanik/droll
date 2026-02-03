
import { RollStep, StepResult, RollCondition, DamageType, CharacterStats } from '../types';

export const generateId = () => Math.random().toString(36).substr(2, 9);

// Simple dice parser: 2d6+4 or 1d20-1 or just d6
export const parseFormula = (formula: string) => {
  // Matches: Optional number, "d", number, optional modifier
  const match = formula.toLowerCase().match(/^(\d*)d(\d+)([\+\-]\d+)?$/);
  
  if (!match) {
    // Try constant number
    const constant = parseInt(formula);
    if (!isNaN(constant)) return { count: 0, sides: 0, modifier: constant };
    // Default fallback if garbage input
    return { count: 1, sides: 20, modifier: 0 }; 
  }

  return {
    count: match[1] ? parseInt(match[1]) : 1, // Default to 1 if empty string
    sides: parseInt(match[2]),
    modifier: match[3] ? parseInt(match[3]) : 0,
  };
};

export const getStatModifierValue = (stats: CharacterStats, key: string | undefined): number => {
  if (!key) return 0;
  
  const [type, id] = key.split(':');
  
  if (type === 'dnd_attr') {
    const val = stats.dndAttributes[id] || 10;
    return Math.floor((val - 10) / 2);
  }
  
  if (type === 'dnd_skill') {
    return stats.dndSkills[id] || 0;
  }
  
  if (type === 'dh') {
    return stats.daggerheartStats[id] || 0;
  }
  
  if (type === 'custom') {
    return stats.customStats.find(s => s.id === id)?.value || 0;
  }
  
  return 0;
};

export const getStatLabel = (stats: CharacterStats, key: string | undefined): string => {
  if (!key) return '';
  const [type, id] = key.split(':');
  
  if (type === 'dnd_attr') return id.toUpperCase();
  if (type === 'dnd_skill') return id.charAt(0).toUpperCase() + id.slice(1);
  if (type === 'dh') return id.charAt(0).toUpperCase() + id.slice(1);
  if (type === 'custom') return stats.customStats.find(s => s.id === id)?.name || 'Custom';
  
  return 'Unknown';
};

export interface PendingDie {
  id: string;
  sides: number;
  type: 'standard' | 'hope' | 'fear';
}

/**
 * Returns the configuration of dice that need to be rolled for a given step.
 */
export const getStepDiceConfig = (step: RollStep): { dice: PendingDie[], baseModifier: number } => {
  if (step.type === 'daggerheart') {
    const { modifier } = parseFormula(step.formula || "0d0+0");
    return {
      baseModifier: modifier,
      dice: [
        { id: generateId(), sides: 12, type: 'hope' },
        { id: generateId(), sides: 12, type: 'fear' }
      ]
    };
  } else {
    const { count, sides, modifier } = parseFormula(step.formula);
    const dice: PendingDie[] = [];
    for (let i = 0; i < count; i++) {
      dice.push({ id: generateId(), sides, type: 'standard' });
    }
    return { baseModifier: modifier, dice };
  }
};

/**
 * Checks if a step should run based on previous results.
 */
export const checkCondition = (
  step: RollStep,
  previousResults: StepResult[],
  variableValues: Record<string, number>
): boolean => {
  if (!step.condition) return true;

  const prev = previousResults.find(r => r.stepId === step.condition!.dependsOnStepId);
  
  if (!prev || prev.skipped) return false;

  const { operator, compareTarget, value = 0, variableId } = step.condition;
  const prevVal = prev.total;
  
  let threshold = 0;
  if (!['is_hope', 'is_fear', 'is_crit'].includes(operator)) {
    if (compareTarget === 'variable' && variableId) {
      threshold = variableValues[variableId] ?? 0;
    } else {
      threshold = value;
    }
  }

  switch (operator) {
    case '>': return prevVal > threshold;
    case '<': return prevVal < threshold;
    case '>=': return prevVal >= threshold;
    case '<=': return prevVal <= threshold;
    case '==': return prevVal === threshold;
    case 'is_hope': return prev.dhOutcome === 'hope' || prev.dhOutcome === 'crit';
    case 'is_fear': return prev.dhOutcome === 'fear';
    case 'is_crit': return prev.dhOutcome === 'crit';
    default: return false;
  }
};

/**
 * Constructs the final result object after physics has determined the rolls.
 */
export const resolveStepResult = (
  step: RollStep,
  diceValues: Record<string, number>, // Map of pendingDie ID -> Rolled Value
  diceConfig: PendingDie[],
  totalModifier: number, // Includes base formula mod + stat mod
  displayFormula: string
): StepResult => {
  const uniqueId = generateId();
  
  if (step.type === 'daggerheart') {
    // Identify hope and fear dice
    const hopeDie = diceConfig.find(d => d.type === 'hope');
    const fearDie = diceConfig.find(d => d.type === 'fear');
    
    const hope = hopeDie ? diceValues[hopeDie.id] : 0;
    const fear = fearDie ? diceValues[fearDie.id] : 0;

    let outcome: 'hope' | 'fear' | 'crit' = 'hope';
    if (hope === fear) outcome = 'crit';
    else if (hope >= fear) outcome = 'hope';
    else outcome = 'fear';

    return {
      stepId: step.id,
      uniqueId,
      label: step.label,
      total: hope + fear + totalModifier,
      rolls: [hope, fear],
      formula: displayFormula,
      type: 'daggerheart',
      damageType: step.damageType,
      skipped: false,
      dhHope: hope,
      dhFear: fear,
      dhOutcome: outcome,
      addToSum: step.addToSum
    };
  } else {
    // Standard
    const rolls = diceConfig.map(d => diceValues[d.id]);
    const sum = rolls.reduce((a, b) => a + b, 0);

    return {
      stepId: step.id,
      uniqueId,
      label: step.label,
      total: sum + totalModifier,
      rolls,
      formula: displayFormula,
      type: 'standard',
      damageType: step.damageType,
      skipped: false,
      addToSum: step.addToSum
    };
  }
};

export const createSkippedResult = (step: RollStep): StepResult => ({
  stepId: step.id,
  uniqueId: generateId(),
  label: step.label,
  total: 0,
  rolls: [],
  formula: step.formula,
  type: step.type,
  damageType: step.damageType,
  skipped: true,
  addToSum: step.addToSum
});
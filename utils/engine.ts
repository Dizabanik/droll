
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

// Advanced parser for complex formulas like "2d12+d6+d4+5"
// Returns all dice groups and total flat modifier
export interface DiceGroup {
  count: number;
  sides: number;
}

export const parseFormulaAdvanced = (formula: string): { diceGroups: DiceGroup[], modifier: number } => {
  const diceGroups: DiceGroup[] = [];
  let modifier = 0;

  // Normalize: remove spaces, ensure starts with + for consistent splitting
  let normalized = formula.replace(/\s/g, '').toLowerCase();
  if (!normalized.startsWith('+') && !normalized.startsWith('-')) {
    normalized = '+' + normalized;
  }

  // Match all parts: +2d6, -d4, +5, etc.
  const parts = normalized.match(/[+\-](\d*d\d+|\d+)/g) || [];

  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1;
    const expr = part.slice(1); // Remove the sign

    if (expr.includes('d')) {
      // Dice expression
      const dMatch = expr.match(/^(\d*)d(\d+)$/);
      if (dMatch) {
        const count = dMatch[1] ? parseInt(dMatch[1]) : 1;
        const sides = parseInt(dMatch[2]);
        // For negative dice, we could skip or treat as 0 - for now just use absolute
        for (let i = 0; i < count; i++) {
          diceGroups.push({ count: 1, sides });
        }
      }
    } else {
      // Flat modifier
      const num = parseInt(expr);
      if (!isNaN(num)) {
        modifier += sign * num;
      }
    }
  }

  return { diceGroups, modifier };
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
  isCrit?: boolean; // If forced crit applies to this die
}

/**
 * Returns the configuration of dice that need to be rolled for a given step.
 * For daggerheart: Always includes 2d12 (hope/fear), plus any extra dice from formula.
 */
export const getStepDiceConfig = (step: RollStep): { dice: PendingDie[], baseModifier: number } => {
  if (step.type === 'daggerheart') {
    // Parse complex formula to get all dice groups and modifier
    const { diceGroups, modifier } = parseFormulaAdvanced(step.formula || "");

    // Always start with Hope and Fear d12s
    const dice: PendingDie[] = [
      { id: generateId(), sides: 12, type: 'hope' },
      { id: generateId(), sides: 12, type: 'fear' }
    ];

    // Add any extra dice from formula (skip the first 2d12 if present, as we already have hope/fear)
    let d12Count = 0;
    for (const group of diceGroups) {
      if (group.sides === 12 && d12Count < 2) {
        // Skip the first two d12s since we already have hope/fear
        d12Count++;
        continue;
      }
      // Add as standard dice
      dice.push({ id: generateId(), sides: group.sides, type: 'standard' });
    }

    return { baseModifier: modifier, dice };
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
 * Checks if a step should run based on condition (step result or variable value).
 */
export const checkCondition = (
  step: RollStep,
  previousResults: StepResult[],
  variableValues: Record<string, number>
): boolean => {
  if (!step.condition) return true;

  const { checkSource = 'step_result', dependsOnStepId, checkVariableId, operator, compareTarget, value = 0, variableId } = step.condition;

  // Determine what value we're checking
  let sourceValue: number;
  let dhOutcome: 'hope' | 'fear' | 'crit' | undefined;

  if (checkSource === 'variable') {
    // Check a variable's value directly
    if (!checkVariableId) return false;
    sourceValue = variableValues[checkVariableId] ?? 0;
    // DH outcomes don't apply to variable checks
    dhOutcome = undefined;
  } else {
    // Check a previous step's result (original behavior)
    const prev = previousResults.find(r => r.stepId === dependsOnStepId);
    if (!prev || prev.skipped) return false;
    sourceValue = prev.total;
    dhOutcome = prev.dhOutcome;
  }

  // Determine threshold
  let threshold = 0;
  if (!['is_hope', 'is_fear', 'is_crit'].includes(operator)) {
    if (compareTarget === 'variable' && variableId) {
      threshold = variableValues[variableId] ?? 0;
    } else {
      threshold = value;
    }
  }

  switch (operator) {
    case '>': return sourceValue > threshold;
    case '<': return sourceValue < threshold;
    case '>=': return sourceValue >= threshold;
    case '<=': return sourceValue <= threshold;
    case '==': return sourceValue === threshold;
    case 'is_hope': return dhOutcome === 'hope' || dhOutcome === 'crit';
    case 'is_fear': return dhOutcome === 'fear';
    case 'is_crit': return dhOutcome === 'crit';
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
  displayFormula: string,
  forceCrit: boolean = false
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
      addToSum: step.addToSum,
      wasCrit: outcome === 'crit'
    };
  } else {
    // Standard
    let currentDice = diceConfig;
    const rolls = currentDice.map(d => diceValues[d.id]);
    const sum = rolls.reduce((a, b) => a + b, 0);

    let total = sum + totalModifier;
    let wasCrit = forceCrit || !!step.isCrit;

    // Critical Hit Math: Max Dice + Rolls + Mod
    if (wasCrit && currentDice.length > 0) {
      const maxDice = currentDice.reduce((acc, d) => acc + d.sides, 0);
      total = maxDice + sum + totalModifier;
    }

    return {
      stepId: step.id,
      uniqueId,
      label: step.label,
      total,
      rolls,
      formula: displayFormula,
      type: 'standard',
      damageType: step.damageType,
      skipped: false,
      addToSum: step.addToSum,
      wasCrit
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
  addToSum: step.addToSum,
  wasCrit: false
});
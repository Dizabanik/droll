
export type DamageType =
  | 'slashing' | 'piercing' | 'bludgeoning'
  | 'fire' | 'cold' | 'lightning' | 'thunder' | 'acid' | 'poison'
  | 'necrotic' | 'radiant' | 'psychic' | 'force' | 'none'
  | 'magic' | 'physical';

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'is_hope' | 'is_fear' | 'is_crit';
export type GameSystem = 'dnd5e' | 'daggerheart';

export interface CustomStat {
  id: string;
  name: string;
  value: number;
}

export interface CharacterStats {
  activeSystem: GameSystem; // Controls which sheet is viewed, but all data persists
  dndAttributes: Record<string, number>; // str, dex, etc.
  dndSkills: Record<string, number>;     // acrobatics, etc.
  daggerheartStats: Record<string, number>; // agility, etc.
  customStats: CustomStat[];
}

export interface RollVariable {
  id: string;
  name: string;
  defaultValue: number;
}

export interface RollCondition {
  checkSource?: 'step_result' | 'variable'; // What to check: step result or a variable's value. Defaults to 'step_result'
  dependsOnStepId?: string; // The step we are checking the result of (when checkSource is 'step_result')
  checkVariableId?: string; // The variable to check (when checkSource is 'variable')
  operator: ConditionOperator;
  compareTarget: 'value' | 'variable';
  value?: number;
  variableId?: string;
}

export interface RollStep {
  id: string;
  label: string;
  type: 'standard' | 'daggerheart';
  formula: string; // e.g., "2d6+4" or empty for DH
  statModifier?: string; // Namespaced key: "dnd_attr:str", "dnd_skill:arcana", "dh:agility", "custom:id"
  damageType: DamageType;
  condition?: RollCondition;
  addToSum?: boolean;
  isCrit?: boolean;
}

export interface DicePreset {
  id: string;
  name: string;
  variables: RollVariable[];
  steps: RollStep[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  presets: DicePreset[];
}

// Result Types
export interface StepResult {
  stepId: string;
  uniqueId: string; // For React keys during animation
  label: string;
  total: number;
  rolls: number[];
  formula: string;
  type: 'standard' | 'daggerheart';
  damageType: DamageType;
  skipped: boolean;
  addToSum?: boolean;
  wasCrit?: boolean;

  // Daggerheart specifics
  dhHope?: number;
  dhFear?: number;
  dhOutcome?: 'hope' | 'fear' | 'crit';
}

export interface RollSession {
  id: string;
  itemName: string;
  presetName: string;
  timestamp: number;
  results: StepResult[];
}
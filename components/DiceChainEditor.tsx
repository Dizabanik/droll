
import React from 'react';
import { DicePreset, RollStep, DamageType, ConditionOperator, RollVariable, CharacterStats } from '../types';
import { generateId } from '../utils/engine';
import { Icons } from './ui/Icons';
import clsx from 'clsx';

interface DiceChainEditorProps {
  preset: DicePreset;
  onUpdate: (preset: DicePreset) => void;
  onDelete: () => void;
  characterStats: CharacterStats;
}

const DAMAGE_TYPES: DamageType[] = [
  'none', 'slashing', 'piercing', 'bludgeoning',
  'physical', 'magic', 'fire', 'cold', 'lightning',
  'necrotic', 'radiant', 'acid', 'poison', 'psychic', 'force'
];

export const DiceChainEditor: React.FC<DiceChainEditorProps> = ({ preset, onUpdate, onDelete, characterStats }) => {

  // -- Variables Management --
  const addVariable = () => {
    const newVar: RollVariable = {
      id: generateId(),
      name: 'DC',
      defaultValue: 15
    };
    onUpdate({ ...preset, variables: [...(preset.variables || []), newVar] });
  };

  const updateVariable = (idx: number, changes: Partial<RollVariable>) => {
    const newVars = [...(preset.variables || [])];
    newVars[idx] = { ...newVars[idx], ...changes };
    onUpdate({ ...preset, variables: newVars });
  };

  const removeVariable = (idx: number) => {
    const newVars = (preset.variables || []).filter((_, i) => i !== idx);
    onUpdate({ ...preset, variables: newVars });
  };

  // -- Steps Management --
  const addStep = () => {
    const newStep: RollStep = {
      id: generateId(),
      label: 'New Step',
      type: 'standard',
      formula: '1d20',
      damageType: 'none',
      addToSum: false,
    };
    onUpdate({ ...preset, steps: [...preset.steps, newStep] });
  };

  const updateStep = (index: number, changes: Partial<RollStep>) => {
    const newSteps = [...preset.steps];
    newSteps[index] = { ...newSteps[index], ...changes };
    onUpdate({ ...preset, steps: newSteps });
  };

  const removeStep = (index: number) => {
    const newSteps = preset.steps.filter((_, i) => i !== index);
    onUpdate({ ...preset, steps: newSteps });
  };

  // -- Data Preparation for Select --
  const dndAttrs = Object.keys(characterStats.dndAttributes);
  const dndSkills = Object.keys(characterStats.dndSkills);
  const dhStats = Object.keys(characterStats.daggerheartStats);
  const customStats = characterStats.customStats;

  return (
    <div className="bg-surface/50 border border-border rounded-xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <input
          value={preset.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ ...preset, name: e.target.value })}
          className="bg-transparent text-lg font-bold text-white focus:outline-none focus:border-b border-accent/50 w-full mr-4"
          placeholder="Preset Name (e.g., Fireball)"
        />
        <button onClick={onDelete} className="text-zinc-500 hover:text-red-500 transition-colors">
          <Icons.Delete size={18} />
        </button>
      </div>

      {/* Variables Section */}
      <div className="mb-6 bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Variables</label>
          <button onClick={addVariable} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
            <Icons.Add size={12} /> Add Variable
          </button>
        </div>
        <div className="space-y-2">
          {(preset.variables || []).map((v, idx) => (
            <div key={v.id} className="flex gap-2 items-center">
              <input
                value={v.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariable(idx, { name: e.target.value })}
                className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 w-24 border-none focus:ring-1 focus:ring-accent"
                placeholder="Name"
              />
              <span className="text-zinc-600 text-xs">=</span>
              <input
                type="number"
                value={v.defaultValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariable(idx, { defaultValue: parseInt(e.target.value) || 0 })}
                className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 w-16 border-none focus:ring-1 focus:ring-accent"
                placeholder="Val"
              />
              <button onClick={() => removeVariable(idx)} className="text-zinc-600 hover:text-red-400 ml-auto">
                <Icons.Close size={12} />
              </button>
            </div>
          ))}
          {(preset.variables || []).length === 0 && (
            <p className="text-[10px] text-zinc-600 italic">No variables defined (e.g. DC, AC).</p>
          )}
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {preset.steps.map((step, idx) => (
          <div key={step.id} className="relative group">
            {idx > 0 && <div className="absolute -top-3 left-6 w-0.5 h-3 bg-border"></div>}

            <div className="bg-background border border-border rounded-lg p-3 hover:border-accent/30 transition-colors">
              <div className="flex flex-col gap-3">
                {/* Header Line */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-mono">
                    {idx + 1}
                  </div>
                  <input
                    value={step.label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { label: e.target.value })}
                    className="bg-transparent text-sm font-medium text-white focus:outline-none w-32"
                    placeholder="Label"
                  />
                  <div className="flex-1" />

                  <label className="flex items-center gap-1 cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={step.addToSum || false}
                      onChange={(e) => updateStep(idx, { addToSum: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-accent focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Sum</span>
                  </label>

                  <label className="flex items-center gap-1 cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={step.isCrit || false}
                      onChange={(e) => updateStep(idx, { isCrit: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Crit</span>
                  </label>

                  <select
                    value={step.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { type: e.target.value as any })}
                    className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 border-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="standard">Standard</option>
                    <option value="daggerheart">Daggerheart</option>
                  </select>

                  <button onClick={() => removeStep(idx)} className="text-zinc-600 hover:text-red-400">
                    <Icons.Close size={14} />
                  </button>
                </div>

                {/* Configuration Line */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Formula</label>
                    <input
                      value={step.formula}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { formula: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-primary placeholder-zinc-700 focus:border-accent focus:outline-none"
                      placeholder={step.type === 'daggerheart' ? 'Mod (e.g. +2)' : 'e.g. 2d6+4'}
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Add Stat</label>
                    <select
                      value={step.statModifier || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { statModifier: e.target.value || undefined })}
                      className={clsx(
                        "w-full bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none",
                        step.statModifier ? "text-accent" : "text-zinc-500"
                      )}
                    >
                      <option value="">(None)</option>

                      <optgroup label="DnD Attributes (Modifier)">
                        {dndAttrs.map(k => (
                          <option key={`dnd_attr:${k}`} value={`dnd_attr:${k}`}>{k.toUpperCase()}</option>
                        ))}
                      </optgroup>

                      <optgroup label="DnD Skills (Value)">
                        {dndSkills.map(k => (
                          <option key={`dnd_skill:${k}`} value={`dnd_skill:${k}`}>{k}</option>
                        ))}
                      </optgroup>

                      <optgroup label="Daggerheart (Value)">
                        {dhStats.map(k => (
                          <option key={`dh:${k}`} value={`dh:${k}`}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                        ))}
                      </optgroup>

                      {customStats.length > 0 && (
                        <optgroup label="Custom">
                          {customStats.map(s => (
                            <option key={`custom:${s.id}`} value={`custom:${s.id}`}>{s.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Damage</label>
                    <select
                      value={step.damageType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { damageType: e.target.value as DamageType })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-300 focus:border-accent focus:outline-none"
                    >
                      {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Conditionals - Only if not first step */}
                  {idx > 0 && (
                    <div className="col-span-12 mt-2 bg-zinc-900/30 rounded p-2 border border-zinc-800/50">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                        <Icons.ArrowRight size={10} /> Condition (Optional)
                      </label>
                      <div className="flex flex-col gap-2">
                        {/* Source Type Select */}
                        <div className="flex gap-2">
                          <select
                            value={step.condition ? (step.condition.checkSource || 'step_result') : ''}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                              if (!e.target.value) {
                                updateStep(idx, { condition: undefined });
                              } else {
                                const source = e.target.value as 'step_result' | 'variable';
                                if (source === 'step_result') {
                                  updateStep(idx, {
                                    condition: {
                                      checkSource: 'step_result',
                                      dependsOnStepId: preset.steps[0]?.id || '',
                                      operator: '>',
                                      compareTarget: 'value',
                                      value: 10
                                    }
                                  });
                                } else {
                                  updateStep(idx, {
                                    condition: {
                                      checkSource: 'variable',
                                      checkVariableId: preset.variables?.[0]?.id || '',
                                      operator: '>',
                                      compareTarget: 'value',
                                      value: 0
                                    }
                                  });
                                }
                              }
                            }}
                            className="bg-zinc-800 text-xs text-zinc-400 rounded px-2 py-1 border-none"
                          >
                            <option value="">Always Run</option>
                            <option value="step_result">If Step Result...</option>
                            <option value="variable">If Variable...</option>
                          </select>

                          {/* Source Selection (Step or Variable) */}
                          {step.condition && step.condition.checkSource === 'step_result' && (
                            <select
                              value={step.condition.dependsOnStepId || ''}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, dependsOnStepId: e.target.value } })}
                              className="bg-zinc-800 text-xs text-zinc-400 rounded px-2 py-1 border-none flex-1"
                            >
                              {preset.steps.slice(0, idx).map((s, sIdx) => (
                                <option key={s.id} value={s.id}>Step {sIdx + 1}: {s.label}</option>
                              ))}
                            </select>
                          )}

                          {step.condition && step.condition.checkSource === 'variable' && (
                            <select
                              value={step.condition.checkVariableId || ''}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, checkVariableId: e.target.value } })}
                              className={clsx(
                                "bg-zinc-800 text-xs rounded px-2 py-1 border-none flex-1",
                                !step.condition.checkVariableId && "text-red-400",
                                step.condition.checkVariableId && "text-zinc-400"
                              )}
                            >
                              <option value="">Select Var...</option>
                              {(preset.variables || []).map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Operator and Value */}
                        {step.condition && (
                          <div className="flex gap-2">
                            <select
                              value={step.condition.operator}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, operator: e.target.value as ConditionOperator } })}
                              className="bg-zinc-800 text-xs text-zinc-400 rounded px-1 py-1 border-none w-20"
                            >
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value=">=">≥</option>
                              <option value="<=">≤</option>
                              <option value="==">=</option>
                              {step.condition.checkSource !== 'variable' && (
                                <>
                                  <option value="is_hope">Is Hope</option>
                                  <option value="is_fear">Is Fear</option>
                                  <option value="is_crit">Is Crit</option>
                                </>
                              )}
                            </select>

                            {!['is_hope', 'is_fear', 'is_crit'].includes(step.condition.operator) && (
                              <>
                                <select
                                  value={step.condition.compareTarget}
                                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, compareTarget: e.target.value as any } })}
                                  className="bg-zinc-800 text-xs text-zinc-400 rounded px-1 py-1 border-none w-20"
                                >
                                  <option value="value">Value</option>
                                  <option value="variable">Var</option>
                                </select>

                                {step.condition.compareTarget === 'value' ? (
                                  <input
                                    value={step.condition.value}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { condition: { ...step.condition!, value: parseInt(e.target.value) || 0 } })}
                                    className="bg-zinc-800 text-xs text-zinc-400 rounded px-2 py-1 border-none flex-1 text-center"
                                    type="number"
                                    placeholder="10"
                                  />
                                ) : (
                                  <select
                                    value={step.condition.variableId || ''}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, variableId: e.target.value } })}
                                    className={clsx(
                                      "bg-zinc-800 text-xs rounded px-2 py-1 border-none flex-1",
                                      !step.condition.variableId && "text-red-400",
                                      step.condition.variableId && "text-zinc-400"
                                    )}
                                  >
                                    <option value="">Select Var...</option>
                                    {(preset.variables || []).map(v => (
                                      <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                  </select>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addStep}
          className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 text-sm hover:border-zinc-500 hover:text-zinc-400 transition-all flex items-center justify-center gap-2"
        >
          <Icons.Add size={16} /> Add Step
        </button>
      </div>
    </div>
  );
};
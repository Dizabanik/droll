
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
    <div className="bg-surface/50 border border-neutral-800/80 rounded-2xl p-5 mb-4 shadow-fey-subtle select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800/60">
        <input
          value={preset.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ ...preset, name: e.target.value })}
          className="bg-transparent text-base font-bold text-white tracking-tight focus:outline-none focus:border-b border-neutral-700 w-full mr-3"
          placeholder="Preset Name (e.g. Eldritch Blast)"
        />
        <button onClick={onDelete} className="text-muted hover:text-rose-400 p-1.5 rounded-full hover:bg-white/5 transition-colors">
          <Icons.Delete size={16} />
        </button>
      </div>

      {/* Variables Section */}
      <div className="mb-5 bg-elevated/60 rounded-xl p-3.5 border border-neutral-800/70">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">Dynamic Variables</label>
          <button onClick={addVariable} className="text-[11px] font-semibold text-white hover:text-mist flex items-center gap-1 bg-surface px-2.5 py-1 rounded-full border border-neutral-800 hover:border-neutral-700 transition-all active:scale-95 shadow-fey-subtle">
            <Icons.Add size={11} /> Add Variable
          </button>
        </div>
        <div className="space-y-2">
          {(preset.variables || []).map((v, idx) => (
            <div key={v.id} className="flex gap-2 items-center">
              <input
                value={v.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariable(idx, { name: e.target.value })}
                className="bg-surface text-xs font-mono font-semibold text-white rounded-lg px-2.5 py-1 w-28 border border-neutral-800 focus:border-white/50 focus:outline-none"
                placeholder="Name"
              />
              <span className="text-muted text-xs font-mono">=</span>
              <input
                type="number"
                value={v.defaultValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariable(idx, { defaultValue: parseInt(e.target.value) || 0 })}
                className="w-16 bg-surface text-xs font-mono font-bold text-white rounded-lg px-2 py-1 text-center border border-neutral-800 focus:border-white/50 focus:outline-none"
                placeholder="Val"
              />
              <button onClick={() => removeVariable(idx)} className="text-muted hover:text-rose-400 p-1 rounded-full hover:bg-white/5 transition-colors ml-auto">
                <Icons.Close size={12} />
              </button>
            </div>
          ))}
          {(preset.variables || []).length === 0 && (
            <p className="text-[10px] text-muted font-mono italic">No prompt variables defined (e.g. Target AC, Save DC).</p>
          )}
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {preset.steps.map((step, idx) => (
          <div key={step.id} className="relative group">
            {idx > 0 && <div className="absolute -top-3 left-6 w-px h-3 bg-neutral-800"></div>}

            <div className="bg-elevated/40 border border-neutral-800 rounded-xl p-3.5 hover:border-neutral-700/80 transition-all shadow-fey-subtle">
              <div className="flex flex-col gap-3">
                {/* Header Line */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-surface border border-neutral-700 flex items-center justify-center text-[10px] font-mono font-bold text-muted">
                    {idx + 1}
                  </div>
                  <input
                    value={step.label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { label: e.target.value })}
                    className="bg-transparent text-xs font-semibold text-white focus:outline-none w-32 border-b border-transparent focus:border-neutral-700"
                    placeholder="Step Label"
                  />
                  <div className="flex-1" />

                  <label className="flex items-center gap-1.5 cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={step.addToSum || false}
                      onChange={(e) => updateStep(idx, { addToSum: e.target.checked })}
                      className="rounded border-neutral-700 bg-surface text-white focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Sum</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={step.isCrit || false}
                      onChange={(e) => updateStep(idx, { isCrit: e.target.checked })}
                      className="rounded border-neutral-700 bg-surface text-ember focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Crit</span>
                  </label>

                  <select
                    value={step.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { type: e.target.value as any })}
                    className="bg-surface text-xs text-white rounded-lg px-2.5 py-1 border border-neutral-800 focus:outline-none focus:border-neutral-600 font-mono"
                  >
                    <option value="standard">Standard</option>
                    <option value="daggerheart">Daggerheart</option>
                  </select>

                  <button onClick={() => removeStep(idx)} className="text-muted hover:text-rose-400 p-1 rounded-full hover:bg-white/5 transition-colors">
                    <Icons.Close size={13} />
                  </button>
                </div>

                {/* Configuration Line */}
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-4">
                    <label className="text-[9px] text-muted uppercase tracking-widest font-mono block mb-1">Formula</label>
                    <input
                      value={step.formula}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { formula: e.target.value })}
                      className="w-full bg-surface border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-white placeholder-neutral-700 focus:border-white/50 focus:outline-none"
                      placeholder={step.type === 'daggerheart' ? 'Mod (e.g. +2)' : 'e.g. 2d6+4'}
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="text-[9px] text-muted uppercase tracking-widest font-mono block mb-1">Add Stat</label>
                    <select
                      value={step.statModifier || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { statModifier: e.target.value || undefined })}
                      className={clsx(
                        "w-full bg-surface border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:border-white/50 focus:outline-none font-mono",
                        step.statModifier ? "text-white font-semibold" : "text-muted"
                      )}
                    >
                      <option value="">(None)</option>

                      {characterStats.activeSystem === 'dnd5e' && (
                        <>
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
                        </>
                      )}

                      {characterStats.activeSystem === 'daggerheart' && (
                        <optgroup label="Daggerheart (Value)">
                          {dhStats.map(k => (
                            <option key={`dh:${k}`} value={`dh:${k}`}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                          ))}
                        </optgroup>
                      )}

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
                    <label className="text-[9px] text-muted uppercase tracking-widest font-mono block mb-1">Damage</label>
                    <select
                      value={step.damageType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { damageType: e.target.value as DamageType })}
                      className="w-full bg-surface border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-white/50 focus:outline-none font-mono"
                    >
                      {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Conditionals */}
                  {idx > 0 && (
                    <div className="col-span-12 mt-1 bg-surface/50 rounded-xl p-2.5 border border-neutral-800/80">
                      <label className="text-[9px] text-muted uppercase tracking-widest font-mono flex items-center gap-1.5 mb-1.5">
                        <Icons.ArrowRight size={10} /> Condition (Branching)
                      </label>
                      <div className="flex flex-col gap-2">
                        <select
                          value={step.condition?.dependsOnStepId || ''}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            if (!e.target.value) updateStep(idx, { condition: undefined });
                            else updateStep(idx, {
                              condition: {
                                dependsOnStepId: e.target.value,
                                operator: '>=',
                                compareTarget: 'value',
                                value: 10
                              }
                            });
                          }}
                          className="bg-elevated text-xs font-mono text-white rounded-lg px-2.5 py-1 border border-neutral-800 w-full focus:outline-none"
                        >
                          <option value="">Always Run</option>
                          {preset.steps.slice(0, idx).map((s, sIdx) => (
                            <option key={s.id} value={s.id}>Result of Step {sIdx + 1}: {s.label}</option>
                          ))}
                        </select>

                        {step.condition && (
                          <div className="flex gap-2">
                            <select
                              value={step.condition.operator}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, operator: e.target.value as ConditionOperator } })}
                              className="bg-elevated text-xs font-mono text-white rounded-lg px-2 py-1 border border-neutral-800 w-24 focus:outline-none"
                            >
                              <option value=">=">≥</option>
                              <option value="<=">≤</option>
                              <option value="==">=</option>
                              <option value="is_hope">Is Hope</option>
                              <option value="is_fear">Is Fear</option>
                              <option value="is_crit">Is Crit</option>
                            </select>

                            {!['is_hope', 'is_fear', 'is_crit'].includes(step.condition.operator) && (
                              <>
                                <select
                                  value={step.condition.compareTarget}
                                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, compareTarget: e.target.value as any } })}
                                  className="bg-elevated text-xs font-mono text-white rounded-lg px-2 py-1 border border-neutral-800 w-20 focus:outline-none"
                                >
                                  <option value="value">Value</option>
                                  <option value="variable">Var</option>
                                </select>

                                {step.condition.compareTarget === 'value' ? (
                                  <input
                                    value={step.condition.value}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStep(idx, { condition: { ...step.condition!, value: parseInt(e.target.value) || 0 } })}
                                    className="bg-elevated text-xs font-mono font-bold text-white rounded-lg px-2 py-1 border border-neutral-800 flex-1 text-center focus:outline-none"
                                    type="number"
                                    placeholder="10"
                                  />
                                ) : (
                                  <select
                                    value={step.condition.variableId || ''}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStep(idx, { condition: { ...step.condition!, variableId: e.target.value } })}
                                    className={clsx(
                                      "bg-elevated text-xs font-mono rounded-lg px-2 py-1 border border-neutral-800 flex-1 focus:outline-none",
                                      !step.condition.variableId && "text-rose-400",
                                      step.condition.variableId && "text-white"
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
          className="w-full py-2.5 border border-dashed border-neutral-800 rounded-xl text-muted text-xs font-semibold hover:border-neutral-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Icons.Add size={14} /> Add Step
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { CharacterStats, GameSystem } from '../types';
import { Icons } from './ui/Icons';
import { generateId } from '../utils/engine';
import clsx from 'clsx';

interface CharacterSheetProps {
  stats: CharacterStats;
  onChange: (stats: CharacterStats) => void;
}

const DND_ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const DH_STATS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const DND_SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
  'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
  'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'
];

const STAT_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  agility: 'Agility', strength: 'Strength', finesse: 'Finesse', instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge'
};

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ stats, onChange }) => {

  const setSystem = (system: GameSystem) => {
    onChange({ ...stats, activeSystem: system });
  };

  const updateDndAttr = (key: string, val: number) => {
    onChange({
      ...stats,
      dndAttributes: { ...stats.dndAttributes, [key]: val }
    });
  };

  const updateDndSkill = (key: string, val: number) => {
    onChange({
      ...stats,
      dndSkills: { ...stats.dndSkills, [key]: val }
    });
  };

  const updateDhStat = (key: string, val: number) => {
    onChange({
      ...stats,
      daggerheartStats: { ...stats.daggerheartStats, [key]: val }
    });
  };

  const addCustomStat = () => {
    const newStat = { id: generateId(), name: 'New Stat', value: 0 };
    onChange({
      ...stats,
      customStats: [...stats.customStats, newStat]
    });
  };

  const updateCustomStat = (id: string, changes: Partial<{ name: string; value: number }>) => {
    onChange({
      ...stats,
      customStats: stats.customStats.map(s => s.id === id ? { ...s, ...changes } : s)
    });
  };

  const removeCustomStat = (id: string) => {
    onChange({
      ...stats,
      customStats: stats.customStats.filter(s => s.id !== id)
    });
  };

  const getMod = (val: number) => Math.floor((val - 10) / 2);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Header Bar */}
      <div className="px-8 py-5 border-b border-neutral-800/80 bg-surface/20">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Icons.User size={20} className="text-white" />
              Character Sheet
            </h2>
            <p className="text-xs text-muted mt-0.5">Attributes, skill proficiencies, and trait modifiers.</p>
          </div>

          <div className="flex items-center bg-elevated border border-neutral-800 rounded-full p-0.5 shadow-inner">
            <button
              onClick={() => setSystem('dnd5e')}
              className={clsx(
                "px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all",
                stats.activeSystem === 'dnd5e'
                  ? "bg-white text-black font-bold shadow-fey-subtle"
                  : "text-muted hover:text-white"
              )}
            >
              DnD 5e
            </button>
            <button
              onClick={() => setSystem('daggerheart')}
              className={clsx(
                "px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all",
                stats.activeSystem === 'daggerheart'
                  ? "bg-signal text-white font-bold shadow-fey-signal"
                  : "text-muted hover:text-white"
              )}
            >
              Daggerheart
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* D&D 5e Attributes & Skills */}
          {stats.activeSystem === 'dnd5e' && (
            <>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                    Ability Scores & Modifiers
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {DND_ATTRS.map(key => {
                    const val = stats.dndAttributes[key] || 10;
                    const mod = getMod(val);
                    const sign = mod >= 0 ? '+' : '';
                    return (
                      <div key={key} className="bg-surface/50 border border-neutral-800/80 rounded-2xl p-3.5 flex flex-col items-center shadow-fey-subtle hover:border-neutral-700 transition-all">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono mb-1.5">{STAT_LABELS[key].slice(0, 3)}</label>
                        <div className="text-2xl font-bold text-white font-mono mb-2 tracking-tight">{sign}{mod}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-muted uppercase">Score</span>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => updateDndAttr(key, parseInt(e.target.value) || 0)}
                            className="w-10 bg-elevated text-center text-xs font-mono font-bold text-white rounded-lg py-0.5 border border-neutral-800 focus:border-white/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                    Skills
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {DND_SKILLS.map(skill => (
                    <div key={skill} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface/40 border border-neutral-800/80 hover:border-neutral-700/80 transition-all shadow-fey-subtle">
                      <label className="text-xs text-mist font-medium">{skill}</label>
                      <input
                        type="number"
                        value={stats.dndSkills[skill] || 0}
                        onChange={(e) => updateDndSkill(skill, parseInt(e.target.value) || 0)}
                        className="w-11 bg-elevated text-center text-xs font-mono font-bold text-white rounded-lg py-0.5 border border-neutral-800 focus:border-white/50 focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Daggerheart Traits */}
          {stats.activeSystem === 'daggerheart' && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal"></span>
                  Daggerheart Traits
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                {DH_STATS.map(key => {
                  const val = stats.daggerheartStats[key] || 0;
                  return (
                    <div key={key} className="bg-surface/50 border border-neutral-800/80 rounded-2xl p-4 flex flex-col items-center shadow-fey-subtle hover:border-neutral-700 transition-all">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider font-mono mb-2">{STAT_LABELS[key]}</label>
                      <div className="flex items-center gap-3 w-full justify-center">
                        <button
                          onClick={() => updateDhStat(key, val - 1)}
                          className="w-8 h-8 rounded-full bg-elevated hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-sm border border-neutral-800 active:scale-95 transition-all"
                        >
                          -
                        </button>
                        <span className="text-3xl font-bold text-white font-mono min-w-[3rem] text-center">
                          {val >= 0 ? `+${val}` : val}
                        </span>
                        <button
                          onClick={() => updateDhStat(key, val + 1)}
                          className="w-8 h-8 rounded-full bg-elevated hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-sm border border-neutral-800 active:scale-95 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Custom Stats Section */}
          <section className="pt-6 border-t border-neutral-800/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mist"></span>
                Custom Stats & Modifiers
              </h3>
              <button
                onClick={addCustomStat}
                className="text-xs text-white hover:text-mist flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full border border-neutral-800 hover:border-neutral-700 transition-all active:scale-95 shadow-fey-subtle"
              >
                <Icons.Add size={13} />
                <span>Add Custom</span>
              </button>
            </div>

            {stats.customStats.length === 0 ? (
              <p className="text-muted text-xs font-mono italic">No custom stats defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.customStats.map((stat) => (
                  <div key={stat.id} className="flex items-center gap-2 bg-surface/50 p-3 rounded-2xl border border-neutral-800 shadow-fey-subtle">
                    <input
                      value={stat.name}
                      onChange={(e) => updateCustomStat(stat.id, { name: e.target.value })}
                      className="bg-transparent text-xs font-semibold text-white focus:outline-none w-full border-b border-transparent focus:border-neutral-700"
                      placeholder="Stat Name"
                    />
                    <input
                      type="number"
                      value={stat.value}
                      onChange={(e) => updateCustomStat(stat.id, { value: parseInt(e.target.value) || 0 })}
                      className="w-12 bg-elevated text-center text-xs font-mono font-bold text-white rounded-lg py-1 border border-neutral-800 focus:border-white/50 focus:outline-none"
                    />
                    <button onClick={() => removeCustomStat(stat.id)} className="text-muted hover:text-rose-400 p-1 rounded-full hover:bg-white/5 transition-colors">
                      <Icons.Close size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="p-3.5 bg-surface/30 rounded-2xl border border-neutral-800/60 text-center">
            <p className="text-muted text-[11px] font-mono leading-relaxed">
              All stats integrate directly with the Dice Chain Editor for formula modifiers (<span className="text-white">dnd_attr:*</span>, <span className="text-white">dh:*</span>, <span className="text-white">custom:*</span>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


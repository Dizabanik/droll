
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
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-6 border-b border-border bg-gradient-to-b from-surface to-background">
        <div className="max-w-5xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
              <Icons.User className="text-accent" size={32} />
              Character Stats
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setSystem('dnd5e')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                  stats.activeSystem === 'dnd5e' 
                    ? "bg-accent text-white border-accent" 
                    : "bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-300"
                )}
              >
                DnD 5e
              </button>
              <button 
                onClick={() => setSystem('daggerheart')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                  stats.activeSystem === 'daggerheart' 
                    ? "bg-daggerheart text-white border-daggerheart" 
                    : "bg-transparent text-zinc-500 border-zinc-700 hover:text-zinc-300"
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
          
          {/* Main System Stats */}
          {stats.activeSystem === 'dnd5e' && (
            <>
              <section>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent"></span> Attributes
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {DND_ATTRS.map(key => {
                    const val = stats.dndAttributes[key] || 10;
                    const mod = getMod(val);
                    const sign = mod >= 0 ? '+' : '';
                    return (
                      <div key={key} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex flex-col items-center">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{STAT_LABELS[key]}</label>
                        <div className="text-3xl font-black text-white font-mono mb-1">{sign}{mod}</div>
                        <input 
                          type="number"
                          value={val}
                          onChange={(e) => updateDndAttr(key, parseInt(e.target.value) || 0)}
                          className="w-12 bg-zinc-950 text-center text-xs font-bold text-zinc-400 rounded py-1 border border-zinc-800 focus:border-accent focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-accent"></span> Skills
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                  {DND_SKILLS.map(skill => (
                    <div key={skill} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700">
                      <label className="text-sm text-zinc-300 font-medium">{skill}</label>
                      <input 
                        type="number"
                        value={stats.dndSkills[skill] || 0}
                        onChange={(e) => updateDndSkill(skill, parseInt(e.target.value) || 0)}
                        className="w-12 bg-zinc-950 text-center text-sm font-mono text-white rounded border border-zinc-800 focus:border-accent focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {stats.activeSystem === 'daggerheart' && (
            <section>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-daggerheart"></span> Traits
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {DH_STATS.map(key => {
                  const val = stats.daggerheartStats[key] || 0;
                  return (
                    <div key={key} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{STAT_LABELS[key]}</label>
                      <input 
                        type="number"
                        value={val}
                        onChange={(e) => updateDhStat(key, parseInt(e.target.value) || 0)}
                        className="w-full bg-transparent text-center text-4xl font-black text-white font-mono focus:outline-none border-b-2 border-transparent focus:border-daggerheart"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Custom Stats Section (Always Visible) */}
          <section className="pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-500"></span> Custom Stats
               </h3>
               <button 
                onClick={addCustomStat}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded"
               >
                 <Icons.Add size={12} /> Add Custom
               </button>
            </div>
            
            {stats.customStats.length === 0 ? (
              <p className="text-zinc-600 text-sm italic">No custom stats defined.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.customStats.map((stat) => (
                   <div key={stat.id} className="flex items-center gap-2 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                      <input 
                        value={stat.name}
                        onChange={(e) => updateCustomStat(stat.id, { name: e.target.value })}
                        className="bg-transparent text-sm font-medium text-white focus:outline-none w-full border-b border-transparent focus:border-zinc-600"
                        placeholder="Stat Name"
                      />
                      <input 
                        type="number"
                        value={stat.value}
                        onChange={(e) => updateCustomStat(stat.id, { value: parseInt(e.target.value) || 0 })}
                        className="w-14 bg-zinc-950 text-center text-sm font-mono text-accent rounded border border-zinc-800 focus:border-accent focus:outline-none"
                      />
                      <button onClick={() => removeCustomStat(stat.id)} className="text-zinc-600 hover:text-red-500 ml-2">
                        <Icons.Close size={14} />
                      </button>
                   </div>
                ))}
              </div>
            )}
          </section>

          <div className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/50 text-center">
            <p className="text-zinc-500 text-xs">
                All defined stats (DnD Attributes, Skills, Daggerheart Traits, and Custom Stats) are available in the Dice Chain Editor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

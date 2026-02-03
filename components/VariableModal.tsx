import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RollVariable } from '../types';
import { Icons } from './ui/Icons';

interface VariableModalProps {
  variables: RollVariable[];
  onConfirm: (values: Record<string, number>) => void;
  onCancel: () => void;
}

export const VariableModal: React.FC<VariableModalProps> = ({ variables, onConfirm, onCancel }) => {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    variables.forEach(v => initial[v.id] = v.defaultValue);
    return initial;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6"
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <Icons.Dice className="text-accent" /> Configure Roll
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          Enter values for the variables used in this roll sequence.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {variables.map(v => (
            <div key={v.id}>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                {v.name}
              </label>
              <input 
                type="number"
                value={values[v.id]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [v.id]: parseInt(e.target.value) || 0 })}
                className="w-full bg-black/50 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                autoFocus={variables[0].id === v.id}
              />
            </div>
          ))}

          <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-800">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
            >
              Roll Dice
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
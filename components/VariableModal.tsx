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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-surface border border-neutral-800 rounded-2xl shadow-fey-xl p-6"
      >
        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2 tracking-tight">
          <Icons.Dice size={18} className="text-white" />
          Configure Variables
        </h2>
        <p className="text-muted text-xs mb-5 font-mono">
          Enter DC/AC targets for conditional roll branches.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {variables.map(v => (
            <div key={v.id}>
              <label className="block text-[10px] font-bold text-muted uppercase font-mono tracking-widest mb-1.5">
                {v.name}
              </label>
              <input
                type="number"
                value={values[v.id]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [v.id]: parseInt(e.target.value) || 0 })}
                className="w-full bg-elevated border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-white/50 focus:outline-none"
                autoFocus={variables[0].id === v.id}
              />
            </div>
          ))}

          <div className="flex gap-2.5 mt-6 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-full text-xs font-semibold text-muted hover:text-white bg-elevated hover:bg-neutral-800 transition-all border border-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-all shadow-fey-subtle active:scale-95"
            >
              Roll Dice
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
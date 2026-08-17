import React from 'react';
import { QuickDiceToolbar } from './QuickDiceToolbar';
import { DicePreset } from '../types';
import { OBRBroadcast } from '../obr/broadcast';

export const LeftToolbarPopover: React.FC = () => {
  const handleRoll = (preset: DicePreset, itemName: string) => {
    OBRBroadcast.send({
      type: 'QUICK_ROLL_EXECUTE',
      preset,
      itemName,
    });
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-1 bg-transparent overflow-hidden">
      <QuickDiceToolbar onRollPreset={handleRoll} className="shadow-none border-zinc-800/80 bg-zinc-950/85" />
    </div>
  );
};

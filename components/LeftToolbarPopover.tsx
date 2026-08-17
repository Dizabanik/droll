import React from 'react';
import { QuickDiceToolbar } from './QuickDiceToolbar';
import { DicePreset } from '../types';
import { sendLocalQuickRoll } from '../obr/localEvents';
import OBR from '@owlbear-rodeo/sdk';

export const LeftToolbarPopover: React.FC = () => {
  const handleRoll = (preset: DicePreset, itemName: string) => {
    sendLocalQuickRoll(preset, itemName);
  };

  const handleFoldChange = async (folded: boolean) => {
    try {
      if (OBR.isAvailable) {
        await OBR.popover.setHeight('com.fateweaver.dice.left_toolbar', folded ? 44 : 520);
      }
    } catch (e) {
      console.error('Failed to resize left toolbar popover:', e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-1 bg-transparent overflow-hidden">
      <QuickDiceToolbar
        onRollPreset={handleRoll}
        onFoldChange={handleFoldChange}
        className="bg-transparent"
      />
    </div>
  );
};

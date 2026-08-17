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

  const handleCustomDxOpenChange = async (open: boolean) => {
    try {
      if (OBR.isAvailable) {
        await OBR.popover.setWidth('com.fateweaver.dice.left_toolbar', open ? 300 : 68);
      }
    } catch (e) {
      console.error('Failed to resize left toolbar width:', e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-start justify-start p-1 bg-transparent overflow-hidden">
      <QuickDiceToolbar
        onRollPreset={handleRoll}
        onFoldChange={handleFoldChange}
        onCustomDxOpenChange={handleCustomDxOpenChange}
        className="bg-transparent"
      />
    </div>
  );
};

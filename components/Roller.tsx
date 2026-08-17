import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DicePreset, CharacterStats } from '../types';
import { RollResults } from './ui/RollResults';
import { useOBR, OBRStorage } from '../obr';
import { execute3DFateRoll } from '../dice-engine/helpers/fateweaverBridge';
import { Dice3DOverlay } from './Dice3DOverlay';
import { useDiceRollStore } from '../dice-engine/dice/store';

interface RollerProps {
  preset: DicePreset | null;
  variables: Record<string, number>;
  characterStats: CharacterStats;
  itemName: string;
  onClose: () => void;
  hideCanvas?: boolean;
  showResultsUI?: boolean;
}

export const Roller: React.FC<RollerProps> = ({
  preset,
  variables,
  characterStats,
  itemName,
  onClose,
  hideCanvas = false,
  showResultsUI = true,
}) => {
  const { playerId, playerName, playerColor } = useOBR();

  const [results, setResults] = useState<StepResult[]>([]);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);

  // Auto-close if UI is hidden (e.g. headless controller mode)
  useEffect(() => {
    if (isComplete && !showResultsUI) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, showResultsUI, onClose]);

  // Clean and run roll whenever preset or key updates
  useEffect(() => {
    if (preset) {
      runRoll();
    }
  }, [preset]);

  const runRoll = async () => {
    if (!preset) return;

    // Reset results & clear any existing 3D dice from tray before starting new roll
    setIsComplete(false);
    setResults([]);
    setGrandTotal(0);
    setBreakdown('');
    useDiceRollStore.getState().clearRoll();

    try {
      const userDiceStyle = await OBRStorage.getDiceStyle();
      const outcome = await execute3DFateRoll(
        preset,
        variables,
        characterStats,
        itemName,
        {
          id: playerId || 'unknown',
          name: playerName || 'Unknown Player',
          color: playerColor || '#3b82f6',
        },
        userDiceStyle
      );

      setResults(outcome.results);
      setGrandTotal(outcome.grandTotal);
      setBreakdown(outcome.breakdown);
      setIsComplete(true);
    } catch (err) {
      console.error('3D Dice Roll Error:', err);
      setIsComplete(true);
    }
  };

  if (!preset) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
      style={{ background: 'transparent' }}
    >
      {/* 3D Dice Canvas Overlay */}
      {!hideCanvas && <Dice3DOverlay />}

      {/* Results Modal - Bottom-Right Screen Placement */}
      <AnimatePresence>
        {showResultsUI && isComplete && results.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 pointer-events-auto max-w-md w-full sm:w-[420px]">
            <RollResults
              results={results}
              isComplete={isComplete}
              onClose={onClose}
              grandTotal={grandTotal}
              breakdown={breakdown}
              itemName={itemName}
              presetName={preset ? preset.name : ''}
            />
          </div>
        )}
      </AnimatePresence>

      {!isComplete && (
        <div className="text-white bg-zinc-950/90 border border-zinc-800 px-5 py-2 rounded-full fixed bottom-8 left-1/2 -translate-x-1/2 font-medium text-sm shadow-xl flex items-center gap-2 pointer-events-none backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Rolling 3D Physics Dice...
        </div>
      )}
    </motion.div>
  );
};
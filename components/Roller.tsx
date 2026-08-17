import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult, DicePreset, CharacterStats } from '../types';
import { RollResults } from './ui/RollResults';
import { useOBR } from '../obr';
import { execute3DFateRoll } from '../dice-engine/helpers/fateweaverBridge';
import { Dice3DOverlay } from './Dice3DOverlay';

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
  const hasRolledRef = useRef(false);

  // Auto-close if UI is hidden (e.g. headless controller mode)
  useEffect(() => {
    if (isComplete && !showResultsUI) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, showResultsUI, onClose]);

  useEffect(() => {
    if (preset && !hasRolledRef.current) {
      hasRolledRef.current = true;
      runRoll();
    }
  }, [preset]);

  const runRoll = async () => {
    if (!preset) return;

    try {
      const outcome = await execute3DFateRoll(
        preset,
        variables,
        characterStats,
        itemName,
        {
          id: playerId || 'unknown',
          name: playerName || 'Unknown Player',
          color: playerColor || '#3b82f6',
        }
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

      {/* Results Modal */}
      <AnimatePresence>
        {showResultsUI && isComplete && results.length > 0 && (
          <div className="z-50 pointer-events-auto">
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
        <div className="text-white bg-zinc-950/80 border border-zinc-800 px-5 py-2 rounded-full absolute bottom-8 font-medium text-sm shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Rolling 3D Physics Dice...
        </div>
      )}
    </motion.div>
  );
};
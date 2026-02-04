/**
 * SharedDiceOverlay Component
 * Renders dice rolls from other players with transparent background for "on-board" effect
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiceScene } from './3d/DiceScene';
import { Icons } from './ui/Icons';
import { OBRBroadcast, DiceRollMessage, DiceRollStartMessage, DiceValuesMessage, RollCompleteMessage } from '../obr';
import { useOBR } from '../obr';
import { PendingDie } from '../utils/engine';
import { StepResult, DamageType } from '../types';
import clsx from 'clsx';

interface ActiveRoll {
    rollId: string; // Unique ID for keying to prevent ghosts
    playerId: string;
    playerName: string;
    playerColor: string;
    presetName: string;
    itemName: string;
    diceConfig: PendingDie[];
    steps: Array<{ id: string; label: string; type: 'standard' | 'daggerheart'; formula: string; damageType: DamageType }>;
    variables: Record<string, number>;
    activeDiceIds: string[];
    diceValues: Record<string, number>;
    results: StepResult[];
    isComplete: boolean;
    grandTotal: number;
    breakdown: string;
}

const FADE_DELAY_MS = 4000; // How long to show completed roll before fading

export const SharedDiceOverlay: React.FC = () => {
    const { playerId } = useOBR();
    const [activeRolls, setActiveRolls] = useState<Map<string, ActiveRoll>>(new Map());
    const fadeTimers = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message: DiceRollMessage, senderId: string) => {
            // Allow self-broadcast so overlay shows our own rolls
            // if (message.playerId === playerId) return;

            switch (message.type) {
                case 'ROLL_START': {
                    const startMsg = message as DiceRollStartMessage;
                    setActiveRolls(prev => {
                        const next = new Map(prev);
                        // Ensure we cleanup any existing roll for this player to prevent ghosts
                        if (next.has(startMsg.playerId)) {
                            next.delete(startMsg.playerId);
                        }

                        next.set(startMsg.playerId, {
                            rollId: `${startMsg.playerId}-${Date.now()}`,
                            playerId: startMsg.playerId,
                            playerName: startMsg.playerName,
                            playerColor: startMsg.playerColor,
                            presetName: startMsg.presetName,
                            itemName: startMsg.itemName,
                            diceConfig: startMsg.diceConfig,
                            steps: startMsg.steps,
                            variables: startMsg.variables,
                            activeDiceIds: [],
                            diceValues: {},
                            results: [],
                            isComplete: false,
                            grandTotal: 0,
                            breakdown: '',
                        });
                        return next;
                    });
                    break;
                }

                case 'DICE_VALUES': {
                    const valuesMsg = message as DiceValuesMessage;
                    setActiveRolls(prev => {
                        const next = new Map(prev);
                        const roll = next.get(valuesMsg.playerId);
                        if (roll) {
                            next.set(valuesMsg.playerId, {
                                ...roll,
                                activeDiceIds: valuesMsg.activeDiceIds,
                                diceValues: { ...roll.diceValues, ...valuesMsg.values },
                            });
                        }
                        return next;
                    });
                    break;
                }

                case 'ROLL_COMPLETE': {
                    const completeMsg = message as RollCompleteMessage;
                    setActiveRolls(prev => {
                        const next = new Map(prev);
                        const roll = next.get(completeMsg.playerId);
                        if (roll) {
                            next.set(completeMsg.playerId, {
                                ...roll,
                                results: completeMsg.results,
                                isComplete: true,
                                grandTotal: completeMsg.grandTotal,
                                breakdown: completeMsg.breakdown,
                                activeDiceIds: [], // Clear active dice
                            });

                            // Set fade timer
                            if (fadeTimers.current.has(completeMsg.playerId)) {
                                clearTimeout(fadeTimers.current.get(completeMsg.playerId)!);
                            }
                            fadeTimers.current.set(
                                completeMsg.playerId,
                                window.setTimeout(() => {
                                    setActiveRolls(p => {
                                        const n = new Map(p);
                                        n.delete(completeMsg.playerId);
                                        return n;
                                    });
                                    fadeTimers.current.delete(completeMsg.playerId);
                                }, FADE_DELAY_MS)
                            );
                        }
                        return next;
                    });
                    break;
                }
            }
        });

        return () => {
            unsubscribe();
            // Clean up fade timers
            fadeTimers.current.forEach(timer => clearTimeout(timer));
            fadeTimers.current.clear();
        };
    }, [playerId]);

    // Don't render if no active rolls from other players
    if (activeRolls.size === 0) return null;

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Transparent 3D scene for each active roll */}
            {Array.from(activeRolls.values()).map(roll => (
                <div key={roll.rollId} className="absolute inset-0">
                    {/* 3D Dice Scene with transparent background */}
                    <div className="absolute inset-0" style={{ background: 'transparent' }}>
                        <DiceScene
                            dice={roll.diceConfig}
                            activeDiceIds={roll.activeDiceIds}
                            damageType={roll.steps[0]?.damageType || 'none'}
                            outcomes={{}}
                            onRollComplete={() => { }} // No-op, we don't control this
                        />
                    </div>

                    {/* Result Panel */}
                    <AnimatePresence>
                        {roll.results.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-auto"
                            >
                                <div className="bg-zinc-900/95 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-lg min-w-[280px] max-w-[360px]">
                                    {/* Player Header */}
                                    <div
                                        className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2"
                                        style={{ backgroundColor: roll.playerColor + '20' }}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: roll.playerColor }}
                                        />
                                        <span className="text-sm font-medium text-white">{roll.playerName}</span>
                                        <span className="text-xs text-zinc-400 ml-auto">{roll.presetName}</span>
                                    </div>

                                    {/* Results List */}
                                    <div className="p-3 space-y-2 max-h-[250px] overflow-y-auto">
                                        {roll.results.filter(r => !r.skipped).map(res => (
                                            <div
                                                key={res.uniqueId}
                                                className="flex justify-between items-center bg-zinc-800/60 rounded-lg px-3 py-2"
                                            >
                                                <div>
                                                    <span className="text-sm text-zinc-200">{res.label}</span>
                                                    <span className="text-xs text-zinc-500 ml-2">({res.formula})</span>
                                                </div>
                                                <span className="text-lg font-mono font-bold text-white">{res.total}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Grand Total */}
                                    {roll.isComplete && roll.grandTotal > 0 && (
                                        <div className="px-4 py-3 bg-zinc-950/90 border-t border-zinc-800 text-center">
                                            <span className="text-xs text-zinc-500 uppercase tracking-wider">Total</span>
                                            <div className="text-3xl font-black text-white font-mono">{roll.grandTotal}</div>
                                            {roll.breakdown && (
                                                <span className="text-xs text-zinc-400">{roll.breakdown}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
};

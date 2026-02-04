/**
 * SharedDiceOverlay Component
 * Renders dice rolls from other players with transparent background for "on-board" effect
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RollResults } from './ui/RollResults';
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
    allDiceConfig: PendingDie[]; // Full config from start
    renderedDice: PendingDie[]; // incrementally revealed dice
    steps: Array<{ id: string; label: string; type: 'standard' | 'daggerheart'; formula: string; damageType: DamageType }>;
    variables: Record<string, number>;
    activeDiceIds: string[];
    diceValues: Record<string, number>;
    results: StepResult[];
    isComplete: boolean;
    grandTotal: number;
    breakdown: string;
    instant: boolean;
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
                        next.set(startMsg.playerId, {
                            rollId: `${startMsg.playerId}-${Date.now()}`,
                            playerId: startMsg.playerId,
                            playerName: startMsg.playerName,
                            playerColor: startMsg.playerColor,
                            presetName: startMsg.presetName,
                            itemName: startMsg.itemName,
                            diceConfig: startMsg.diceConfig,
                            allDiceConfig: startMsg.diceConfig,
                            renderedDice: [], // Start empty
                            steps: startMsg.steps,
                            variables: startMsg.variables,
                            activeDiceIds: [],
                            diceValues: {},
                            results: [],
                            isComplete: false,
                            grandTotal: 0,
                            breakdown: '',
                            instant: !!startMsg.instant
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
                                // Reveal dice that are active
                                renderedDice: [
                                    ...roll.renderedDice,
                                    ...(valuesMsg.activeDiceIds
                                        .filter(id => !roll.renderedDice.some(d => d.id === id))
                                        .map(id => roll.allDiceConfig.find(d => d.id === id))
                                        .filter((d): d is PendingDie => !!d)
                                    )
                                ]
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
            {/* Transparent 3D scene was here - removed for Dice+ integration */}
            {Array.from(activeRolls.values()).map(roll => (
                <div key={roll.rollId} className="absolute inset-0">


                    {/* Result Panel */}
                    <AnimatePresence>
                        {roll.results.length > 0 && (
                            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                                <RollResults
                                    results={roll.results}
                                    isComplete={roll.isComplete}
                                    onClose={() => {
                                        // Allow manually closing by removing from active rolls
                                        setActiveRolls(p => {
                                            const n = new Map(p);
                                            n.delete(roll.playerId);
                                            return n;
                                        });
                                    }}
                                    grandTotal={roll.grandTotal}
                                    breakdown={roll.breakdown}
                                    itemName={roll.itemName}
                                    presetName={roll.presetName}
                                    hideCloseButton={false}
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
};

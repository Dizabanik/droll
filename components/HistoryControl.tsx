
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './ui/Icons';
import { RollHistoryPanel, HistoryEntry } from './RollHistoryPanel';
import { RollResults } from './ui/RollResults';
import OBR from "@owlbear-rodeo/sdk";
import { OBRBroadcast, DiceRollMessage, RollCompleteMessage } from '../obr';
import { useOBR } from '../obr';

// Popover Dimensions
const BTN_SIZE = 60;
const EXPANDED_WIDTH = 400;
const EXPANDED_HEIGHT = 500;
const POPUP_HEIGHT = 300; // Extra height for popup if needed? Or overlapping?

export const HistoryControl: React.FC = () => {
    const { playerId, playerName } = useOBR();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [rollHistory, setRollHistory] = useState<HistoryEntry[]>([]);

    // Active Result Popup State
    const [activeResult, setActiveResult] = useState<RollCompleteMessage | null>(null);
    const resultTimerRef = useRef<number | null>(null);

    // Initial Resize to Button Only
    useEffect(() => {
        resizePopover(false, false);
    }, []);

    // Listen for Rolls
    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message: DiceRollMessage, senderId: string) => {
            if (message.type === 'ROLL_COMPLETE') {
                const msg = message as RollCompleteMessage;

                // 1. Update History
                // (Simplified name resolution for now)
                const resolvedName = (msg.playerId === playerId) ? (playerName || 'Me') : 'Player';
                const newEntry: HistoryEntry = {
                    id: `${msg.playerId}-${Date.now()}`,
                    timestamp: Date.now(),
                    playerId: msg.playerId,
                    playerName: resolvedName, // We can improve metadata fetching if crucial
                    presetName: 'Roll', // Metadata fetching skipped for speed? Or use context?
                    itemName: '',
                    results: msg.results,
                    grandTotal: msg.grandTotal,
                    breakdown: msg.breakdown
                };
                setRollHistory(prev => [newEntry, ...prev].slice(0, 20));

                // 2. Show Popup Logic
                setActiveResult(msg);

                // Auto-hide popup after 4s
                if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
                resultTimerRef.current = window.setTimeout(() => {
                    setActiveResult(null);
                }, 4000);
            }
        });
        return () => {
            unsubscribe();
            if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        };
    }, [playerId, playerName]);

    // Resize Window Effect
    useEffect(() => {
        resizePopover(isHistoryOpen, !!activeResult);
    }, [isHistoryOpen, activeResult]);

    const resizePopover = async (historyOpen: boolean, hasPopup: boolean) => {
        // Calculate needed size
        let width = BTN_SIZE;
        let height = BTN_SIZE;

        if (historyOpen) {
            width = EXPANDED_WIDTH;
            height = EXPANDED_HEIGHT;
        } else if (hasPopup) {
            width = 300; // Popup Width
            height = BTN_SIZE + POPUP_HEIGHT; // Button + Popup space
        }

        try {
            await OBR.popover.open({
                id: 'com.fateweaver.dice.controls',
                url: window.location.pathname + '?popover=true',
                width,
                height,
                anchorOrigin: { horizontal: 'RIGHT', vertical: 'BOTTOM' },
                // Disable click away closing?
                disableClickAway: true,
                // hidePaper: true // We want transparent background so we can shape it?
                // Actually Popover has a paper background usually. 
                // Let's use hidePaper: true and style it ourselves.
                hidePaper: true,
            });
        } catch (e) {
            console.error("Resize failed", e);
        }
    };

    return (
        <div className="flex flex-col items-end justify-end h-full w-full pointer-events-auto relative">

            {/* 1. Popup Result (Above Button) */}
            <AnimatePresence>
                {activeResult && !isHistoryOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="mb-4 mr-2"
                    // Clickable!
                    >
                        <RollResults
                            results={activeResult.results}
                            isComplete={true}
                            onClose={() => setActiveResult(null)}
                            grandTotal={activeResult.grandTotal}
                            breakdown={activeResult.breakdown}
                            itemName={''}
                            presetName={'Roll Result'}
                            hideCloseButton={false}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 2. History Panel (Expands Up/Left) */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="mb-4 w-full h-full bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="p-3 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50">
                            <span className="font-bold text-zinc-200">History</span>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-zinc-700 rounded"><Icons.Close size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <RollHistoryPanel
                                isOpen={true}
                                onClose={() => setIsHistoryOpen(false)}
                                history={rollHistory}
                                embedded={true} // New prop needed to remove fixed positioning
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Toggle Button (Bottom Right) */}
            {/* Only show if history is CLOSED (panel covers it otherwise? or stays below?) */}
            {/* User said: "return to small only button size". So button should persist? */}
            {!isHistoryOpen && (
                <button
                    onClick={() => setIsHistoryOpen(true)}
                    className="p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95"
                    title="Open Roll History"
                >
                    <Icons.Menu size={24} />
                </button>
            )}
        </div>
    );
};

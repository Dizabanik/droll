
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './ui/Icons';
import { RollHistoryPanel, HistoryEntry } from './RollHistoryPanel';
import { RollResults } from './ui/RollResults';
import OBR from "@owlbear-rodeo/sdk";
import { OBRBroadcast, DiceRollMessage, RollCompleteMessage } from '../obr';
import { useOBR } from '../obr';
import clsx from 'clsx';

// Popover Dimensions
const BTN_SIZE = 60;
const POPUP_WIDTH = 300;
const POPUP_HEIGHT = 400; // Enough for result card

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

                const resolvedName = (msg.playerId === playerId) ? (playerName || 'Me') : 'Player';
                const newEntry: HistoryEntry = {
                    id: `${msg.playerId}-${Date.now()}`,
                    timestamp: Date.now(),
                    playerId: msg.playerId,
                    playerName: resolvedName,
                    presetName: 'Roll',
                    itemName: '',
                    results: msg.results,
                    grandTotal: msg.grandTotal,
                    breakdown: msg.breakdown
                };
                setRollHistory(prev => [newEntry, ...prev].slice(0, 20));

                // Show Popup
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

    // Handle Resize Logic
    useEffect(() => {
        if (isHistoryOpen) {
            resizePopover(true, !!activeResult);
        } else {
            // Delay shrink to allow exit animation if we are closing
            const timer = setTimeout(() => {
                resizePopover(false, !!activeResult);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isHistoryOpen]);

    // Handle Popup Resize (Immediate if history closed)
    useEffect(() => {
        if (!isHistoryOpen) {
            resizePopover(false, !!activeResult);
        }
    }, [activeResult]);

    const resizePopover = async (historyOpen: boolean, hasPopup: boolean) => {
        try {
            let width = BTN_SIZE;
            let height = BTN_SIZE;

            if (historyOpen) {
                // Fullscreen Mode
                width = await OBR.viewport.getWidth();
                height = await OBR.viewport.getHeight();
            } else if (hasPopup) {
                width = POPUP_WIDTH; // Popup Width
                height = POPUP_HEIGHT; // Button + Popup space
            }

            await OBR.popover.open({
                id: 'com.fateweaver.dice.controls',
                url: window.location.pathname + '?popover=true',
                width,
                height,
                anchorOrigin: { horizontal: 'RIGHT', vertical: 'BOTTOM' },
                disableClickAway: true,
                hidePaper: true,
            });
        } catch (e) {
            console.error("Resize failed", e);
        }
    };

    return (
        <div className={clsx("relative w-full h-full pointer-events-auto", isHistoryOpen ? "" : "flex flex-col items-end justify-end")}>

            {/* 1. Backdrop (When Open) */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        // Clicking backdrop closes history
                        onClick={() => setIsHistoryOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-0"
                    />
                )}
            </AnimatePresence>

            {/* 2. Sidebar (When Open) */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute right-0 top-0 h-full w-[400px] z-10 shadow-2xl bg-zinc-900 border-l border-zinc-700"
                        // Prevent backdrop click when clicking sidebar
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header is handled by embedded panel or here? 
                             User said "remove history popup (small one)", implying they just want the content.
                             RollHistoryPanel embedded mode renders just the content.
                         */}
                        <div className="h-full flex flex-col pt-16"> {/* Padding top for the close button area if needed, or button is fixed */}
                            <RollHistoryPanel
                                isOpen={true}
                                onClose={() => setIsHistoryOpen(false)}
                                history={rollHistory}
                                embedded={true}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Popup Result (Above Button) - Only show if Sidebar CLOSED */}
            <AnimatePresence>
                {activeResult && !isHistoryOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="mb-4 mr-2 relative z-20"
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

            {/* 4. Main Toggle Button (Fixed Position) 
                It stays in the same place. 
                When Open: Shows 'X'.
                When Closed: Shows 'Menu'.
            */}
            <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={clsx(
                    "absolute bottom-4 right-4 z-50 p-3 rounded-full shadow-lg border transition-all active:scale-95",
                    isHistoryOpen
                        ? "bg-zinc-700 text-white border-zinc-500 hover:bg-zinc-600"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-700"
                )}
                title={isHistoryOpen ? "Close History" : "Open Roll History"}
            >
                {isHistoryOpen ? <Icons.Close size={24} /> : <Icons.Menu size={24} />}
            </button>
        </div>
    );
};


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './ui/Icons';
import { HistoryEntry } from './RollHistoryPanel';
import { RollResults } from './ui/RollResults';
import { DaggerheartStats } from './DaggerheartStats';
import OBR from "@owlbear-rodeo/sdk";
import { OBRBroadcast, DiceRollMessage, RollCompleteMessage, OBRStorage, RollHistoryEntry, DaggerheartVitals, TokenAttachments } from '../obr';
import { useOBR } from '../obr';

// Popover Dimensions
const BTN_SIZE = 60;
const POPUP_WIDTH = 320;
const POPUP_HEIGHT = 280;

export const HistoryControl: React.FC = () => {
    const { playerId, playerName } = useOBR();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [rollHistory, setRollHistory] = useState<HistoryEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Active Result Popup State
    const [activeResult, setActiveResult] = useState<RollCompleteMessage | null>(null);
    const resultTimerRef = useRef<number | null>(null);

    // Handle vitals change - sync to token attachments
    const handleVitalsChange = useCallback(async (vitals: DaggerheartVitals) => {
        try {
            const tokenId = await OBRStorage.getSelectedTokenId();
            if (tokenId) {
                await TokenAttachments.update(tokenId, vitals);
            }
        } catch (e) {
            console.error("Failed to sync vitals to token:", e);
        }
    }, []);

    // Load history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const saved = await OBRStorage.getRollHistory();
                if (saved && saved.length > 0) {
                    // Convert RollHistoryEntry to HistoryEntry (add empty results array)
                    const entries: HistoryEntry[] = saved.map(e => ({
                        ...e,
                        results: [], // We don't store full results in storage
                    }));
                    setRollHistory(entries);
                }
            } catch (e) {
                console.error("Failed to load history:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadHistory();
    }, []);

    // Save history when it changes
    useEffect(() => {
        if (!isLoaded) return;
        // Convert to storage format (strip results to save space)
        const storageEntries: RollHistoryEntry[] = rollHistory.slice(0, 20).map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            playerId: e.playerId,
            playerName: e.playerName,
            presetName: e.presetName,
            itemName: e.itemName,
            grandTotal: e.grandTotal,
            breakdown: e.breakdown,
        }));
        OBRStorage.setRollHistory(storageEntries);
    }, [rollHistory, isLoaded]);

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

                // 2. Show Popup Logic (only if history panel is closed)
                if (!isHistoryOpen) {
                    setActiveResult(msg);

                    // Auto-hide popup after 4s
                    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
                    resultTimerRef.current = window.setTimeout(() => {
                        setActiveResult(null);
                    }, 4000);
                }
            }
        });
        return () => {
            unsubscribe();
            if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        };
    }, [playerId, playerName, isHistoryOpen]);

    // Resize Window Effect
    useEffect(() => {
        resizePopover(isHistoryOpen, !!activeResult);
    }, [isHistoryOpen, activeResult]);

    const resizePopover = async (historyOpen: boolean, hasPopup: boolean) => {
        let width = BTN_SIZE;
        let height = BTN_SIZE;

        if (historyOpen) {
            // FULLSCREEN mode - use OBR viewport dimensions
            try {
                width = await OBR.viewport.getWidth();
                height = await OBR.viewport.getHeight();
            } catch {
                // Fallback to large fixed values
                width = 1920;
                height = 1080;
            }
        } else if (hasPopup) {
            // Small popup mode
            width = POPUP_WIDTH;
            height = BTN_SIZE + 16 + POPUP_HEIGHT;
        }

        try {
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

    const openHistory = () => {
        setIsHistoryOpen(true);
        // Clear any active popup when opening history
        if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        setActiveResult(null);
    };

    const closeHistory = () => {
        setIsHistoryOpen(false);
    };

    return (
        <div className="w-full h-full relative">
            {/* Fullscreen Menu Mode */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeHistory}
                    />

                    {/* Left Panel - Daggerheart Stats */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-sm bg-zinc-950 border-r border-zinc-800 shadow-2xl flex flex-col overflow-y-auto"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <Icons.Dice size={20} className="text-accent" />
                                Daggerheart
                            </h2>
                        </div>
                        <DaggerheartStats onVitalsChange={handleVitalsChange} />
                    </motion.div>

                    {/* Right Panel - Roll History */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative z-10 ml-auto w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <Icons.Menu size={20} className="text-accent" />
                                Roll History
                            </h2>
                            <button
                                onClick={closeHistory}
                                className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                            >
                                <Icons.Close size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                            {rollHistory.length === 0 ? (
                                <div className="text-center text-zinc-600 py-10">
                                    <Icons.Dice size={48} className="mx-auto mb-2 opacity-20" />
                                    <p>No rolls recorded yet.</p>
                                </div>
                            ) : (
                                rollHistory.map((entry) => (
                                    <div key={entry.id} className="relative pl-4 border-l-2 border-zinc-800 hover:border-accent transition-colors">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-zinc-950" />

                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <h3 className="text-white font-medium text-sm">
                                                    {entry.playerName}
                                                </h3>
                                            </div>
                                            <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                                                {entry.presetName}
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50">
                                            <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-white/5">
                                                <span className="text-xs text-zinc-400">{entry.itemName}</span>
                                                <span className="text-lg font-mono font-bold text-white">{entry.grandTotal}</span>
                                            </div>

                                            {entry.results && entry.results.length > 0 && (
                                                <div className="space-y-1.5">
                                                    {entry.results.map(res => (
                                                        <div key={res.uniqueId} className={`flex justify-between items-center px-2 py-1.5 rounded text-xs ${res.wasCrit ? "bg-yellow-500/10 text-yellow-200" : "bg-zinc-950/50 text-zinc-300"
                                                            }`}>
                                                            <div className="flex items-center gap-2">
                                                                <span>{res.total}</span>
                                                                <span className="text-zinc-500 text-[10px]">{res.damageType.slice(0, 3).toUpperCase()}</span>
                                                            </div>
                                                            <span className="text-zinc-600 text-[10px] font-mono">{res.formula}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {entry.breakdown && (
                                                <div className="mt-2 text-[10px] text-right text-zinc-500 font-mono">
                                                    {entry.breakdown}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>

                    {/* Close Button - Same position as history button */}
                    <button
                        onClick={closeHistory}
                        className="absolute bottom-4 right-4 p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95 z-[60]"
                        title="Close Menu"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>
            )}

            {/* Normal Mode - Button + Popup */}
            {!isHistoryOpen && (
                <div className="flex flex-col items-end justify-end h-full w-full pointer-events-auto">
                    {/* Result Popup (Above Button) */}
                    <AnimatePresence>
                        {activeResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                                className="mb-4"
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

                    {/* History Toggle Button */}
                    <button
                        onClick={openHistory}
                        className="p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95"
                        title="Open Menu"
                    >
                        <Icons.Menu size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};

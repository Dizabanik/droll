import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Icons } from './ui/Icons';
import { HistoryEntry } from './RollHistoryPanel';
import { RollResults } from './ui/RollResults';
import { DaggerheartStats } from './DaggerheartStats';
import { CharacterPanel } from './CharacterPanel';
import { FearTracker } from './FearTracker';
import { APP_VERSION, DicePreset, CharacterStats, StepResult } from '../types';
import { Roller } from './Roller';
import { Dice3DOverlay } from './Dice3DOverlay';
import { useDiceRollStore } from '../dice-engine/dice/store';
import OBR from "@owlbear-rodeo/sdk";
import { OBRBroadcast, DiceRollMessage, DiceRollStartMessage, RollCompleteMessage, OBRStorage, RollHistoryEntry, DaggerheartVitals, DaggerheartStatuses, TokenAttachments } from '../obr';
import { useOBR } from '../obr';
import { onLocalQuickRoll } from '../obr/localEvents';

// Popover Dimensions
const BTN_SIZE = 60;

interface RemoteRollState {
    playerId: string;
    playerName: string;
    playerColor: string;
    presetName: string;
    itemName: string;
    isRolling: boolean;
    results?: StepResult[];
    grandTotal?: number;
    breakdown?: string;
}

export const HistoryControl: React.FC = () => {
    const { playerId, playerName } = useOBR();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [rollHistory, setRollHistory] = useState<HistoryEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Remote Roll State (for rendering other players' 3D dice tray and results)
    const [remoteRoll, setRemoteRoll] = useState<RemoteRollState | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Handle vitals change - sync to token attachments
    const handleVitalsChange = useCallback(async (vitals: DaggerheartVitals) => {
        try {
            const tokenId = await OBRStorage.getSelectedTokenId();
            if (tokenId) {
                const statuses = await OBRStorage.getDaggerheartStatuses();
                await TokenAttachments.update(tokenId, vitals, statuses);
            }
        } catch (e) {
            console.error("Failed to sync vitals to token:", e);
        }
    }, []);

    // Handle statuses change - sync to token attachments
    const handleStatusesChange = useCallback(async (statuses: DaggerheartStatuses) => {
        try {
            const tokenId = await OBRStorage.getSelectedTokenId();
            if (tokenId) {
                const vitals = await OBRStorage.getDaggerheartVitals();
                await TokenAttachments.update(tokenId, vitals, statuses);
            }
        } catch (e) {
            console.error("Failed to sync statuses to token:", e);
        }
    }, []);

    // Active Roll State (Local player rolling in 3D)
    const [activeRollPreset, setActiveRollPreset] = useState<DicePreset | null>(null);
    const [activeRollVars, setActiveRollVars] = useState<Record<string, number>>({});
    const [activeRollItemName, setActiveRollItemName] = useState<string>('');

    // Character Stats for Stat Modifiers
    const [stats, setStats] = useState<CharacterStats>({
        activeSystem: 'dnd5e',
        dndAttributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        dndSkills: {},
        daggerheartStats: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
        customStats: []
    });

    // Handle stat roll from Character Panel - trigger roll directly with 3D physics & broadcast
    const handleStatRoll = useCallback((statKey: string, statValue: number) => {
        const statLabel = statKey.charAt(0).toUpperCase() + statKey.slice(1);

        const statRollPreset: DicePreset = {
            id: `stat-roll-${statKey}`,
            name: `${statLabel} Check`,
            variables: [],
            steps: [{
                id: 'dh_stat_roll',
                label: `${statLabel} Check`,
                type: 'daggerheart',
                formula: `2d12+${statValue}`,
                damageType: 'none',
                addToSum: true,
                isCrit: false,
            }]
        };

        setActiveRollItemName(`${statLabel} Check`);
        setActiveRollVars({});
        setActiveRollPreset(statRollPreset);
    }, []);

    // Load Initial History and Stats
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [savedHistory, savedStats] = await Promise.all([
                    OBRStorage.getRollHistory(),
                    OBRStorage.getStats()
                ]);

                if (savedHistory) {
                    const uiHistory: HistoryEntry[] = savedHistory.map(entry => ({
                        id: entry.id,
                        timestamp: entry.timestamp,
                        playerId: entry.playerId,
                        playerName: entry.playerName,
                        presetName: entry.presetName,
                        itemName: entry.itemName,
                        results: (entry.results || []) as StepResult[],
                        grandTotal: entry.grandTotal,
                        breakdown: entry.breakdown
                    }));
                    setRollHistory(uiHistory);
                }

                if (savedStats) {
                    setStats(savedStats);
                }
            } catch (e) {
                console.error("Failed to load history or stats", e);
            } finally {
                setIsLoaded(true);
            }
        };

        loadInitialData();
    }, []);

    // Save History when updated (limit to 20)
    useEffect(() => {
        if (!isLoaded) return;

        const storageEntries: RollHistoryEntry[] = rollHistory.slice(0, 20).map(entry => ({
            id: entry.id,
            timestamp: entry.timestamp,
            playerId: entry.playerId,
            playerName: entry.playerName,
            presetName: entry.presetName,
            itemName: entry.itemName,
            results: entry.results,
            grandTotal: entry.grandTotal,
            breakdown: entry.breakdown
        }));
        OBRStorage.setRollHistory(storageEntries);
    }, [rollHistory, isLoaded]);

    // Initial Resize to Button Only
    useEffect(() => {
        resizePopover(false);
    }, []);

    // Listen for local quick rolls from this client's left toolbar iframe
    useEffect(() => {
        const cleanup = onLocalQuickRoll((preset, itemName) => {
            setActiveRollPreset(preset);
            setActiveRollItemName(itemName);
            setActiveRollVars({});
        });
        return cleanup;
    }, []);

    // Listen for remote rolls across the room
    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message: DiceRollMessage, senderId: string) => {
            if (message.type === 'ROLL_START') {
                const msg = message as DiceRollStartMessage;
                if (msg.playerId !== playerId) {
                    setRemoteRoll({
                        playerId: msg.playerId,
                        playerName: msg.playerName,
                        playerColor: msg.playerColor,
                        presetName: msg.presetName,
                        itemName: msg.itemName,
                        isRolling: true,
                    });
                    if (msg.diceRoll) {
                        // Start IDENTICAL deterministic Rapier simulation with the rolling player's exact rollThrows
                        useDiceRollStore.getState().startRoll(msg.diceRoll, undefined, msg.rollThrows);
                    }
                }
            } else if (message.type === 'ROLL_COMPLETE') {
                const msg = message as RollCompleteMessage;

                // 1. Update History for all room rolls
                const newEntry: HistoryEntry = {
                    id: `${msg.playerId}-${Date.now()}`,
                    timestamp: Date.now(),
                    playerId: msg.playerId,
                    playerName: msg.playerName,
                    presetName: msg.presetName,
                    itemName: msg.itemName,
                    results: msg.results,
                    grandTotal: msg.grandTotal,
                    breakdown: msg.breakdown
                };
                setRollHistory(prev => [newEntry, ...prev].slice(0, 20));

                // 2. If it's a remote roll from another player, show results card and settle dice transforms
                if (msg.playerId !== playerId) {
                    if (msg.rollTransforms && msg.rollValues) {
                        for (const [id, val] of Object.entries(msg.rollValues)) {
                            const transform = msg.rollTransforms[id];
                            if (transform) {
                                useDiceRollStore.getState().finishDieRoll(id, val, transform);
                            }
                        }
                    }

                    setRemoteRoll(prev => ({
                        playerId: msg.playerId,
                        playerName: msg.playerName,
                        playerColor: prev?.playerColor || '#3b82f6',
                        presetName: msg.presetName,
                        itemName: msg.itemName,
                        isRolling: false,
                        results: msg.results,
                        grandTotal: msg.grandTotal,
                        breakdown: msg.breakdown,
                    }));
                }
            }
        });
        return () => {
            unsubscribe();
        };
    }, [playerId, playerName, isHistoryOpen]);

    // Resize Window Effect
    const isRollingOrOpen = isHistoryOpen || !!activeRollPreset || !!remoteRoll;
    useEffect(() => {
        resizePopover(isRollingOrOpen);
    }, [isRollingOrOpen]);

    const resizePopover = async (isExpanded: boolean) => {
        let width = BTN_SIZE;
        let height = BTN_SIZE;

        if (isExpanded) {
            // FULLSCREEN mode - use OBR viewport dimensions so 3D dice and menu can render seamlessly
            try {
                width = await OBR.viewport.getWidth();
                height = await OBR.viewport.getHeight();
            } catch {
                width = 1920;
                height = 1080;
            }
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

                    {/* Fear Tracker - Top Center */}
                    <motion.div
                        initial={{ y: -50, opacity: 0, x: '-50%' }}
                        animate={{ y: 0, opacity: 1, x: '-50%' }}
                        exit={{ y: -50, opacity: 0, x: '-50%' }}
                        transition={{ delay: 0.1 }}
                        className="absolute top-4 left-1/2 z-30"
                        style={{ transform: 'translateX(-50%)' }} // Force centering
                    >
                        <FearTracker />
                    </motion.div>



                    {/* Left Panel - Daggerheart Stats */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative z-10 flex-1 bg-zinc-950 border-r border-zinc-800 shadow-2xl flex flex-col overflow-y-auto"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <Icons.Dice size={20} className="text-accent" />
                                Daggerheart
                            </h2>
                        </div>
                        <DaggerheartStats onVitalsChange={handleVitalsChange} onStatusesChange={handleStatusesChange} />
                    </motion.div>

                    {/* Middle Panel - Character Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
                        className="relative z-10 flex-1 bg-zinc-950/90 border-x border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <Icons.User size={20} className="text-accent" />
                                Character
                            </h2>
                        </div>
                        <CharacterPanel
                            onRoll={handleStatRoll}
                            showSettings={showSettings}
                            onCloseSettings={() => setShowSettings(false)}
                        />
                    </motion.div>

                    {/* Right Panel - Roll History */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative z-10 flex-1 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <div className="flex items-center gap-2">
                                <h2 className="text-white font-bold flex items-center gap-2">
                                    <Icons.Menu size={20} className="text-accent" />
                                    Roll History
                                </h2>
                                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                    {APP_VERSION}
                                </span>
                            </div>
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
                                                                {/* Hope/Fear display for Daggerheart rolls */}
                                                                {res.type === 'daggerheart' && res.dhHope !== undefined && res.dhFear !== undefined && (
                                                                    <div className="flex items-center gap-1 ml-1">
                                                                        <span className={clsx(
                                                                            "px-1 rounded text-[9px] font-bold",
                                                                            res.dhOutcome === 'hope' || res.dhOutcome === 'crit'
                                                                                ? "bg-blue-500/30 text-blue-300"
                                                                                : "bg-blue-500/10 text-blue-400/60"
                                                                        )}>
                                                                            H:{res.dhHope}
                                                                        </span>
                                                                        <span className={clsx(
                                                                            "px-1 rounded text-[9px] font-bold",
                                                                            res.dhOutcome === 'fear'
                                                                                ? "bg-purple-500/50 text-purple-300"
                                                                                : "bg-purple-500/10 text-purple-400/60"
                                                                        )}>
                                                                            F:{res.dhFear}
                                                                        </span>
                                                                        {res.dhOutcome === 'crit' && (
                                                                            <span className="px-1 rounded text-[9px] font-bold bg-yellow-500/30 text-yellow-300">CRIT</span>
                                                                        )}
                                                                    </div>
                                                                )}
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

                    {/* Settings Button - Bottom Left Corner */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="absolute bottom-4 left-4 p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95 z-[60]"
                        title="Character Settings"
                    >
                        <Icons.Settings size={24} />
                    </button>

                    {/* Close Button - Bottom Right Corner */}
                    <button
                        onClick={closeHistory}
                        className="absolute bottom-4 right-4 p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95 z-[60]"
                        title="Close Menu"
                    >
                        <Icons.Close size={24} />
                    </button>
                </div>
            )}

            {/* Normal Mode - History Toggle Button */}
            {!isHistoryOpen && (
                <div className="flex flex-col items-end justify-end h-full w-full pointer-events-auto">
                    <button
                        onClick={openHistory}
                        className="p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95"
                        title="Open Menu"
                    >
                        <Icons.Menu size={24} />
                    </button>
                </div>
            )}

            {/* Local Player 3D Physics Roller Overlay */}
            {activeRollPreset && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
                    <Roller
                        preset={activeRollPreset}
                        variables={activeRollVars}
                        characterStats={stats}
                        itemName={activeRollItemName}
                        onClose={() => setActiveRollPreset(null)}
                        hideCanvas={false}
                        showResultsUI={true}
                    />
                </div>
            )}

            {/* Remote Player 3D Physics Tray & Results Overlay */}
            {remoteRoll && !activeRollPreset && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none">
                    {/* 3D Dice Canvas Overlay (Tray on the left side) */}
                    <Dice3DOverlay />

                    {/* Rolling Banner while dice are rolling */}
                    {remoteRoll.isRolling && (
                        <div className="text-white bg-zinc-950/90 border border-zinc-800 px-5 py-2 rounded-full fixed bottom-8 left-1/2 -translate-x-1/2 font-medium text-sm shadow-xl flex items-center gap-2 pointer-events-none backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                            <span>{remoteRoll.playerName} is rolling 3D physics dice...</span>
                        </div>
                    )}

                    {/* Results Modal on Bottom-Right */}
                    <AnimatePresence>
                        {!remoteRoll.isRolling && remoteRoll.results && remoteRoll.results.length > 0 && (
                            <div className="fixed bottom-6 right-6 z-50 pointer-events-auto max-w-md w-full sm:w-[420px]">
                                <RollResults
                                    results={remoteRoll.results}
                                    isComplete={true}
                                    onClose={() => {
                                        setRemoteRoll(null);
                                        useDiceRollStore.getState().clearRoll();
                                    }}
                                    grandTotal={remoteRoll.grandTotal || 0}
                                    breakdown={remoteRoll.breakdown || ''}
                                    itemName={remoteRoll.itemName || `${remoteRoll.playerName}'s Roll`}
                                    presetName={remoteRoll.presetName || 'Roll Result'}
                                    hideCloseButton={false}
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

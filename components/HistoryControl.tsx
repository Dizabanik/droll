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
import { MiroBoardEmbed } from './MiroBoardEmbed';
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
    const [rollKey, setRollKey] = useState<number>(0);
    const [characterSheetMode, setCharacterSheetMode] = useState<'sheet' | 'miro'>('sheet');
    const [hasEverLoadedMiro, setHasEverLoadedMiro] = useState<boolean>(false);

    useEffect(() => {
        if (characterSheetMode === 'miro') {
            setHasEverLoadedMiro(true);
        }
    }, [characterSheetMode]);

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
            id: `stat-roll-${statKey}-${Date.now()}`,
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

        setRemoteRoll(null);
        setActiveRollItemName(`${statLabel} Check`);
        setActiveRollVars({});
        setActiveRollPreset(statRollPreset);
        setRollKey(k => k + 1);
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

                const savedMode = await OBRStorage.getCharacterSheetMode();
                if (savedMode) {
                    setCharacterSheetMode(savedMode);
                }
            } catch (e) {
                console.error("Failed to load history or stats", e);
            } finally {
                setIsLoaded(true);
            }
        };

        loadInitialData();
    }, []);

    const handleSheetModeChange = async (mode: 'sheet' | 'miro') => {
        setCharacterSheetMode(mode);
        await OBRStorage.setCharacterSheetMode(mode);
    };

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
            setRemoteRoll(null);
            setActiveRollPreset(preset);
            setActiveRollItemName(itemName);
            setActiveRollVars({});
            setRollKey(k => k + 1);
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
        <div className="w-full h-full relative select-none">
            {/* Fullscreen Menu Mode - Persistent DOM so Miro iframe never restarts */}
            <div
                className={clsx(
                    "fixed inset-0 z-50 flex transition-all duration-300",
                    isHistoryOpen
                        ? "opacity-100 pointer-events-auto visible"
                        : "opacity-0 pointer-events-none invisible"
                )}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
                    onClick={closeHistory}
                />

                {/* Left Panel - Daggerheart Stats (Hidden in Miro Mode to give Miro full left+center space) */}
                {characterSheetMode === 'sheet' && (
                    <div className="relative z-10 flex-1 bg-surface/95 border-r border-neutral-800/80 shadow-fey-xl flex flex-col overflow-y-auto">
                        <div className="flex items-center justify-between p-3.5 px-5 border-b border-neutral-800/80 bg-surface">
                            <h2 className="text-white font-bold flex items-center gap-2 text-xs tracking-tight uppercase font-mono">
                                <Icons.Dice size={16} className="text-white" />
                                Daggerheart
                            </h2>
                            <FearTracker />
                        </div>
                        <DaggerheartStats onVitalsChange={handleVitalsChange} onStatusesChange={handleStatusesChange} />
                    </div>
                )}

                {/* Center / Miro Panel (Spans both Left & Center when in Miro Mode) */}
                <div
                    className={clsx(
                        "relative z-10 bg-surface/90 border-x border-neutral-800/80 shadow-fey-xl flex flex-col overflow-hidden transition-all duration-300",
                        characterSheetMode === 'miro' ? "flex-[3]" : "flex-1"
                    )}
                >
                    <div className="flex items-center justify-between p-3 px-5 border-b border-neutral-800/80 bg-surface z-20">
                        <div className="flex items-center gap-3">
                            {characterSheetMode === 'miro' ? (
                                <h2 className="text-white font-bold flex items-center gap-2 text-xs tracking-tight uppercase font-mono">
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect width="18" height="18" x="3" y="3" rx="2" />
                                        <path d="M7 7v10" />
                                        <path d="M12 7v10" />
                                        <path d="M17 7v10" />
                                    </svg>
                                    <span>Miro Board</span>
                                </h2>
                            ) : (
                                <h2 className="text-white font-bold flex items-center gap-2 text-xs tracking-tight uppercase font-mono">
                                    <Icons.User size={16} className="text-white" />
                                    <span>Character</span>
                                </h2>
                            )}

                            {characterSheetMode === 'miro' && <FearTracker />}
                        </div>

                        {/* Mode Toggle Button: Sheet <-> Miro */}
                        <div className="flex items-center bg-elevated border border-neutral-800 rounded-full p-0.5 shadow-inner">
                            <button
                                onClick={() => handleSheetModeChange('sheet')}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                    characterSheetMode === 'sheet'
                                        ? "bg-white text-black font-bold shadow-fey-subtle"
                                        : "text-muted hover:text-white"
                                )}
                                title="Switch to standard Character Sheet"
                            >
                                <Icons.User size={12} />
                                <span>Sheet</span>
                            </button>

                            <button
                                onClick={() => handleSheetModeChange('miro')}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                    characterSheetMode === 'miro'
                                        ? "bg-signal text-white font-bold shadow-fey-signal"
                                        : "text-muted hover:text-white"
                                )}
                                title="Switch to Miro Board"
                            >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect width="18" height="18" x="3" y="3" rx="2" />
                                    <path d="M7 7v10" />
                                    <path d="M12 7v10" />
                                    <path d="M17 7v10" />
                                </svg>
                                <span>Miro</span>
                            </button>
                        </div>
                    </div>

                    {/* Miro Embed & Character Panel kept persistently mounted */}
                    {hasEverLoadedMiro && (
                        <div
                            className={clsx("flex-1 w-full h-full flex flex-col overflow-hidden", characterSheetMode === 'miro' ? "flex" : "hidden")}
                            style={{
                                contentVisibility: (isHistoryOpen && characterSheetMode === 'miro') ? 'visible' : 'hidden',
                                containIntrinsicSize: '100vw 100vh',
                            }}
                        >
                            <MiroBoardEmbed
                                onRollStat={handleStatRoll}
                                isActive={isHistoryOpen && characterSheetMode === 'miro'}
                            />
                        </div>
                    )}

                    <div className={clsx("flex-1 w-full h-full flex flex-col overflow-hidden", characterSheetMode === 'sheet' ? "flex" : "hidden")}>
                        <CharacterPanel
                            onRoll={handleStatRoll}
                            showSettings={showSettings}
                            onCloseSettings={() => setShowSettings(false)}
                        />
                    </div>
                </div>

                {/* Right Panel - Roll History */}
                <div className="relative z-10 flex-1 bg-surface/95 border-l border-neutral-800/80 shadow-fey-xl flex flex-col">
                    <div className="flex items-center justify-between p-3.5 px-5 border-b border-neutral-800/80 bg-surface">
                        <div className="flex items-center gap-2">
                            <h2 className="text-white font-bold flex items-center gap-2 text-xs tracking-tight uppercase font-mono">
                                <Icons.Menu size={16} className="text-white" />
                                Roll Feed
                            </h2>
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-elevated text-muted border border-neutral-800">
                                {APP_VERSION}
                            </span>
                        </div>
                        <button
                            onClick={closeHistory}
                            className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors"
                        >
                            <Icons.Close size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                        {rollHistory.length === 0 ? (
                            <div className="text-center text-muted py-12 flex flex-col items-center gap-2">
                                <Icons.Dice size={36} className="opacity-20 text-muted" />
                                <p className="text-xs font-mono">No rolls recorded yet.</p>
                            </div>
                        ) : (
                            rollHistory.map((entry) => (
                                <div key={entry.id} className="relative pl-4 border-l border-neutral-800 hover:border-neutral-600 transition-colors">
                                    <div className="absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />

                                    <div className="flex justify-between items-start mb-1.5">
                                        <div>
                                            <span className="text-[9px] font-mono text-muted tracking-wider">
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <h3 className="text-white font-bold text-xs tracking-tight">
                                                {entry.playerName}
                                            </h3>
                                        </div>
                                        <div className="text-[9px] font-mono text-muted bg-surface px-2 py-0.5 rounded-full border border-neutral-800 shadow-fey-subtle">
                                            {entry.presetName}
                                        </div>
                                    </div>

                                    <div className="bg-surface/60 rounded-2xl p-3 border border-neutral-800/80 shadow-fey-subtle">
                                        <div className="flex justify-between items-baseline mb-2 pb-1.5 border-b border-neutral-800/60">
                                            <span className="text-xs font-medium text-muted">{entry.itemName}</span>
                                            <span className="text-base font-mono font-bold text-white tracking-tight">{entry.grandTotal}</span>
                                        </div>

                                        {entry.results && entry.results.length > 0 && (
                                            <div className="space-y-1.5">
                                                {entry.results.map(res => (
                                                    <div key={res.uniqueId} className={clsx(
                                                        "flex justify-between items-center px-2.5 py-1.5 rounded-xl text-xs font-mono",
                                                        res.wasCrit ? "bg-ember/15 text-ember border border-ember/30" : "bg-elevated/70 text-white"
                                                    )}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold">{res.total}</span>
                                                            <span className="text-muted text-[9px] uppercase font-mono">{res.damageType.slice(0, 3)}</span>
                                                            {res.type === 'daggerheart' && res.dhHope !== undefined && res.dhFear !== undefined && (
                                                                <div className="flex items-center gap-1 ml-1">
                                                                    <span className={clsx(
                                                                        "px-1.5 py-0.2 rounded-full text-[9px] font-bold font-mono",
                                                                        res.dhOutcome === 'hope' || res.dhOutcome === 'crit'
                                                                            ? "bg-signal/20 text-signal border border-signal/40"
                                                                            : "bg-signal/10 text-signal/50"
                                                                    )}>
                                                                        H:{res.dhHope}
                                                                    </span>
                                                                    <span className={clsx(
                                                                        "px-1.5 py-0.2 rounded-full text-[9px] font-bold font-mono",
                                                                        res.dhOutcome === 'fear'
                                                                            ? "bg-ember/20 text-ember border border-ember/40"
                                                                            : "bg-ember/10 text-ember/50"
                                                                    )}>
                                                                        F:{res.dhFear}
                                                                    </span>
                                                                    {res.dhOutcome === 'crit' && (
                                                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono bg-white text-black shadow-fey-glow">CRIT</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-muted text-[10px] font-mono">{res.formula}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {entry.breakdown && (
                                            <div className="mt-2 text-[10px] text-right text-muted font-mono">
                                                {entry.breakdown}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Settings Button - Bottom Left Corner */}
                <button
                    onClick={() => setShowSettings(true)}
                    className="absolute bottom-5 left-5 p-3.5 bg-surface text-muted hover:text-white hover:bg-elevated rounded-full shadow-fey-lg border border-neutral-800 transition-all active:scale-95 z-[60]"
                    title="Character Settings"
                >
                    <Icons.Settings size={20} />
                </button>

                {/* Close Button - Bottom Right Corner */}
                <button
                    onClick={closeHistory}
                    className="absolute bottom-5 right-5 p-3.5 bg-surface text-muted hover:text-white hover:bg-elevated rounded-full shadow-fey-lg border border-neutral-800 transition-all active:scale-95 z-[60]"
                    title="Close Menu"
                >
                    <Icons.Close size={20} />
                </button>
            </div>

            {/* Normal Mode - History Toggle Button */}
            {!isHistoryOpen && (
                <div className="flex flex-col items-end justify-end h-full w-full pointer-events-auto">
                    <button
                        onClick={openHistory}
                        className="p-3.5 bg-surface text-white hover:text-mist hover:bg-elevated rounded-full shadow-fey-xl border border-neutral-800 transition-all active:scale-95"
                        title="Open Menu"
                    >
                        <Icons.Menu size={22} />
                    </button>
                </div>
            )}

            {/* Local Player 3D Physics Roller Overlay */}
            {activeRollPreset && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
                    <Roller
                        key={rollKey}
                        preset={activeRollPreset}
                        variables={activeRollVars}
                        characterStats={stats}
                        itemName={activeRollItemName}
                        onClose={() => {
                            setActiveRollPreset(null);
                            useDiceRollStore.getState().clearRoll();
                        }}
                        hideCanvas={false}
                        showResultsUI={true}
                    />
                </div>
            )}

            {/* Remote Player 3D Physics Tray & Results Overlay */}
            {remoteRoll && !activeRollPreset && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none">
                    {/* 3D Dice Canvas Overlay */}
                    <Dice3DOverlay />

                    {/* Rolling Banner */}
                    {remoteRoll.isRolling && (
                        <div className="text-white bg-surface/90 border border-neutral-800 px-5 py-2.5 rounded-full fixed bottom-8 left-1/2 -translate-x-1/2 font-semibold text-xs shadow-fey-lg flex items-center gap-2.5 pointer-events-none backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
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

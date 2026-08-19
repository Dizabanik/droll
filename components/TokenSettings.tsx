import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OBR, { Image, Item, isImage } from "@owlbear-rodeo/sdk";
import { Icons } from './ui/Icons';
import { OBRStorage, DaggerheartVitals, DaggerheartStatuses } from '../obr/storage';
import {
    TokenAttachments,
    TokenTrackerData,
    getTokenTrackerData,
    setTokenTrackerData,
    removeTokenTrackerData,
} from '../obr/tokenAttachments';
import { useOBR } from '../obr';
import clsx from 'clsx';

interface TokenInfo {
    id: string;
    name: string;
    imageUrl: string;
    layer: string;
    tracker?: TokenTrackerData | null;
}

interface TokenSettingsProps {
    vitals: DaggerheartVitals;
}

const STATUS_OPTIONS: { key: keyof DaggerheartStatuses; label: string; abbr: string; color: string; bg: string }[] = [
    { key: 'vulnerable', label: 'Vulnerable', abbr: 'VUL', color: 'text-red-400', bg: 'bg-red-950/60 border-red-800/80' },
    { key: 'blinded', label: 'Blinded', abbr: 'BLN', color: 'text-purple-400', bg: 'bg-purple-950/60 border-purple-800/80' },
    { key: 'frightened', label: 'Frightened', abbr: 'FRT', color: 'text-yellow-400', bg: 'bg-yellow-950/60 border-yellow-800/80' },
    { key: 'hidden', label: 'Hidden', abbr: 'HID', color: 'text-slate-400', bg: 'bg-slate-900/60 border-slate-700/80' },
    { key: 'restrained', label: 'Restrained', abbr: 'RST', color: 'text-orange-400', bg: 'bg-orange-950/60 border-orange-800/80' },
    { key: 'slowed', label: 'Slowed', abbr: 'SLW', color: 'text-blue-400', bg: 'bg-blue-950/60 border-blue-800/80' },
    { key: 'weakened', label: 'Weakened', abbr: 'WKN', color: 'text-pink-400', bg: 'bg-pink-950/60 border-pink-800/80' },
    { key: 'empowered', label: 'Empowered', abbr: 'EMP', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800/80' },
];

const DEFAULT_STATUSES: DaggerheartStatuses = {
    vulnerable: false,
    blinded: false,
    frightened: false,
    hidden: false,
    restrained: false,
    slowed: false,
    weakened: false,
    empowered: false,
};

export const TokenSettings: React.FC<TokenSettingsProps> = ({ vitals }) => {
    const { isOBR, ready, role } = useOBR();
    const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([]);
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isGM = role === 'GM' || !isOBR;

    // Load selected token & refresh list
    useEffect(() => {
        if (!ready || !isOBR) {
            setIsLoading(false);
            return;
        }

        const load = async () => {
            try {
                const savedTokenId = await OBRStorage.getSelectedTokenId();
                if (savedTokenId) {
                    setSelectedTokenId(savedTokenId);
                }
                await refreshTokenList();
            } catch (e) {
                console.error("Failed to load token settings:", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();

        const unsubscribe = OBR.scene.items.onChange(async () => {
            await refreshTokenList();
        });

        return () => {
            unsubscribe();
        };
    }, [ready, isOBR]);

    // Keep attached player token updated with latest character vitals
    useEffect(() => {
        if (!selectedTokenId || !ready || !isOBR) return;
        TokenAttachments.update(selectedTokenId, vitals);
    }, [vitals, selectedTokenId, ready, isOBR]);

    const refreshTokenList = async () => {
        setIsRefreshing(true);
        try {
            const items = await OBR.scene.items.getItems(
                (item) => (item.layer === "CHARACTER" || item.layer === "MOUNT") && isImage(item)
            );

            const tokens: TokenInfo[] = items.map((item) => {
                const img = item as Image;
                const tracker = getTokenTrackerData(item);
                return {
                    id: item.id,
                    name: item.name || "Unnamed Token",
                    imageUrl: img.image?.url || "",
                    layer: item.layer,
                    tracker,
                };
            });

            setAvailableTokens(tokens);
        } catch (e) {
            console.error("Failed to refresh tokens:", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const selectPlayerToken = async (tokenId: string | null) => {
        if (selectedTokenId && selectedTokenId !== tokenId) {
            await TokenAttachments.delete(selectedTokenId);
        }

        setSelectedTokenId(tokenId);
        await OBRStorage.setSelectedTokenId(tokenId || undefined);

        if (tokenId) {
            await TokenAttachments.create(tokenId, vitals);
        }
    };

    const clearPlayerSelection = async () => {
        if (selectedTokenId) {
            await TokenAttachments.delete(selectedTokenId);
        }
        setSelectedTokenId(null);
        await OBRStorage.setSelectedTokenId(undefined);
    };

    const handleUpdateTokenTracker = async (tokenId: string, updates: Partial<TokenTrackerData>) => {
        await setTokenTrackerData(tokenId, updates);
        await refreshTokenList();
    };

    const handleRemoveTracker = async (tokenId: string) => {
        await removeTokenTrackerData(tokenId);
        if (editingTokenId === tokenId) {
            setEditingTokenId(null);
        }
        await refreshTokenList();
    };

    const filteredTokens = useMemo(() => {
        if (!searchQuery.trim()) return availableTokens;
        const q = searchQuery.toLowerCase();
        return availableTokens.filter(t => t.name.toLowerCase().includes(q));
    }, [availableTokens, searchQuery]);

    const editingToken = useMemo(() => {
        return availableTokens.find(t => t.id === editingTokenId) || null;
    }, [availableTokens, editingTokenId]);

    if (!isOBR) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted p-8 text-center select-none font-mono">
                <Icons.Dice size={36} className="mb-3 opacity-20 text-muted" />
                <p className="text-xs">Token management is available inside Owlbear Rodeo.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted select-none">
                <div className="text-xs font-mono animate-pulse">Loading tokens...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background select-none overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-surface/30">
                <div className="flex items-center gap-2">
                    <Icons.Target size={18} className="text-white" />
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-tight">Token Management & Trackers</h2>
                        <p className="text-[10px] text-muted font-mono">Manage HUD trackers for player & enemy tokens</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => TokenAttachments.syncAll()}
                        className="px-2.5 py-1 text-[10px] font-mono font-semibold text-muted hover:text-white bg-elevated hover:bg-neutral-800 rounded-full border border-neutral-800 transition-colors"
                        title="Re-draw all attachments on map"
                    >
                        Sync All HUDs
                    </button>
                    <button
                        onClick={() => refreshTokenList()}
                        disabled={isRefreshing}
                        className="p-1.5 text-muted hover:text-white hover:bg-elevated rounded-full transition-colors disabled:opacity-50"
                        title="Refresh scene tokens"
                    >
                        <Icons.Refresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Token List with Search */}
                <div className={clsx("flex flex-col border-r border-neutral-800 overflow-hidden", editingToken ? "w-1/2" : "w-full")}>
                    {/* Search & Filter */}
                    <div className="p-3 border-b border-neutral-800/80 bg-surface/20 flex items-center gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter tokens by name..."
                            className="flex-1 px-3 py-1.5 bg-elevated border border-neutral-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-white/50"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="p-1.5 text-muted hover:text-white rounded-lg"
                            >
                                <Icons.Close size={14} />
                            </button>
                        )}
                    </div>

                    {/* Token Cards Grid */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {filteredTokens.length === 0 ? (
                            <div className="text-center text-muted py-12 flex flex-col items-center gap-2">
                                <Icons.Target size={32} className="opacity-20 text-muted" />
                                <p className="text-xs font-mono">No matching tokens found in scene.</p>
                            </div>
                        ) : (
                            filteredTokens.map((token) => {
                                const isPlayerSelected = token.id === selectedTokenId;
                                const isEditingThis = token.id === editingTokenId;
                                const tracker = token.tracker;
                                const damageDealt = tracker ? Math.max(0, tracker.hpMax - tracker.hp) : 0;

                                return (
                                    <div
                                        key={token.id}
                                        className={clsx(
                                            "p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3",
                                            isEditingThis
                                                ? "bg-surface border-white/60 shadow-fey-glow"
                                                : isPlayerSelected
                                                    ? "bg-surface/80 border-signal/60 shadow-fey-signal"
                                                    : "bg-surface/40 border-neutral-800/80 hover:border-neutral-700 hover:bg-surface/60"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-elevated border border-neutral-800 flex-shrink-0">
                                                {token.imageUrl && (
                                                    <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="text-xs font-bold text-white truncate">{token.name}</h3>
                                                    {isPlayerSelected && (
                                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-signal/20 text-signal border border-signal/40">
                                                            My Sheet
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] font-mono text-muted flex items-center gap-2 mt-0.5">
                                                    {tracker ? (
                                                        tracker.showHp ?? false ? (
                                                            <span className="text-emerald-400 font-bold">
                                                                HP: {tracker.hp}/{tracker.hpMax}
                                                            </span>
                                                        ) : (
                                                            <span className="text-rose-400 font-bold">
                                                                {damageDealt} Dealt
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-muted/60">No Tracker</span>
                                                    )}
                                                    {tracker?.armor ? <span className="text-sky-400">AC:{tracker.armor}</span> : null}
                                                    {tracker?.stress ? <span className="text-purple-400">STR:{tracker.stress}</span> : null}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {/* Edit Stats Tracker */}
                                            <button
                                                onClick={() => setEditingTokenId(editingTokenId === token.id ? null : token.id)}
                                                className={clsx(
                                                    "px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all border",
                                                    isEditingThis
                                                        ? "bg-white text-black font-bold border-white shadow-fey-subtle"
                                                        : tracker
                                                            ? "bg-elevated text-white hover:bg-neutral-800 border-neutral-700"
                                                            : "bg-elevated/50 text-muted hover:text-white hover:bg-elevated border-neutral-800"
                                                )}
                                            >
                                                {tracker ? "Edit Tracker" : "+ Add Tracker"}
                                            </button>

                                            {/* Attach Player Sheet Button */}
                                            <button
                                                onClick={() => isPlayerSelected ? clearPlayerSelection() : selectPlayerToken(token.id)}
                                                className={clsx(
                                                    "p-1.5 rounded-lg text-xs transition-colors border",
                                                    isPlayerSelected
                                                        ? "bg-signal/20 text-signal border-signal/40 hover:bg-signal/30"
                                                        : "bg-elevated/50 text-muted hover:text-white border-neutral-800 hover:bg-elevated"
                                                )}
                                                title={isPlayerSelected ? "Detach my sheet" : "Attach my character sheet to this token"}
                                            >
                                                <Icons.User size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side: Token Tracker Editor Drawer */}
                {editingToken && (
                    <div className="w-1/2 flex flex-col bg-surface/50 overflow-y-auto p-4 space-y-4 font-sans">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-elevated border border-neutral-700">
                                    {editingToken.imageUrl && (
                                        <img src={editingToken.imageUrl} alt={editingToken.name} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white">{editingToken.name}</h3>
                                    <div className="text-[10px] text-muted font-mono">Edit Token Tracker</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingTokenId(null)}
                                className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated"
                            >
                                <Icons.Close size={16} />
                            </button>
                        </div>

                        {/* Tracker Form */}
                        {(() => {
                            const currentTracker: TokenTrackerData = editingToken.tracker || {
                                hp: 15,
                                hpMax: 15,
                                stress: 0,
                                armor: 0,
                                hope: 0,
                                showHp: false, // Default to stealth mode for enemy tokens!
                                hideStats: false,
                                statuses: {
                                    vulnerable: false,
                                    blinded: false,
                                    frightened: false,
                                    hidden: false,
                                    restrained: false,
                                    slowed: false,
                                    weakened: false,
                                    empowered: false,
                                },
                            };

                            const damageDealt = Math.max(0, currentTracker.hpMax - currentTracker.hp);

                            return (
                                <div className="space-y-4">
                                    {/* Show HP Stealth Mode Option */}
                                    <div className="p-3 bg-elevated/70 border border-neutral-800 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-bold text-white block">Display Style ('Show HP')</label>
                                                <p className="text-[10px] text-muted font-mono mt-0.5">
                                                    {currentTracker.showHp
                                                        ? "Players see full HP bar (e.g. 24/30)"
                                                        : "Stealth: Players see only damage dealt (e.g. 6 Dealt)"}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                    ...currentTracker,
                                                    showHp: !currentTracker.showHp,
                                                })}
                                                className={clsx(
                                                    "px-3 py-1 rounded-full text-xs font-mono font-bold transition-all border shadow-fey-subtle",
                                                    currentTracker.showHp
                                                        ? "bg-emerald-950 border-emerald-700 text-emerald-400"
                                                        : "bg-rose-950 border-rose-700 text-rose-300"
                                                )}
                                            >
                                                {currentTracker.showHp ? "Show Full HP" : "Show Dealt Only"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Hit Points Inputs */}
                                    <div className="p-3 bg-elevated/70 border border-neutral-800 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-white font-mono uppercase">Hit Points</label>
                                            {!currentTracker.showHp && (
                                                <span className="text-[10px] font-mono text-rose-400 font-bold">
                                                    Damage Dealt: {damageDealt}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="text-[10px] text-muted font-mono block mb-1">Current HP</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                            ...currentTracker,
                                                            hp: Math.max(0, currentTracker.hp - 1),
                                                        })}
                                                        className="w-7 h-7 bg-surface hover:bg-neutral-800 rounded text-muted hover:text-white font-bold"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={currentTracker.hp}
                                                        onChange={(e) => handleUpdateTokenTracker(editingToken.id, {
                                                            ...currentTracker,
                                                            hp: Math.max(0, parseInt(e.target.value, 10) || 0),
                                                        })}
                                                        className="flex-1 py-1 px-2 bg-surface border border-neutral-700 rounded text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-white"
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                            ...currentTracker,
                                                            hp: Math.min(currentTracker.hpMax, currentTracker.hp + 1),
                                                        })}
                                                        className="w-7 h-7 bg-surface hover:bg-neutral-800 rounded text-muted hover:text-white font-bold"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] text-muted font-mono block mb-1">Max HP</span>
                                                <input
                                                    type="number"
                                                    value={currentTracker.hpMax}
                                                    onChange={(e) => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        hpMax: Math.max(1, parseInt(e.target.value, 10) || 1),
                                                    })}
                                                    className="w-full py-1 px-2 bg-surface border border-neutral-700 rounded text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-white"
                                                />
                                            </div>
                                        </div>

                                        {/* Quick Damage / Heal Deltas */}
                                        <div className="flex items-center gap-1.5 pt-1">
                                            <span className="text-[9px] text-muted font-mono mr-1">Quick:</span>
                                            {[-10, -5, -1, 1, 5, 10].map((d) => (
                                                <button
                                                    key={d}
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        hp: Math.max(0, Math.min(currentTracker.hpMax, currentTracker.hp + d)),
                                                    })}
                                                    className={clsx(
                                                        "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                                                        d < 0
                                                            ? "bg-rose-950/40 border-rose-900/60 text-rose-400 hover:bg-rose-900/60"
                                                            : "bg-emerald-950/40 border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/60"
                                                    )}
                                                >
                                                    {d > 0 ? `+${d}` : d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Armor, Stress, Hope */}
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {/* Armor */}
                                        <div className="p-2.5 bg-elevated/70 border border-neutral-800 rounded-xl flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-sky-400 font-mono uppercase">Armor</span>
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        armor: Math.max(0, (currentTracker.armor ?? 0) - 1),
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-center text-xs font-mono font-bold text-white">
                                                    {currentTracker.armor ?? 0}
                                                </span>
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        armor: (currentTracker.armor ?? 0) + 1,
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stress */}
                                        <div className="p-2.5 bg-elevated/70 border border-neutral-800 rounded-xl flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-purple-400 font-mono uppercase">Stress</span>
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        stress: Math.max(0, (currentTracker.stress ?? 0) - 1),
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-center text-xs font-mono font-bold text-white">
                                                    {currentTracker.stress ?? 0}
                                                </span>
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        stress: (currentTracker.stress ?? 0) + 1,
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        {/* Hope */}
                                        <div className="p-2.5 bg-elevated/70 border border-neutral-800 rounded-xl flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-amber-400 font-mono uppercase">Hope</span>
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        hope: Math.max(0, (currentTracker.hope ?? 0) - 1),
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-center text-xs font-mono font-bold text-white">
                                                    {currentTracker.hope ?? 0}
                                                </span>
                                                <button
                                                    onClick={() => handleUpdateTokenTracker(editingToken.id, {
                                                        ...currentTracker,
                                                        hope: (currentTracker.hope ?? 0) + 1,
                                                    })}
                                                    className="w-6 h-6 bg-surface hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badges */}
                                    <div className="p-3 bg-elevated/70 border border-neutral-800 rounded-xl space-y-2">
                                        <label className="text-xs font-bold text-white font-mono uppercase block">Active Status Conditions</label>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {STATUS_OPTIONS.map((status) => {
                                                const isActive = !!currentTracker.statuses?.[status.key];
                                                return (
                                                    <button
                                                        key={status.key}
                                                        onClick={() => {
                                                            const baseStatuses: DaggerheartStatuses = currentTracker.statuses || DEFAULT_STATUSES;
                                                            handleUpdateTokenTracker(editingToken.id, {
                                                                ...currentTracker,
                                                                statuses: {
                                                                    ...baseStatuses,
                                                                    [status.key]: !isActive,
                                                                },
                                                            });
                                                        }}
                                                        className={clsx(
                                                            "px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border text-center",
                                                            isActive
                                                                ? `${status.bg} ${status.color} shadow-fey-subtle`
                                                                : "bg-surface border-neutral-800 text-muted/60 hover:text-white hover:border-neutral-700"
                                                        )}
                                                    >
                                                        {status.abbr}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Bottom Actions */}
                                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                                        {editingToken.tracker && (
                                            <button
                                                onClick={() => handleRemoveTracker(editingToken.id)}
                                                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg font-mono transition-colors"
                                            >
                                                Remove Tracker
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setEditingTokenId(null)}
                                            className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-full transition-all ml-auto"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Footer / Info Bar */}
            <div className="p-3 border-t border-neutral-800 text-[11px] text-muted font-mono bg-surface/20 flex items-center justify-between">
                <span>💡 Tip: Right-click any token on the map or press <strong className="text-white">Shift + S</strong> to open the Quick Stats popup!</span>
            </div>
        </div>
    );
};

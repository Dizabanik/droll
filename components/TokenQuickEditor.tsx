import React, { useState, useEffect } from 'react';
import OBR, { Image, Item, isImage } from '@owlbear-rodeo/sdk';
import { Icons } from './ui/Icons';
import {
    TokenTrackerData,
    TokenAttachments,
    getTokenTrackerData,
    setTokenTrackerData,
    removeTokenTrackerData,
} from '../obr/tokenAttachments';
import { DaggerheartStatuses } from '../obr/storage';
import clsx from 'clsx';

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

export const TokenQuickEditor: React.FC = () => {
    const [token, setToken] = useState<Image | null>(null);
    const [tracker, setTracker] = useState<TokenTrackerData>({
        hp: 10,
        hpMax: 10,
        stress: 0,
        armor: 0,
        hope: 0,
        showHp: true,
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
    });
    const [isLoading, setIsLoading] = useState(true);
    const [mathInput, setMathInput] = useState('');

    useEffect(() => {
        const loadSelectedToken = async () => {
            try {
                const selection = await OBR.player.getSelection();
                if (selection && selection.length > 0) {
                    const items = await OBR.scene.items.getItems(selection);
                    const valid = items.find((i) => isImage(i)) as Image | undefined;
                    if (valid) {
                        setToken(valid);
                        const existing = getTokenTrackerData(valid);
                        if (existing) {
                            setTracker({
                                hp: existing.hp ?? 10,
                                hpMax: existing.hpMax ?? 10,
                                stress: existing.stress ?? 0,
                                armor: existing.armor ?? 0,
                                hope: existing.hope ?? 0,
                                showHp: existing.showHp ?? true,
                                hideStats: existing.hideStats ?? false,
                                statuses: existing.statuses || {
                                    vulnerable: false,
                                    blinded: false,
                                    frightened: false,
                                    hidden: false,
                                    restrained: false,
                                    slowed: false,
                                    weakened: false,
                                    empowered: false,
                                },
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load selected token:", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadSelectedToken();
    }, []);

    const handleHpChange = async (newHp: number, newMax?: number) => {
        const updated = {
            ...tracker,
            hp: Math.max(0, newHp),
            hpMax: newMax !== undefined ? Math.max(1, newMax) : tracker.hpMax,
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleApplyMathDelta = async (delta: number) => {
        const newHp = Math.max(0, Math.min(tracker.hpMax, tracker.hp + delta));
        await handleHpChange(newHp);
    };

    const handleMathSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = mathInput.trim();
        if (!trimmed) return;

        let delta = 0;
        if (trimmed.startsWith('+')) {
            delta = parseInt(trimmed.slice(1), 10) || 0;
        } else if (trimmed.startsWith('-')) {
            delta = -1 * (parseInt(trimmed.slice(1), 10) || 0);
        } else {
            const absolute = parseInt(trimmed, 10);
            if (!isNaN(absolute)) {
                await handleHpChange(absolute);
                setMathInput('');
                return;
            }
        }

        if (!isNaN(delta)) {
            await handleApplyMathDelta(delta);
        }
        setMathInput('');
    };

    const handleToggleShowHp = async () => {
        const updated = {
            ...tracker,
            showHp: !tracker.showHp,
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleStatDelta = async (stat: 'stress' | 'armor' | 'hope', delta: number) => {
        const current = tracker[stat] ?? 0;
        const updated = {
            ...tracker,
            [stat]: Math.max(0, current + delta),
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleToggleStatus = async (statusKey: keyof DaggerheartStatuses) => {
        const updatedStatuses = {
            ...(tracker.statuses || {}),
            [statusKey]: !tracker.statuses?.[statusKey],
        };
        const updated = {
            ...tracker,
            statuses: updatedStatuses,
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleRemoveTracker = async () => {
        if (token) {
            await removeTokenTrackerData(token.id);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background text-muted select-none">
                <Icons.Refresh size={18} className="animate-spin text-white" />
            </div>
        );
    }

    if (!token) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-background text-muted text-center select-none">
                <Icons.Target size={24} className="mb-2 opacity-30 text-white" />
                <p className="text-xs font-mono">No character token selected.</p>
                <p className="text-[10px] text-muted font-mono mt-1">Select a token on the map to edit stats.</p>
            </div>
        );
    }

    const damageDealt = Math.max(0, tracker.hpMax - tracker.hp);

    return (
        <div className="w-full h-full bg-background text-white flex flex-col justify-between p-3 select-none overflow-y-auto font-sans">
            {/* Header: Token Info + Show HP Toggle */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-neutral-700 overflow-hidden flex-shrink-0">
                        {token.image?.url && (
                            <img src={token.image.url} alt={token.name} className="w-full h-full object-cover" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate">{token.name || 'Token'}</h3>
                        <div className="text-[9px] font-mono text-muted flex items-center gap-1.5">
                            {tracker.showHp ? (
                                <span className="text-emerald-400 font-semibold">Standard HP Bar</span>
                            ) : (
                                <span className="text-rose-400 font-semibold flex items-center gap-1">
                                    <span>💥 Dealt Mode</span>
                                    <span>({damageDealt} dmg)</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Show HP Toggle Button */}
                <button
                    onClick={handleToggleShowHp}
                    className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all border shadow-fey-subtle flex items-center gap-1",
                        tracker.showHp
                            ? "bg-emerald-950/60 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60"
                            : "bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60"
                    )}
                    title={tracker.showHp ? "Click to switch to Stealth HP Dealt mode" : "Click to switch to Standard HP mode"}
                >
                    {tracker.showHp ? "HP: Visible" : "HP: Dealt Only"}
                </button>
            </div>

            {/* Middle Section: HP & Stat Inputs */}
            <div className="grid grid-cols-3 gap-2 py-2">
                {/* Hit Points Box */}
                <div className="col-span-3 bg-surface/80 border border-neutral-800 rounded-xl p-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-muted font-mono tracking-wider">HP</span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={tracker.hp}
                                onChange={(e) => handleHpChange(parseInt(e.target.value, 10) || 0)}
                                className="w-12 px-1.5 py-0.5 bg-elevated border border-neutral-700 rounded text-center text-xs font-bold font-mono text-white focus:outline-none focus:border-white"
                            />
                            <span className="text-muted font-mono text-xs">/</span>
                            <input
                                type="number"
                                value={tracker.hpMax}
                                onChange={(e) => handleHpChange(tracker.hp, parseInt(e.target.value, 10) || 1)}
                                className="w-12 px-1.5 py-0.5 bg-elevated border border-neutral-700 rounded text-center text-xs font-bold font-mono text-muted focus:text-white focus:outline-none focus:border-white"
                            />
                        </div>
                    </div>

                    {/* Quick Math Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleApplyMathDelta(-5)}
                            className="px-1.5 py-0.5 bg-elevated hover:bg-rose-950/60 text-rose-400 rounded text-[10px] font-mono font-bold border border-neutral-800"
                        >
                            -5
                        </button>
                        <button
                            onClick={() => handleApplyMathDelta(-1)}
                            className="px-1.5 py-0.5 bg-elevated hover:bg-rose-950/60 text-rose-400 rounded text-[10px] font-mono font-bold border border-neutral-800"
                        >
                            -1
                        </button>
                        <button
                            onClick={() => handleApplyMathDelta(1)}
                            className="px-1.5 py-0.5 bg-elevated hover:bg-emerald-950/60 text-emerald-400 rounded text-[10px] font-mono font-bold border border-neutral-800"
                        >
                            +1
                        </button>
                        <button
                            onClick={() => handleApplyMathDelta(5)}
                            className="px-1.5 py-0.5 bg-elevated hover:bg-emerald-950/60 text-emerald-400 rounded text-[10px] font-mono font-bold border border-neutral-800"
                        >
                            +5
                        </button>

                        <form onSubmit={handleMathSubmit} className="flex items-center">
                            <input
                                type="text"
                                value={mathInput}
                                onChange={(e) => setMathInput(e.target.value)}
                                placeholder="+/-"
                                className="w-9 px-1 py-0.5 bg-elevated border border-neutral-700 rounded text-center text-[10px] font-mono text-white focus:outline-none focus:border-white"
                            />
                        </form>
                    </div>
                </div>

                {/* Armor Class / Armor */}
                <div className="bg-surface/80 border border-neutral-800 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[9px] uppercase font-bold text-sky-400 font-mono">Armor</span>
                    <div className="flex items-center gap-1 mt-1">
                        <button
                            onClick={() => handleStatDelta('armor', -1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-white">{tracker.armor ?? 0}</span>
                        <button
                            onClick={() => handleStatDelta('armor', 1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Stress */}
                <div className="bg-surface/80 border border-neutral-800 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[9px] uppercase font-bold text-purple-400 font-mono">Stress</span>
                    <div className="flex items-center gap-1 mt-1">
                        <button
                            onClick={() => handleStatDelta('stress', -1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-white">{tracker.stress ?? 0}</span>
                        <button
                            onClick={() => handleStatDelta('stress', 1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Hope */}
                <div className="bg-surface/80 border border-neutral-800 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[9px] uppercase font-bold text-amber-400 font-mono">Hope</span>
                    <div className="flex items-center gap-1 mt-1">
                        <button
                            onClick={() => handleStatDelta('hope', -1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-white">{tracker.hope ?? 0}</span>
                        <button
                            onClick={() => handleStatDelta('hope', 1)}
                            className="w-5 h-5 flex items-center justify-center bg-elevated hover:bg-neutral-800 rounded text-xs text-muted hover:text-white"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Status Badges */}
            <div className="pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase font-bold text-muted font-mono tracking-wider">Statuses</span>
                    <button
                        onClick={handleRemoveTracker}
                        className="text-[9px] text-muted hover:text-rose-400 font-mono underline"
                    >
                        Remove Tracker
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                    {STATUS_OPTIONS.map((status) => {
                        const isActive = !!tracker.statuses?.[status.key];
                        return (
                            <button
                                key={status.key}
                                onClick={() => handleToggleStatus(status.key)}
                                className={clsx(
                                    "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all border text-center",
                                    isActive
                                        ? `${status.bg} ${status.color} shadow-fey-subtle`
                                        : "bg-surface/40 border-neutral-800 text-muted/60 hover:text-white hover:border-neutral-700"
                                )}
                            >
                                {status.abbr}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult } from '../types';
import { Icons } from './ui/Icons';
import clsx from 'clsx';

export interface HistoryEntry {
    id: string;
    timestamp: number;
    playerId: string;
    playerName: string;
    presetName: string;
    itemName: string;
    results: StepResult[];
    grandTotal: number;
    breakdown: string;
}

interface RollHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryEntry[];
    embedded?: boolean;
}

export const RollHistoryPanel: React.FC<RollHistoryPanelProps> = ({ isOpen, onClose, history, embedded = false }) => {
    if (!isOpen && !embedded) return null;

    const content = (
        <div className={clsx("flex flex-col h-full bg-background select-none", embedded ? "" : "border-l border-neutral-800 shadow-fey-xl")}>
            {!embedded && (
                <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-surface/30">
                    <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <Icons.Dice size={18} className="text-white" />
                        Roll Feed
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-elevated rounded-full text-muted hover:text-white transition-colors"
                    >
                        <Icons.Close size={16} />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {history.length === 0 ? (
                    <div className="text-center text-muted py-12 flex flex-col items-center gap-2">
                        <Icons.Dice size={36} className="opacity-20 text-muted" />
                        <p className="text-xs font-mono">No rolls recorded in this session.</p>
                    </div>
                ) : (
                    history.map((entry) => (
                        <div key={entry.id} className="relative pl-4 border-l border-neutral-800 hover:border-neutral-600 transition-colors">
                            <div className="absolute -left-[3.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="text-[10px] font-mono text-muted tracking-wider">
                                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <h3 className="text-white font-bold text-xs tracking-tight">
                                        {entry.playerName}
                                    </h3>
                                </div>
                                <div className="text-[10px] font-mono text-muted bg-surface px-2 py-0.5 rounded-full border border-neutral-800 shadow-fey-subtle">
                                    {entry.presetName}
                                </div>
                            </div>

                            <div className="bg-surface/50 rounded-2xl p-3 border border-neutral-800/80 shadow-fey-subtle">
                                {/* Summary Header */}
                                <div className="flex justify-between items-baseline mb-2 pb-1.5 border-b border-neutral-800/60">
                                    <span className="text-xs font-medium text-muted">{entry.itemName}</span>
                                    <span className="text-lg font-mono font-bold text-white tracking-tight">{entry.grandTotal}</span>
                                </div>

                                {/* Detailed steps */}
                                <div className="space-y-1.5">
                                    {entry.results.map(res => (
                                        <div key={res.uniqueId} className={clsx(
                                            "flex justify-between items-center px-2.5 py-1.5 rounded-xl text-xs font-mono",
                                            res.wasCrit ? "bg-ember/15 text-ember border border-ember/30" : "bg-elevated/70 text-white"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{res.total}</span>
                                                <span className="text-muted text-[9px] uppercase font-mono">{res.damageType.slice(0, 3)}</span>
                                                {/* Hope/Fear display for Daggerheart rolls */}
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
    );

    if (embedded) {
        return content;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[70]"
                    >
                        {content}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};


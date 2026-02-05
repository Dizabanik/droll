
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StepResult } from '../types';
import { RollResults } from './ui/RollResults';
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
    // If embedded, we skip the AnimatePresence wrapper and fixed positioning
    // because the container (Popover) handles the window.
    if (!isOpen && !embedded) return null;

    const content = (
        <div className={clsx("flex flex-col h-full bg-zinc-950", embedded ? "" : "border-l border-zinc-800 shadow-2xl")}>
            {!embedded && (
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <Icons.Menu size={20} className="text-accent" />
                        Roll History
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                        <Icons.Close size={20} />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {history.length === 0 ? (
                    <div className="text-center text-zinc-600 py-10">
                        <Icons.Dice size={48} className="mx-auto mb-2 opacity-20" />
                        <p>No rolls recorded yet.</p>
                    </div>
                ) : (
                    history.map((entry) => (
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
                                {/* Summary Header */}
                                <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-white/5">
                                    <span className="text-xs text-zinc-400">{entry.itemName}</span>
                                    <span className="text-lg font-mono font-bold text-white">{entry.grandTotal}</span>
                                </div>

                                {/* Detailed steps */}
                                <div className="space-y-1.5">
                                    {entry.results.map(res => (
                                        <div key={res.uniqueId} className={clsx(
                                            "flex justify-between items-center px-2 py-1.5 rounded text-xs",
                                            res.wasCrit ? "bg-yellow-500/10 text-yellow-200" : "bg-zinc-950/50 text-zinc-300"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <span>{res.total}</span>
                                                <span className="text-zinc-500 text-[10px]">{res.damageType.slice(0, 3).toUpperCase()}</span>
                                            </div>
                                            <span className="text-zinc-600 text-[10px] font-mono">{res.formula}</span>
                                        </div>
                                    ))}
                                </div>

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
                        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
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

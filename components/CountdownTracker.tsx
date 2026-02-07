import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OBR from "@owlbear-rodeo/sdk";
import { Icons } from './ui/Icons';
import clsx from 'clsx';
import { generateId } from '../utils/engine';

interface Countdown {
    id: string;
    label: string;
    current: number;
    max: number;
}

const METADATA_KEY = 'com.fateweaver.countdowns';

// --- DICE SVGs ---
const DieShape: React.FC<{ max: number; className?: string }> = ({ max, className }) => {
    // Approximate shapes based on max value
    if (max <= 4) return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L2 22h20L12 2z" />
        </svg>
    );
    if (max <= 6) return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
    );
    if (max <= 8) return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2L2 12l10 10 10-10L12 2z" />
        </svg>
    );
    if (max <= 10) return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2l-8 8 8 12 8-12-8-8z" />
        </svg>
    );
    if (max <= 12) return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2l8.5 6.2-3.3 10.8H6.8L3.5 8.2 12 2z" />
        </svg>
    );
    // Default d20 or higher
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 2l9 5-3 11-9 4-6-8 9-12z" />
            {/* Simplified Hexagon/Icosahedron shape needed? Let's use a nice hexagon for now */}
            <path d="M12 2l8.7 5v10L12 22 3.3 17V7L12 2z" />
        </svg>
    );
};

export const CountdownTracker: React.FC = () => {
    const [countdowns, setCountdowns] = useState<Countdown[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newMax, setNewMax] = useState(6);
    const [newLabel, setNewLabel] = useState('');

    // Load & Sync Countdowns
    useEffect(() => {
        // Initial Load
        OBR.room.getMetadata().then(metadata => {
            const data = metadata[METADATA_KEY] as Countdown[];
            if (data) setCountdowns(data);
        });

        // Sync
        const unsubscribe = OBR.room.onMetadataChange(metadata => {
            const data = metadata[METADATA_KEY] as Countdown[];
            if (data) setCountdowns(data);
        });
        return unsubscribe;
    }, []);

    const updateCountdowns = async (newStart: Countdown[]) => {
        await OBR.room.setMetadata({ [METADATA_KEY]: newStart });
    };

    const addCountdown = async () => {
        const newItem: Countdown = {
            id: generateId(),
            label: newLabel || `d${newMax}`,
            current: newMax,
            max: newMax
        };
        await updateCountdowns([...countdowns, newItem]);
        setIsAdding(false);
        setNewLabel('');
        setNewMax(6);
    };

    const removeCountdown = async (id: string) => {
        await updateCountdowns(countdowns.filter(c => c.id !== id));
    };

    const tickCountdown = async (id: string) => {
        const newCounts = countdowns.map(c => {
            if (c.id === id) {
                const next = c.current - 1;
                return { ...c, current: next < 1 ? c.max : next }; // Loop or clamp? User said "countdown goes down". Let's loop for now or stop at 1? "dices should be the same sided as the initial amount". Usually countdowns reset. I'll loop 1->max for ease, or maybe 0? Daggerheart starts at e.g. d6. Ticks down. When it empties... usually implies consequence. I'll stick to looping 6->5...->1->6 for now unless user specifies. Actually, let's just clamp at 1 and let user reset context menu? Or easier: Loop (d6...d1).
                // Let's make it standard countdown: Decrement. If 1 -> Loop to Max? Or stays 1? 
                // User: "When countdown goes down (ticks), the animation... plays".
                // I will make it: if current > 1, decrement. If current === 1, reset to max (or maybe 0?). 
                // Let's simpler: Loop. (current - 1) || max.
            }
            return c;
        });
        await updateCountdowns(newCounts);
    };

    const handleContext = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        if (confirm("Delete this countdown?")) {
            removeCountdown(id);
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-50 flex items-end gap-4 pointer-events-auto">
            <AnimatePresence>
                {countdowns.map(c => (
                    <CountdownDie key={c.id} countdown={c} onClick={() => tickCountdown(c.id)} onContext={(e) => handleContext(e, c.id)} />
                ))}
            </AnimatePresence>

            {/* Add Button */}
            <div className="relative">
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="w-10 h-10 bg-zinc-900/90 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:border-accent hover:bg-zinc-800 transition-all shadow-lg"
                >
                    <Icons.Add size={20} />
                </button>

                {isAdding && (
                    <div className="absolute bottom-14 left-0 bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-48 shadow-xl flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase">New Countdown</h4>
                        <div className="flex gap-2">
                            <select
                                value={newMax}
                                onChange={(e) => setNewMax(Number(e.target.value))}
                                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-white focus:border-accent outline-none flex-1"
                            >
                                <option value={4}>d4</option>
                                <option value={6}>d6</option>
                                <option value={8}>d8</option>
                                <option value={10}>d10</option>
                                <option value={12}>d12</option>
                                <option value={20}>d20</option>
                            </select>
                        </div>
                        <input
                            type="text"
                            placeholder="Label (opt)"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-white focus:border-accent outline-none w-full"
                        />
                        <button
                            onClick={addCountdown}
                            className="w-full bg-accent/20 hover:bg-accent/30 text-accent border border-accent/50 rounded py-1 text-xs font-bold transition-colors"
                        >
                            Create
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const CountdownDie: React.FC<{ countdown: Countdown; onClick: () => void; onContext: (e: React.MouseEvent) => void }> = ({ countdown, onClick, onContext }) => {
    // Animation triggers when `countdown.current` changes
    return (
        <div className="flex flex-col items-center gap-1 group">
            {/* Die */}
            <motion.button
                key={countdown.current} // Trigger animation on change
                initial={{ rotate: -180, scale: 0.8, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                onClick={onClick}
                onContextMenu={onContext}
                className="relative w-14 h-14 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
            >
                <DieShape max={countdown.max} className="w-full h-full drop-shadow-lg opacity-90" />
                <span className="absolute inset-0 flex items-center justify-center font-bold text-lg text-zinc-950 pt-1 pointer-events-none">
                    {countdown.current}
                </span>
            </motion.button>
            {/* Label */}
            <span className="text-[10px] bg-black/50 px-1.5 rounded text-zinc-400 group-hover:text-white transition-colors max-w-[60px] truncate">
                {countdown.label}
            </span>
        </div>
    );
};

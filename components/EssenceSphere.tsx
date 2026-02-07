
import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

export const RANK_COLORS: Record<number, Record<number, string>> = {
    1: { // Green Copper
        1: 'bg-emerald-200 shadow-emerald-200/50', // Initial (Jade)
        2: 'bg-emerald-300 shadow-emerald-300/50', // Middle (Pale)
        3: 'bg-emerald-500 shadow-emerald-500/50', // Upper (Dark)
        4: 'bg-emerald-950 shadow-emerald-900/50 border-emerald-500', // Peak (Black Green)
    },
    2: { // Red Steel
        1: 'bg-red-300 shadow-red-300/50',
        2: 'bg-red-500 shadow-red-500/50',
        3: 'bg-red-700 shadow-red-700/50',
        4: 'bg-red-900 shadow-red-900/50 border-red-500',
    },
    3: { // White Silver
        1: 'bg-slate-200 shadow-slate-200/50',
        2: 'bg-slate-300 shadow-slate-300/50',
        3: 'bg-white shadow-white/50 border-slate-300',
        4: 'bg-slate-100 shadow-slate-100/50 ring-2 ring-white',
    },
    4: { // Yellow Golden
        1: 'bg-yellow-200 shadow-yellow-200/50',
        2: 'bg-yellow-400 shadow-yellow-400/50',
        3: 'bg-yellow-500 shadow-yellow-500/50',
        4: 'bg-amber-500 shadow-amber-500/50 border-yellow-300',
    },
    5: { // Purple Crystal
        1: 'bg-purple-300 shadow-purple-300/50',
        2: 'bg-purple-500 shadow-purple-500/50',
        3: 'bg-purple-700 shadow-purple-700/50',
        4: 'bg-purple-900 shadow-purple-900/50 border-purple-400',
    }
};

interface EssenceSphereProps {
    current: number;
    max: number;
    rank: number;
    stage: number;
    onChange: (updates: { current?: number; max?: number; rank?: number; stage?: number }) => void;
}

export const EssenceSphere: React.FC<EssenceSphereProps> = ({
    current, max, rank, stage, onChange
}) => {
    // Get color or fallback
    const sphereColor = RANK_COLORS[rank]?.[stage] || 'bg-zinc-500 shadow-zinc-500/50';

    return (
        <div className="flex flex-col items-center gap-2 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Primeval Essence</h3>

            <div className="flex items-center gap-6">
                {/* Control Column Left (Rank/Stage) */}
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-600 uppercase font-bold">Rank</label>
                        <select
                            value={rank}
                            onChange={(e) => onChange({ rank: Number(e.target.value) })}
                            className="bg-black/50 border border-zinc-700 rounded text-xs px-1 py-0.5 w-16 text-zinc-300 focus:border-accent outline-none"
                        >
                            <option value={1}>1. Copper</option>
                            <option value={2}>2. Steel</option>
                            <option value={3}>3. Silver</option>
                            <option value={4}>4. Gold</option>
                            <option value={5}>5. Crystal</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-600 uppercase font-bold">Stage</label>
                        <select
                            value={stage}
                            onChange={(e) => onChange({ stage: Number(e.target.value) })}
                            className="bg-black/50 border border-zinc-700 rounded text-xs px-1 py-0.5 w-16 text-zinc-300 focus:border-accent outline-none"
                        >
                            <option value={1}>Initial</option>
                            <option value={2}>Middle</option>
                            <option value={3}>Upper</option>
                            <option value={4}>Peak</option>
                        </select>
                    </div>
                </div>

                {/* The Sphere (BIGGER, 3 parts) */}
                <div className="relative group select-none">
                    <div
                        className={clsx(
                            "w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 border-black/20 transition-all duration-300 overflow-hidden relative",
                            sphereColor,
                            "shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                        )}
                    >
                        {/* Upper Part (Plus) */}
                        <div
                            onClick={() => onChange({ current: Math.min(max, current + 1) })}
                            className="absolute top-0 left-0 right-0 h-[35%] w-full flex items-start justify-center pt-1 cursor-pointer hover:bg-white/10 active:bg-white/20 transition-colors z-10"
                        >
                            <span className="text-white/40 font-bold text-xl drop-shadow-sm">+</span>
                        </div>

                        {/* Middle Part (Value) */}
                        <div className="flex flex-col items-center justify-center h-[30%] z-0 pointer-events-none">
                            <span className="text-4xl font-bold font-mono text-black/80 drop-shadow-sm leading-none mt-1">{current}</span>
                        </div>

                        {/* Bottom Part (Minus) */}
                        <div
                            onClick={() => onChange({ current: Math.max(0, current - 1) })}
                            className="absolute bottom-0 left-0 right-0 h-[35%] w-full flex items-end justify-center pb-1 cursor-pointer hover:bg-white/10 active:bg-white/20 transition-colors z-10"
                        >
                            <span className="text-white/40 font-bold text-xl drop-shadow-sm">-</span>
                        </div>
                    </div>
                </div>

                {/* Max Input Column */}
                <div className="flex flex-col h-full justify-center">
                    <label className="text-[10px] text-zinc-600 uppercase font-bold">Max</label>
                    <input
                        type="number"
                        value={max}
                        onChange={(e) => onChange({ max: Number(e.target.value) })}
                        className="bg-black/50 border border-zinc-700 rounded text-center w-12 py-1 text-sm font-bold text-zinc-300 focus:border-accent outline-none"
                    />
                </div>
            </div>
        </div>
    );
};

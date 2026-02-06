
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { OBRStorage, DaggerheartVitals, DaggerheartStatuses } from '../obr/storage';
import { Icons } from './ui/Icons';
import clsx from 'clsx';

const DEFAULT_VITALS: DaggerheartVitals = {
    hope: 0,
    hopeMax: 6,
    stress: 0,
    stressMax: 6,
    hp: 10,
    hpMax: 10,
    armor: 0,
    armorMax: 5,
};

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

const DAGGERHEART_STATUSES = [
    { key: 'vulnerable', label: 'Vulnerable', color: 'text-red-400' },
    { key: 'blinded', label: 'Blinded', color: 'text-purple-400' },
    { key: 'frightened', label: 'Frightened', color: 'text-yellow-400' },
    { key: 'hidden', label: 'Hidden', color: 'text-slate-400' },
    { key: 'restrained', label: 'Restrained', color: 'text-orange-400' },
    { key: 'slowed', label: 'Slowed', color: 'text-blue-400' },
    { key: 'weakened', label: 'Weakened', color: 'text-pink-400' },
    { key: 'empowered', label: 'Empowered', color: 'text-emerald-400' },
] as const;

interface StatPillProps {
    label: string;
    value: number;
    max: number;
    color: string;
    bgColor: string;
    onDecrement: () => void;
    onIncrement: () => void;
    onMaxChange: (newMax: number) => void;
}

const StatPill: React.FC<StatPillProps> = ({
    label,
    value,
    max,
    color,
    bgColor,
    onDecrement,
    onIncrement,
    onMaxChange,
}) => {
    return (
        <div className="flex items-center gap-2">
            {/* Main Pill */}
            <div className={clsx("flex items-stretch rounded-full overflow-hidden border", bgColor)}>
                {/* Decrement */}
                <button
                    onClick={onDecrement}
                    disabled={value <= 0}
                    className={clsx(
                        "px-3 py-2 font-bold text-lg transition-all",
                        "hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                        color
                    )}
                >
                    −
                </button>

                {/* Value Display */}
                <div className={clsx("flex flex-col items-center justify-center px-3 min-w-[60px] bg-black/30", color)}>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">{label}</span>
                    <span className="text-xl font-mono font-bold">{value}</span>
                </div>

                {/* Increment */}
                <button
                    onClick={onIncrement}
                    disabled={value >= max}
                    className={clsx(
                        "px-3 py-2 font-bold text-lg transition-all",
                        "hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                        color
                    )}
                >
                    +
                </button>
            </div>

            {/* Max Value Input */}
            <div className="flex items-center gap-1 text-zinc-400">
                <span className="text-xs">/</span>
                <input
                    type="number"
                    value={max}
                    onChange={(e) => onMaxChange(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 bg-zinc-800/50 border border-zinc-700 rounded px-1 py-0.5 text-center text-sm font-mono text-white focus:outline-none focus:border-zinc-500"
                />
            </div>
        </div>
    );
};

interface DaggerheartStatsProps {
    // Optional callbacks for external state sync
    onVitalsChange?: (vitals: DaggerheartVitals) => void;
    onStatusesChange?: (statuses: DaggerheartStatuses) => void;
}

export const DaggerheartStats: React.FC<DaggerheartStatsProps> = ({
    onVitalsChange,
    onStatusesChange,
}) => {
    const [vitals, setVitals] = useState<DaggerheartVitals>(DEFAULT_VITALS);
    const [statuses, setStatuses] = useState<DaggerheartStatuses>(DEFAULT_STATUSES);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load on mount
    useEffect(() => {
        const load = async () => {
            try {
                const [savedVitals, savedStatuses] = await Promise.all([
                    OBRStorage.getDaggerheartVitals(),
                    OBRStorage.getDaggerheartStatuses(),
                ]);
                if (savedVitals) setVitals(savedVitals);
                if (savedStatuses) setStatuses(savedStatuses);
            } catch (e) {
                console.error("Failed to load Daggerheart data:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    // Save vitals on change
    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartVitals(vitals);
        onVitalsChange?.(vitals);
    }, [vitals, isLoaded, onVitalsChange]);

    // Save statuses on change
    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartStatuses(statuses);
        onStatusesChange?.(statuses);
    }, [statuses, isLoaded, onStatusesChange]);

    const updateVital = (key: keyof DaggerheartVitals, delta: number) => {
        setVitals(prev => {
            const maxKey = `${key}Max` as keyof DaggerheartVitals;
            const newValue = Math.max(0, Math.min(prev[maxKey], prev[key] + delta));

            // Special: Stress overflow damages HP
            if (key === 'stress' && delta > 0 && prev.stress >= prev.stressMax) {
                return {
                    ...prev,
                    hp: Math.max(0, prev.hp - 1),
                };
            }

            return { ...prev, [key]: newValue };
        });
    };

    const updateVitalMax = (key: keyof DaggerheartVitals, maxKey: keyof DaggerheartVitals, newMax: number) => {
        setVitals(prev => ({
            ...prev,
            [maxKey]: newMax,
            [key]: Math.min(prev[key], newMax),
        }));
    };

    const toggleStatus = (key: keyof DaggerheartStatuses) => {
        setStatuses(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!isLoaded) {
        return <div className="text-zinc-500 text-sm p-4">Loading...</div>;
    }

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Vitals Section */}
            <div className="space-y-3">
                <h3 className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-3">Vitals</h3>

                {/* Hope */}
                <StatPill
                    label="Hope"
                    value={vitals.hope}
                    max={vitals.hopeMax}
                    color="text-amber-300"
                    bgColor="bg-amber-900/30 border-amber-700/50"
                    onDecrement={() => updateVital('hope', -1)}
                    onIncrement={() => updateVital('hope', 1)}
                    onMaxChange={(max) => updateVitalMax('hope', 'hopeMax', max)}
                />

                {/* Stress */}
                <StatPill
                    label="Stress"
                    value={vitals.stress}
                    max={vitals.stressMax}
                    color="text-purple-300"
                    bgColor="bg-purple-900/30 border-purple-700/50"
                    onDecrement={() => updateVital('stress', -1)}
                    onIncrement={() => updateVital('stress', 1)}
                    onMaxChange={(max) => updateVitalMax('stress', 'stressMax', max)}
                />

                {/* HP */}
                <StatPill
                    label="HP"
                    value={vitals.hp}
                    max={vitals.hpMax}
                    color="text-red-300"
                    bgColor="bg-red-900/30 border-red-700/50"
                    onDecrement={() => updateVital('hp', -1)}
                    onIncrement={() => updateVital('hp', 1)}
                    onMaxChange={(max) => updateVitalMax('hp', 'hpMax', max)}
                />

                {/* Armor */}
                <StatPill
                    label="Armor"
                    value={vitals.armor}
                    max={vitals.armorMax}
                    color="text-sky-300"
                    bgColor="bg-sky-900/30 border-sky-700/50"
                    onDecrement={() => updateVital('armor', -1)}
                    onIncrement={() => updateVital('armor', 1)}
                    onMaxChange={(max) => updateVitalMax('armor', 'armorMax', max)}
                />
            </div>

            {/* Statuses Section */}
            <div>
                <h3 className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-3">Conditions</h3>
                <div className="flex flex-wrap gap-2">
                    {DAGGERHEART_STATUSES.map((status) => (
                        <button
                            key={status.key}
                            onClick={() => toggleStatus(status.key)}
                            className={clsx(
                                "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                statuses[status.key]
                                    ? `${status.color} bg-white/10 border-current`
                                    : "text-zinc-500 bg-zinc-800/50 border-zinc-700 hover:border-zinc-500"
                            )}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

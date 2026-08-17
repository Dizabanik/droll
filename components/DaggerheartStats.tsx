
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { OBRStorage, DaggerheartVitals, DaggerheartStatuses, DaggerheartMoney, DaggerheartCharacter } from '../obr/storage';
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

const DEFAULT_MONEY: DaggerheartMoney = {
    primevalFragment: 0,
    primevalStone: 0,
    primevalK: 0,
    primeval10K: 0,
    immortalEssence: 0,
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
    color?: string;
    bgColor?: string;
    onDecrement: () => void;
    onIncrement: () => void;
    onMaxChange?: (newMax: number) => void;
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
        <div className="flex items-center gap-2.5">
            {/* Main Pill */}
            <div className={clsx("flex items-stretch rounded-full overflow-hidden border border-neutral-800 bg-surface shadow-fey-subtle")}>
                {/* Decrement */}
                <button
                    onClick={onDecrement}
                    disabled={value <= 0}
                    className={clsx(
                        "px-3 py-1.5 font-bold text-sm transition-all",
                        "hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-white"
                    )}
                >
                    −
                </button>

                {/* Value Display */}
                <div className={clsx("flex flex-col items-center justify-center px-3 min-w-[64px] bg-elevated/90 border-x border-neutral-800", color)}>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-muted font-mono">{label}</span>
                    <span className="text-base font-mono font-bold tracking-tight">{value}</span>
                </div>

                {/* Increment */}
                <button
                    onClick={onIncrement}
                    disabled={value >= max}
                    className={clsx(
                        "px-3 py-1.5 font-bold text-sm transition-all",
                        "hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-white"
                    )}
                >
                    +
                </button>
            </div>

            {/* Max Value Input */}
            <div className="flex items-center gap-1.5 text-muted">
                <span className="text-xs font-mono">/</span>
                <input
                    type="number"
                    value={max}
                    onChange={(e) => onMaxChange(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-elevated border border-neutral-800 rounded-full py-1 text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-white/50"
                />
            </div>
        </div>
    );
};

const MoneyInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => {
    const [inputValue, setInputValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    // Initial value
    useEffect(() => {
        if (!isFocused) setInputValue(value.toString());
    }, [value, isFocused]);

    const handleBlur = () => {
        setIsFocused(false);
        let newValue = value;
        const input = inputValue.trim();

        if (input.startsWith('+')) {
            newValue += parseInt(input.substring(1)) || 0;
        } else if (input.startsWith('-')) {
            newValue -= parseInt(input.substring(1)) || 0;
        } else {
            const parsed = parseInt(input);
            if (!isNaN(parsed)) newValue = parsed;
        }

        onChange(newValue);
        setInputValue(newValue.toString());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <div className="flex flex-col relative w-full bg-surface/50 p-2.5 rounded-xl border border-neutral-800 shadow-fey-subtle">
            <label className="text-[9px] uppercase font-bold text-muted mb-1 font-mono tracking-wider">{label}</label>
            <div className="relative">
                {isFocused && (
                    <div className="absolute -top-7 left-0 right-0 text-center text-xs font-mono text-white bg-black/90 rounded-full py-0.5 pointer-events-none border border-neutral-700 z-10">
                        {value}
                    </div>
                )}
                <input
                    type="text"
                    value={inputValue}
                    onFocus={() => { setIsFocused(true); setInputValue(""); }}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full bg-elevated border border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white focus:border-white/50 outline-none text-right"
                />
            </div>
        </div>
    );
};

interface DaggerheartStatsProps {
    onVitalsChange?: (vitals: DaggerheartVitals) => void;
    onStatusesChange?: (statuses: DaggerheartStatuses) => void;
}

export const DaggerheartStats: React.FC<DaggerheartStatsProps> = ({
    onVitalsChange,
    onStatusesChange,
}) => {
    const [vitals, setVitals] = useState<DaggerheartVitals>(DEFAULT_VITALS);
    const [statuses, setStatuses] = useState<DaggerheartStatuses>(DEFAULT_STATUSES);
    const [money, setMoney] = useState<DaggerheartMoney>(DEFAULT_MONEY);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [savedVitals, savedStatuses, savedMoney] = await Promise.all([
                    OBRStorage.getDaggerheartVitals(),
                    OBRStorage.getDaggerheartStatuses(),
                    OBRStorage.getDaggerheartMoney(),
                ]);
                if (savedVitals) setVitals(savedVitals);
                if (savedStatuses) setStatuses(savedStatuses);
                if (savedMoney) setMoney(savedMoney);
            } catch (e) {
                console.error("Failed to load Daggerheart data:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartVitals(vitals);
        onVitalsChange?.(vitals);
    }, [vitals, isLoaded, onVitalsChange]);

    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartStatuses(statuses);
        onStatusesChange?.(statuses);
    }, [statuses, isLoaded, onStatusesChange]);

    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartMoney(money);
    }, [money, isLoaded]);

    const updateVital = (key: keyof DaggerheartVitals, delta: number) => {
        setVitals(prev => {
            const maxKey = `${key}Max` as keyof DaggerheartVitals;
            const newValue = Math.max(0, Math.min(prev[maxKey], prev[key] + delta));

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

    const updateMoney = (key: keyof DaggerheartMoney, val: number) => {
        setMoney(prev => ({ ...prev, [key]: val }));
    };

    const [character, setCharacter] = useState<DaggerheartCharacter | null>(null);
    useEffect(() => {
        const loadChar = async () => {
            const char = await OBRStorage.getDaggerheartCharacter();
            if (char) setCharacter(char);
        };
        loadChar();

        const handleStorage = async () => {
            const char = await OBRStorage.getDaggerheartCharacter();
            if (char) setCharacter(char);
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    if (!isLoaded) {
        return <div className="text-muted text-xs font-mono p-4">Loading vitals...</div>;
    }

    const showWealth = character?.settings?.showReverendInsanity;

    return (
        <div className="flex flex-col gap-5 p-4 select-none">
            {/* Vitals Section */}
            <div className="space-y-2.5">
                <h3 className="text-[10px] uppercase font-bold text-muted tracking-widest font-mono mb-2">Vitals</h3>

                {/* Hope */}
                <StatPill
                    label="Hope"
                    value={vitals.hope}
                    max={vitals.hopeMax}
                    color="text-signal"
                    bgColor="bg-surface"
                    onDecrement={() => updateVital('hope', -1)}
                    onIncrement={() => updateVital('hope', 1)}
                    onMaxChange={(max) => updateVitalMax('hope', 'hopeMax', max)}
                />

                {/* Stress */}
                <StatPill
                    label="Stress"
                    value={vitals.stress}
                    max={vitals.stressMax}
                    color="text-ember"
                    bgColor="bg-surface"
                    onDecrement={() => updateVital('stress', -1)}
                    onIncrement={() => updateVital('stress', 1)}
                    onMaxChange={(max) => updateVitalMax('stress', 'stressMax', max)}
                />

                {/* HP */}
                <StatPill
                    label="HP"
                    value={vitals.hp}
                    max={vitals.hpMax}
                    color="text-growth"
                    bgColor="bg-surface"
                    onDecrement={() => updateVital('hp', -1)}
                    onIncrement={() => updateVital('hp', 1)}
                    onMaxChange={(max) => updateVitalMax('hp', 'hpMax', max)}
                />

                {/* Armor */}
                <StatPill
                    label="Armor"
                    value={vitals.armor}
                    max={vitals.armorMax}
                    color="text-mist"
                    bgColor="bg-surface"
                    onDecrement={() => updateVital('armor', -1)}
                    onIncrement={() => updateVital('armor', 1)}
                    onMaxChange={(max) => updateVitalMax('armor', 'armorMax', max)}
                />
            </div>

            {/* Statuses Section */}
            <div>
                <h3 className="text-[10px] uppercase font-bold text-muted tracking-widest font-mono mb-2">Conditions</h3>
                <div className="flex flex-wrap gap-1.5">
                    {DAGGERHEART_STATUSES.map((status) => {
                        const isActive = statuses[status.key];
                        return (
                            <button
                                key={status.key}
                                onClick={() => toggleStatus(status.key)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all border font-mono tracking-wide",
                                    isActive
                                        ? "bg-white text-black border-white shadow-fey-glow font-bold"
                                        : "text-muted bg-surface/50 border-neutral-800 hover:text-white hover:border-neutral-700"
                                )}
                            >
                                {status.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Money Section (Conditional) */}
            {showWealth && (
                <div>
                    <h3 className="text-[10px] uppercase font-bold text-muted tracking-widest font-mono mb-2">Wealth</h3>
                    <div className="grid grid-cols-2 gap-2.5">
                        <MoneyInput label="1/8 Stone" value={money.primevalFragment} onChange={(v) => updateMoney('primevalFragment', v)} />
                        <MoneyInput label="Primeval Stone" value={money.primevalStone} onChange={(v) => updateMoney('primevalStone', v)} />
                        <MoneyInput label="1k Stones" value={money.primevalK} onChange={(v) => updateMoney('primevalK', v)} />
                        <MoneyInput label="10k Stones" value={money.primeval10K} onChange={(v) => updateMoney('primeval10K', v)} />
                        <div className="col-span-2">
                            <MoneyInput label="Immortal Essence Stones" value={money.immortalEssence} onChange={(v) => updateMoney('immortalEssence', v)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

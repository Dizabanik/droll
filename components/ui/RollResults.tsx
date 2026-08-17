import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { StepResult, DamageType } from '../../types';
import { Icons } from './Icons';

export interface RollResultsProps {
    results: StepResult[];
    isComplete: boolean;
    onClose?: () => void;
    grandTotal: number;
    breakdown: string;
    itemName: string;
    presetName: string;
    hideCloseButton?: boolean;
}

const DamageIcon = ({ type }: { type: DamageType }) => {
    const size = 14;
    switch (type) {
        case 'fire': return <Icons.Fire size={size} className="text-ember" />;
        case 'cold': return <Icons.Cold size={size} className="text-signal" />;
        case 'lightning': return <Icons.Lightning size={size} className="text-amber-400" />;
        case 'necrotic': return <Icons.Necrotic size={size} className="text-purple-400" />;
        case 'radiant': return <Icons.Radiant size={size} className="text-white" />;
        case 'acid': return <Icons.Acid size={size} className="text-growth" />;
        case 'poison': return <Icons.Poison size={size} className="text-emerald-400" />;
        case 'psychic': return <Icons.Psychic size={size} className="text-rose-400" />;
        case 'force': return <Icons.Force size={size} className="text-signal" />;
        case 'magic': return <Icons.Magic size={size} className="text-white" />;
        case 'physical': return <Icons.Attack size={size} className="text-mist" />;
        case 'slashing':
        case 'piercing':
        case 'bludgeoning': return <Icons.Attack size={size} className="text-mist" />;
        default: return <Icons.Dice size={size} className="text-muted" />;
    }
};

const DaggerheartVisual = ({ result }: { result: StepResult }) => {
    if (result.type !== 'daggerheart') return null;

    const isHope = result.dhOutcome === 'hope';
    const isFear = result.dhOutcome === 'fear';
    const isCrit = result.dhOutcome === 'crit';

    return (
        <div className="flex flex-col gap-2 mt-2 bg-elevated p-2.5 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between gap-4 px-2">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] text-signal uppercase tracking-widest font-mono font-bold mb-1">Hope</span>
                    <div className="w-9 h-9 rounded-xl bg-signal/15 border border-signal/40 flex items-center justify-center text-signal font-mono font-bold text-lg">
                        {result.dhHope}
                    </div>
                </div>
                <div className="text-[10px] text-muted font-mono uppercase">VS</div>
                <div className="flex flex-col items-center">
                    <span className="text-[9px] text-ember uppercase tracking-widest font-mono font-bold mb-1">Fear</span>
                    <div className="w-9 h-9 rounded-xl bg-ember/15 border border-ember/40 flex items-center justify-center text-ember font-mono font-bold text-lg">
                        {result.dhFear}
                    </div>
                </div>
            </div>
            <div className={clsx(
                "text-center text-xs font-mono font-bold uppercase tracking-wider py-1 rounded-full",
                isCrit && "bg-white text-black shadow-fey-glow",
                isHope && !isCrit && "bg-signal/20 text-signal border border-signal/30",
                isFear && !isCrit && "bg-ember/20 text-ember border border-ember/30",
            )}>
                {isCrit ? "Critical Success!" : (isHope ? "With Hope" : "With Fear")}
            </div>
        </div>
    );
};

export const RollResults: React.FC<RollResultsProps> = ({
    results, isComplete, onClose, grandTotal, breakdown, itemName, presetName, hideCloseButton
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [results.length]);

    return (
        <motion.div
            initial={{ scale: 0.95, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="z-10 w-full max-w-md bg-surface/95 border border-neutral-800 rounded-2xl shadow-fey-xl overflow-hidden backdrop-blur-lg m-4 max-h-[70vh] flex flex-col pointer-events-auto select-none"
        >
            <div className="bg-surface p-3.5 border-b border-neutral-800/80 flex justify-between items-center">
                <div>
                    <h2 className="text-white font-bold flex items-center gap-2 text-xs tracking-tight">
                        <Icons.Dice className="text-white" size={15} />
                        {presetName}
                    </h2>
                    <p className="text-[11px] text-muted font-mono ml-5 mt-0.5">{itemName}</p>
                </div>
                {(isComplete && !hideCloseButton && onClose) && (
                    <button onClick={onClose} className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors">
                        <Icons.Close size={15} />
                    </button>
                )}
            </div>

            <div ref={scrollRef} className="p-3 space-y-2 overflow-y-auto flex-1">
                {results.map((res) => (
                    <motion.div
                        key={res.uniqueId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={clsx(
                            "relative p-3 rounded-xl border transition-all",
                            res.skipped
                                ? "bg-surface/40 border-neutral-800 opacity-40 grayscale"
                                : "bg-elevated/70 border-neutral-800 shadow-fey-subtle",
                            res.wasCrit && "border-amber-400/40 bg-amber-500/10"
                        )}
                    >
                        {res.skipped && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-xl">
                                <span className="text-[10px] text-muted uppercase font-mono tracking-widest border border-neutral-700 px-2 py-0.5 rounded-full">Skipped</span>
                            </div>
                        )}

                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-white font-semibold text-xs flex items-center gap-1.5">
                                    {res.label}
                                    <span className="text-[10px] text-muted font-normal font-mono">({res.formula})</span>
                                    {res.addToSum && <span className="text-[9px] text-signal font-bold font-mono px-1.5 py-0.2 bg-signal/15 rounded-full border border-signal/30">SUM</span>}
                                    {res.wasCrit && <span className="text-[9px] text-amber-400 font-bold font-mono px-1.5 py-0.2 bg-amber-400/15 rounded-full border border-amber-400/30">CRIT</span>}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <DamageIcon type={res.damageType} />
                                    <span className="text-[10px] text-muted font-mono capitalize">{res.damageType === 'none' ? 'Result' : res.damageType}</span>
                                </div>
                            </div>
                            <div className="text-lg font-mono font-bold text-white tracking-tight">
                                {res.total}
                            </div>
                        </div>

                        {res.type === 'daggerheart' && !res.skipped && (
                            <DaggerheartVisual result={res} />
                        )}
                    </motion.div>
                ))}

                {!isComplete && (
                    <div className="flex justify-center p-2">
                        <span className="text-xs text-muted font-mono animate-pulse">Rolling dice...</span>
                    </div>
                )}
            </div>

            {isComplete && grandTotal > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-surface border-t border-neutral-800/80 text-center"
                >
                    <span className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold">Total Damage</span>
                    <div className="text-3xl font-bold text-white my-1 font-mono tracking-tight">
                        {grandTotal}
                    </div>
                    {breakdown && (
                        <span className="text-xs text-muted font-mono">{breakdown}</span>
                    )}
                </motion.div>
            )}

            {(isComplete && !hideCloseButton && onClose) && (
                <div className="p-3 bg-surface border-t border-neutral-800 text-center">
                    <button
                        onClick={onClose}
                        className="w-full bg-white text-black text-xs font-bold py-2 rounded-full hover:bg-neutral-200 transition-all shadow-fey-subtle active:scale-95"
                    >
                        Close
                    </button>
                </div>
            )}
        </motion.div>
    );
};


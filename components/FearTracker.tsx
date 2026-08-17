import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OBRStorage, OBRBroadcast, FearUpdateMessage } from '../obr';
import OBR from "@owlbear-rodeo/sdk";
import { Icons } from './ui/Icons';
import clsx from 'clsx';

const MAX_FEAR = 12;

interface FearTrackerProps {
    className?: string;
}

export const FearTracker: React.FC<FearTrackerProps> = ({ className }) => {
    const [fear, setFear] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showSkullEffect, setShowSkullEffect] = useState(false);

    // Metadata key for shared Fear state
    const METADATA_KEY = 'com.fateweaver.fear';

    // Load initial fear from Room Metadata
    useEffect(() => {
        const load = async () => {
            try {
                if (OBR.isAvailable) {
                    const metadata = await OBR.room.getMetadata();
                    const roomFear = metadata[METADATA_KEY] as number;
                    if (typeof roomFear === 'number') {
                        setFear(roomFear);
                    } else {
                        const saved = await OBRStorage.getFear();
                        if (saved !== null) {
                            setFear(saved);
                            OBR.room.setMetadata({ [METADATA_KEY]: saved });
                        }
                    }
                } else {
                    const saved = await OBRStorage.getFear();
                    if (saved !== null) setFear(saved);
                }
            } catch (e) {
                console.error("Failed to load fear:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    // Listen for room metadata changes (Sync source of truth)
    useEffect(() => {
        if (!OBR.isAvailable) return;
        return OBR.room.onMetadataChange(metadata => {
            const roomFear = metadata[METADATA_KEY] as number;
            if (typeof roomFear === 'number') {
                setFear(roomFear);
            }
        });
    }, []);

    // Listen for effect broadcasts (Visuals only)
    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message) => {
            if (message.type === 'FEAR_UPDATE') {
                const fearMsg = message as FearUpdateMessage;
                if (fearMsg.showEffect) {
                    setShowSkullEffect(true);
                    setTimeout(() => setShowSkullEffect(false), 1200);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Save changes to Room Metadata
    const updateFear = useCallback(async (newFear: number, showEffect: boolean) => {
        const clamped = Math.max(0, Math.min(MAX_FEAR, newFear));
        setFear(clamped);

        if (OBR.isAvailable) {
            OBR.room.setMetadata({ [METADATA_KEY]: clamped });
        }
        OBRStorage.setFear(clamped);

        if (showEffect && clamped > fear) {
            setShowSkullEffect(true);
            setTimeout(() => setShowSkullEffect(false), 1200);

            OBRBroadcast.send({
                type: 'FEAR_UPDATE',
                fear: clamped,
                showEffect: true,
            });
        }
    }, [fear]);

    const addFear = () => {
        if (fear < MAX_FEAR) updateFear(fear + 1, true);
    };

    const removeFear = () => {
        if (fear > 0) updateFear(fear - 1, false);
    };

    const handlePipClick = (index: number) => {
        const targetValue = index + 1;
        // If clicking currently active max pip, decrement by 1
        if (targetValue === fear) {
            updateFear(fear - 1, false);
        } else {
            updateFear(targetValue, targetValue > fear);
        }
    };

    return (
        <>
            {/* Minimalist Glassmorphic Fear Tracker Capsule */}
            <div
                className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 bg-zinc-900/90 border border-purple-500/30 backdrop-blur-md rounded-xl shadow-md transition-all select-none",
                    className
                )}
                title="Daggerheart Fear Resource Tracker (Click pips or +/- to adjust)"
            >
                {/* Skull Icon + Title */}
                <div className="flex items-center gap-1 pr-1 border-r border-zinc-800">
                    <Icons.Death size={13} className={clsx("transition-colors", fear > 0 ? "text-purple-400" : "text-zinc-500")} />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-purple-300 font-mono">
                        Fear
                    </span>
                </div>

                {/* Decrement Micro-Button */}
                <button
                    type="button"
                    onClick={removeFear}
                    disabled={fear <= 0}
                    className="w-4 h-4 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-90"
                    title="Remove Fear (-1)"
                >
                    -
                </button>

                {/* 12 Minimalist Interactive Pips */}
                <div className="flex items-center gap-0.5 px-0.5">
                    {Array.from({ length: MAX_FEAR }).map((_, i) => {
                        const isActive = i < fear;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handlePipClick(i)}
                                className={clsx(
                                    "w-1.5 h-4 rounded-sm transition-all cursor-pointer group relative",
                                    isActive
                                        ? "bg-gradient-to-t from-purple-600 to-rose-500 shadow-[0_0_5px_rgba(168,85,247,0.7)] scale-y-105"
                                        : "bg-zinc-800/80 hover:bg-zinc-700"
                                )}
                                title={`Set Fear to ${i + 1}`}
                            />
                        );
                    })}
                </div>

                {/* Increment Micro-Button */}
                <button
                    type="button"
                    onClick={addFear}
                    disabled={fear >= MAX_FEAR}
                    className="w-4 h-4 rounded flex items-center justify-center text-purple-400 hover:text-purple-200 hover:bg-purple-950/50 disabled:opacity-20 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-90"
                    title="Add Fear (+1)"
                >
                    +
                </button>

                {/* Digital Counter Pill */}
                <div className="pl-1 border-l border-zinc-800 font-mono text-[10px] font-bold">
                    <span className={clsx(fear > 0 ? "text-purple-300" : "text-zinc-500")}>
                        {fear}
                    </span>
                    <span className="text-zinc-600 text-[9px]">/12</span>
                </div>
            </div>

            {/* Subtle Screen Notification when Fear increases */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showSkullEffect && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex items-center gap-3 px-4 py-2 bg-purple-950/90 border border-purple-500/50 rounded-2xl shadow-2xl backdrop-blur-md"
                        >
                            <div className="w-8 h-8 rounded-xl bg-purple-900/60 flex items-center justify-center border border-purple-400/40 text-purple-300">
                                <Icons.Death size={20} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white tracking-wider uppercase font-mono flex items-center gap-1.5">
                                    <span>Fear Gained</span>
                                    <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[10px]">
                                        {fear} / {MAX_FEAR}
                                    </span>
                                </div>
                                <div className="text-[10px] text-purple-300/80">The GM gained a Fear token.</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

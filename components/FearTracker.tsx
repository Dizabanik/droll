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
                    setTimeout(() => setShowSkullEffect(false), 1500);
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
            setTimeout(() => setShowSkullEffect(false), 1500);

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
            {/* Minimalist Fear Tracker Capsule */}
            <div
                className={clsx(
                    "flex items-center gap-1.5 px-3 py-1 bg-surface border border-neutral-800 rounded-full shadow-fey-subtle transition-all select-none",
                    className
                )}
                title="Daggerheart Fear Resource Tracker"
            >
                {/* Skull Icon + Title */}
                <div className="flex items-center gap-1.5 pr-2 border-r border-neutral-800">
                    <Icons.Death size={13} className={clsx("transition-colors", fear > 0 ? "text-ember" : "text-muted")} />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-ember font-mono">
                        Fear
                    </span>
                </div>

                {/* Decrement Micro-Button */}
                <button
                    type="button"
                    onClick={removeFear}
                    disabled={fear <= 0}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-white hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-90"
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
                                    "w-1.5 h-3.5 rounded-full transition-all cursor-pointer",
                                    isActive
                                        ? "bg-ember shadow-fey-ember scale-y-105"
                                        : "bg-neutral-800 hover:bg-neutral-700"
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
                    className="w-4 h-4 rounded-full flex items-center justify-center text-ember hover:text-white hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-90"
                    title="Add Fear (+1)"
                >
                    +
                </button>

                {/* Digital Counter Pill */}
                <div className="pl-2 border-l border-neutral-800 font-mono text-[10px] font-bold">
                    <span className={clsx(fear > 0 ? "text-white" : "text-muted")}>
                        {fear}
                    </span>
                    <span className="text-muted text-[9px]">/12</span>
                </div>
            </div>

            {/* Atmospheric Fullscreen Skull Jump-out Effect */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showSkullEffect && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs"
                        >
                            <motion.div
                                initial={{ scale: 0.2, opacity: 0, rotate: -12 }}
                                animate={{
                                    scale: [0.2, 1.25, 1],
                                    opacity: [0, 1, 1, 0],
                                    rotate: [-12, 6, 0]
                                }}
                                transition={{
                                    duration: 1.4,
                                    times: [0, 0.25, 0.75, 1],
                                    ease: "easeOut"
                                }}
                                className="relative flex flex-col items-center justify-center"
                            >
                                <img
                                    src="skull.png"
                                    alt="FEAR!"
                                    className="w-72 h-72 sm:w-80 sm:h-80 object-contain drop-shadow-[0_0_70px_rgba(255,161,108,0.9)]"
                                />

                                <motion.div
                                    initial={{ opacity: 0.9, scale: 0.9 }}
                                    animate={{ opacity: 0, scale: 1.7 }}
                                    transition={{ duration: 0.9, ease: "easeOut" }}
                                    className="absolute inset-0 bg-ember/30 rounded-full blur-3xl"
                                />

                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -20] }}
                                    transition={{ duration: 1.4, times: [0, 0.2, 0.75, 1] }}
                                    className="text-ember font-black text-5xl sm:text-6xl tracking-widest mt-4 font-mono select-none"
                                    style={{ textShadow: '0 0 40px rgba(255,161,108,0.9), 0 0 80px rgba(255,161,108,0.6)' }}
                                >
                                    FEAR
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};


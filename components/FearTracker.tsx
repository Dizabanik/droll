import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OBRStorage, OBRBroadcast, FearUpdateMessage } from '../obr';
import OBR from "@owlbear-rodeo/sdk";
import clsx from 'clsx';

const MAX_FEAR = 12;

interface FearTrackerProps {
    className?: string;
}

export const FearTracker: React.FC<FearTrackerProps> = ({ className }) => {
    const [fear, setFear] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showSkullEffect, setShowSkullEffect] = useState(false);
    const fromBroadcastRef = useRef(false);

    // Metadata key for shared Fear state
    const METADATA_KEY = 'com.fateweaver.fear';

    // Load initial fear from Room Metadata
    useEffect(() => {
        const load = async () => {
            try {
                // Check OBR metadata first
                if (OBR.isAvailable) {
                    const metadata = await OBR.room.getMetadata();
                    const roomFear = metadata[METADATA_KEY] as number;
                    if (typeof roomFear === 'number') {
                        setFear(roomFear);
                    } else {
                        // Fallback to local storage if no room data (start of session)
                        const saved = await OBRStorage.getFear();
                        if (saved !== null) {
                            setFear(saved);
                            // Sync local -> room
                            OBR.room.setMetadata({ [METADATA_KEY]: saved });
                        }
                    }
                } else {
                    // Fallback for standalone
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

    // Also listen for effect broadcasts (Visuals only)
    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message) => {
            if (message.type === 'FEAR_UPDATE') {
                const fearMsg = message as FearUpdateMessage;
                // Note: We trust metadata for value, but broadcast triggers effect
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
        setFear(newFear);

        // 1. Save to OBR Room (Source of Truth)
        if (OBR.isAvailable) {
            OBR.room.setMetadata({ [METADATA_KEY]: newFear });
        }

        // 2. Save to local storage (Backup/Standalone)
        OBRStorage.setFear(newFear);

        // 3. Broadcast effect if needed
        if (showEffect) {
            // Local effect
            setShowSkullEffect(true);
            setTimeout(() => setShowSkullEffect(false), 1500);

            // Network effect
            OBRBroadcast.send({
                type: 'FEAR_UPDATE',
                fear: newFear,
                showEffect: true,
            });
        }
    }, []);

    const addFear = () => {
        if (fear < MAX_FEAR) updateFear(fear + 1, true);
    };

    const removeFear = () => {
        if (fear > 0) updateFear(fear - 1, false);
    };

    return (
        <>
            {/* Fear Tracker Bar */}
            <div className={clsx(
                "flex items-center justify-center gap-3 px-4 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-700/50 shadow-lg",
                className
            )}>
                {/* Minus Button */}
                <button
                    onClick={removeFear}
                    disabled={fear <= 0}
                    className={clsx(
                        "w-10 h-10 rounded-lg font-bold text-2xl transition-all",
                        "bg-zinc-800 border border-zinc-600 hover:bg-zinc-700",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        "text-red-400 hover:text-red-300"
                    )}
                >
                    −
                </button>

                {/* Skulls Row */}
                <div className="flex items-center gap-1">
                    {Array.from({ length: MAX_FEAR }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={false}
                            animate={{
                                opacity: i < fear ? 1 : 0.15,
                                scale: i < fear ? 1 : 0.8,
                            }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="relative"
                        >
                            <img
                                src="skull.png"
                                alt="Fear"
                                className={clsx(
                                    "w-8 h-8 object-contain transition-all",
                                    i < fear ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" : "grayscale"
                                )}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Plus Button */}
                <button
                    onClick={addFear}
                    disabled={fear >= MAX_FEAR}
                    className={clsx(
                        "w-10 h-10 rounded-lg font-bold text-2xl transition-all",
                        "bg-zinc-800 border border-zinc-600 hover:bg-zinc-700",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        "text-red-400 hover:text-red-300"
                    )}
                >
                    +
                </button>

                {/* Fear Count */}
                <div className="ml-2 px-3 py-1 bg-red-900/40 border border-red-500/50 rounded-lg">
                    <span className="text-red-400 font-bold text-lg">{fear}</span>
                    <span className="text-red-500/70 text-sm ml-1">/ {MAX_FEAR}</span>
                </div>
            </div>

            {/* Fullscreen Skull Effect - Shows for ALL players when fear is added */}
            <AnimatePresence>
                {showSkullEffect && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-black/40"
                    >
                        <motion.div
                            initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                            animate={{
                                scale: [0.3, 1.2, 1],
                                opacity: [0, 1, 1, 0],
                                rotate: [-10, 5, 0]
                            }}
                            transition={{
                                duration: 1.2,
                                times: [0, 0.3, 0.6, 1],
                                ease: "easeOut"
                            }}
                            className="relative"
                        >
                            <img
                                src="skull.png"
                                alt="FEAR!"
                                className="w-80 h-80 object-contain drop-shadow-[0_0_60px_rgba(239,68,68,0.8)]"
                            />
                            {/* Glow pulse effect */}
                            <motion.div
                                initial={{ opacity: 0.8, scale: 1 }}
                                animate={{ opacity: 0, scale: 1.5 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="absolute inset-0 bg-red-500/30 rounded-full blur-3xl"
                            />
                        </motion.div>

                        {/* FEAR text */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: [0, 1, 1, 0], y: [50, 0, 0, -20] }}
                            transition={{ duration: 1.2, times: [0, 0.2, 0.7, 1] }}
                            className="absolute bottom-1/4 text-red-500 font-black text-6xl tracking-widest"
                            style={{ textShadow: '0 0 40px rgba(239,68,68,0.8), 0 0 80px rgba(239,68,68,0.5)' }}
                        >
                            FEAR
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

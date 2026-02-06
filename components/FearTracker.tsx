import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OBRStorage, OBRBroadcast, FearUpdateMessage } from '../obr';
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

    // Load fear from storage on mount
    useEffect(() => {
        const load = async () => {
            try {
                const saved = await OBRStorage.getFear();
                if (saved !== null) setFear(saved);
            } catch (e) {
                console.error("Failed to load fear:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    // Listen for fear updates from other players via broadcast
    useEffect(() => {
        const unsubscribe = OBRBroadcast.onMessage((message) => {
            if (message.type === 'FEAR_UPDATE') {
                const fearMsg = message as FearUpdateMessage;
                fromBroadcastRef.current = true;
                setFear(fearMsg.fear);

                // Show effect if this was a fear increase
                if (fearMsg.showEffect) {
                    setShowSkullEffect(true);
                    setTimeout(() => setShowSkullEffect(false), 1500);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Save fear on change and broadcast to other players
    useEffect(() => {
        if (!isLoaded) return;

        // Save to storage
        OBRStorage.setFear(fear);

        // Don't broadcast if this came from a broadcast (prevent loops)
        if (fromBroadcastRef.current) {
            fromBroadcastRef.current = false;
            return;
        }
    }, [fear, isLoaded]);

    const addFear = useCallback(() => {
        if (fear < MAX_FEAR) {
            const newFear = fear + 1;
            setFear(newFear);

            // Trigger local fullscreen skull effect
            setShowSkullEffect(true);
            setTimeout(() => setShowSkullEffect(false), 1500);

            // Broadcast to all players with effect flag
            OBRBroadcast.send({
                type: 'FEAR_UPDATE',
                fear: newFear,
                showEffect: true,
            });
        }
    }, [fear]);

    const removeFear = useCallback(() => {
        if (fear > 0) {
            const newFear = fear - 1;
            setFear(newFear);

            // Broadcast to all players without effect
            OBRBroadcast.send({
                type: 'FEAR_UPDATE',
                fear: newFear,
                showEffect: false,
            });
        }
    }, [fear]);

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
                                src="../public/skull.png"
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
                                src="../public/skull.png"
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

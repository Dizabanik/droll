
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { OBRStorage, TokenAttachments, DaggerheartCharacter } from '../obr';
import { Icons } from './ui/Icons';
import clsx from 'clsx';
import OBR, { Image } from "@owlbear-rodeo/sdk";

const DEFAULT_CHARACTER: DaggerheartCharacter = {
    agility: 0,
    strength: 0,
    finesse: 0,
    instinct: 0,
    presence: 0,
    knowledge: 0,
    evasion: 10,
    level: 1,
    minorThreshold: 3,
    majorThreshold: 6,
    skulls: 0,
};

const STAT_NAMES = [
    { key: 'agility', label: 'AGI', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
    { key: 'strength', label: 'STR', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
    { key: 'finesse', label: 'FIN', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
    { key: 'instinct', label: 'INS', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
    { key: 'presence', label: 'PRE', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
    { key: 'knowledge', label: 'KNO', color: 'text-zinc-300', bg: 'border-zinc-600 bg-zinc-800/50' },
] as const;

// === Vertical Stat Pill Component ===
interface VerticalStatPillProps {
    label: string;
    value: number;
    color: string;
    bgClass: string;
    showSign?: boolean;
    large?: boolean;
    onIncrement: () => void;
    onDecrement: () => void;
}

const VerticalStatPill: React.FC<VerticalStatPillProps> = ({
    label,
    value,
    color,
    bgClass,
    showSign = true,
    large = false,
    onIncrement,
    onDecrement,
}) => {
    const displayValue = showSign ? (value >= 0 ? `+${value}` : `${value}`) : `${value}`;

    return (
        <div className={clsx(
            "flex flex-col items-center rounded-xl border overflow-hidden",
            bgClass,
            large ? "w-20" : "w-14"
        )}>
            {/* Increment Button */}
            <button
                onClick={onIncrement}
                className={clsx(
                    "w-full py-1 font-bold text-lg transition-all hover:bg-white/10 active:scale-95",
                    color
                )}
            >
                +
            </button>

            {/* Value & Label */}
            <div className={clsx(
                "flex flex-col items-center justify-center bg-black/40 w-full",
                large ? "py-3" : "py-2"
            )}>
                <span className={clsx("font-mono font-bold", color, large ? "text-2xl" : "text-xl")}>
                    {displayValue}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    {label}
                </span>
            </div>

            {/* Decrement Button */}
            <button
                onClick={onDecrement}
                className={clsx(
                    "w-full py-1 font-bold text-lg transition-all hover:bg-white/10 active:scale-95",
                    color
                )}
            >
                −
            </button>
        </div>
    );
};

// === Token Picker Modal ===
interface TokenPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tokenId: string, imageUrl: string) => void;
}

const TokenPicker: React.FC<TokenPickerProps> = ({ isOpen, onClose, onSelect }) => {
    const [tokens, setTokens] = useState<Array<{ id: string; name: string; imageUrl: string }>>([]);

    useEffect(() => {
        if (!isOpen) return;

        const loadTokens = async () => {
            try {
                const items = await OBR.scene.items.getItems(
                    (item) => item.type === "IMAGE" && item.layer === "CHARACTER"
                );
                const tokenData = items.map((item) => ({
                    id: item.id,
                    name: item.name || 'Unknown Token',
                    imageUrl: (item as Image).image?.url || '',
                }));
                setTokens(tokenData);
            } catch (e) {
                console.error("Failed to load tokens:", e);
            }
        };
        loadTokens();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 rounded-xl border border-zinc-700 p-4 max-w-md w-full max-h-[70vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-white font-bold mb-4">Select Token</h3>
                <div className="grid grid-cols-4 gap-2">
                    {tokens.map((token) => (
                        <button
                            key={token.id}
                            onClick={() => { onSelect(token.id, token.imageUrl); onClose(); }}
                            className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-accent transition-all"
                        >
                            <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
                {tokens.length === 0 && (
                    <p className="text-zinc-500 text-center py-4">No tokens found in scene</p>
                )}
            </motion.div>
        </motion.div>
    );
};

// === Main Character Panel ===
interface CharacterPanelProps {
    customStats?: Array<{ name: string; value: number }>;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ customStats = [] }) => {
    const [character, setCharacter] = useState<DaggerheartCharacter>(DEFAULT_CHARACTER);
    const [isLoaded, setIsLoaded] = useState(false);
    const [tokenImage, setTokenImage] = useState<string | null>(null);
    const [showTokenPicker, setShowTokenPicker] = useState(false);

    // Load character data
    useEffect(() => {
        const load = async () => {
            try {
                const saved = await OBRStorage.getDaggerheartCharacter();
                if (saved) setCharacter(saved);

                // Load token image
                const tokenId = await OBRStorage.getSelectedTokenId();
                if (tokenId) {
                    const items = await OBR.scene.items.getItems([tokenId]);
                    if (items.length > 0) {
                        setTokenImage((items[0] as Image).image?.url || null);
                    }
                }
            } catch (e) {
                console.error("Failed to load character:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    // Save character on change
    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartCharacter(character);
    }, [character, isLoaded]);

    const updateStat = (key: keyof DaggerheartCharacter, delta: number) => {
        setCharacter(prev => ({
            ...prev,
            [key]: typeof prev[key] === 'number' ? prev[key] + delta : prev[key],
        }));
    };

    const handleTokenSelect = async (tokenId: string, imageUrl: string) => {
        // Remove attachments from old token
        const oldTokenId = await OBRStorage.getSelectedTokenId();
        if (oldTokenId && oldTokenId !== tokenId) {
            await TokenAttachments.delete(oldTokenId);
        }

        // Set new token
        await OBRStorage.setSelectedTokenId(tokenId);
        setTokenImage(imageUrl);

        // Create attachments on new token
        const vitals = await OBRStorage.getDaggerheartVitals();
        const statuses = await OBRStorage.getDaggerheartStatuses();
        if (vitals) {
            await TokenAttachments.create(tokenId, vitals, statuses);
        }
    };

    const handleSkullClick = (index: number) => {
        // If clicking on an already-enabled skull at the end, disable it
        if (character.skulls === index + 1) {
            setCharacter(prev => ({ ...prev, skulls: index }));
        } else {
            // Enable all skulls up to and including this one
            setCharacter(prev => ({ ...prev, skulls: index + 1 }));
        }
    };

    // Separator positions: after 3rd (index 2), 7th (index 6), 10th (index 9)
    const separatorAfter = [2, 6, 9];

    return (
        <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
            {/* Stats Grid - 2 rows of 3 */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-center gap-2">
                    {STAT_NAMES.slice(0, 3).map((stat) => (
                        <VerticalStatPill
                            key={stat.key}
                            label={stat.label}
                            value={character[stat.key as keyof DaggerheartCharacter] as number}
                            color={stat.color}
                            bgClass={stat.bg}
                            onIncrement={() => updateStat(stat.key as keyof DaggerheartCharacter, 1)}
                            onDecrement={() => updateStat(stat.key as keyof DaggerheartCharacter, -1)}
                        />
                    ))}
                </div>
                <div className="flex justify-center gap-2">
                    {STAT_NAMES.slice(3, 6).map((stat) => (
                        <VerticalStatPill
                            key={stat.key}
                            label={stat.label}
                            value={character[stat.key as keyof DaggerheartCharacter] as number}
                            color={stat.color}
                            bgClass={stat.bg}
                            onIncrement={() => updateStat(stat.key as keyof DaggerheartCharacter, 1)}
                            onDecrement={() => updateStat(stat.key as keyof DaggerheartCharacter, -1)}
                        />
                    ))}
                </div>
            </div>

            {/* Portrait + Evasion/Level Row */}
            <div className="flex items-center justify-center gap-4">
                {/* Portrait */}
                <button
                    onClick={() => setShowTokenPicker(true)}
                    className="w-32 h-32 rounded-xl border-2 border-zinc-700 hover:border-accent overflow-hidden transition-all bg-zinc-800 flex items-center justify-center"
                >
                    {tokenImage ? (
                        <img src={tokenImage} alt="Character" className="w-full h-full object-cover" />
                    ) : (
                        <Icons.User size={32} className="text-zinc-500" />
                    )}
                </button>

                {/* Evasion & Level - Larger */}
                <div className="flex gap-2">
                    <VerticalStatPill
                        label="EVA"
                        value={character.evasion}
                        color="text-emerald-400"
                        bgClass="border-emerald-500/50 bg-emerald-900/30"
                        showSign={false}
                        large={true}
                        onIncrement={() => updateStat('evasion', 1)}
                        onDecrement={() => updateStat('evasion', -1)}
                    />
                    <VerticalStatPill
                        label="LVL"
                        value={character.level}
                        color="text-yellow-400"
                        bgClass="border-yellow-500/50 bg-yellow-900/30"
                        showSign={false}
                        large={true}
                        onIncrement={() => updateStat('level', 1)}
                        onDecrement={() => updateStat('level', -1)}
                    />
                </div>
            </div>

            {/* Custom Stats Row (if any, up to 3) */}
            {customStats.length > 0 && (
                <div className="flex justify-center gap-2">
                    {customStats.slice(0, 3).map((stat, i) => (
                        <VerticalStatPill
                            key={i}
                            label={stat.name.slice(0, 3).toUpperCase()}
                            value={stat.value}
                            color="text-zinc-300"
                            bgClass="border-zinc-500/50 bg-zinc-800/50"
                            showSign={true}
                            onIncrement={() => { }}
                            onDecrement={() => { }}
                        />
                    ))}
                </div>
            )}

            {/* Damage Thresholds */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-lg bg-yellow-900/40 border border-yellow-500/50 text-yellow-400 text-sm font-bold">
                    Minor
                </div>
                <input
                    type="number"
                    value={character.minorThreshold}
                    onChange={(e) => setCharacter(prev => ({ ...prev, minorThreshold: parseInt(e.target.value) || 0 }))}
                    className="w-12 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-center text-white font-mono"
                />
                <div className="px-3 py-1.5 rounded-lg bg-orange-900/40 border border-orange-500/50 text-orange-400 text-sm font-bold">
                    Major
                </div>
                <input
                    type="number"
                    value={character.majorThreshold}
                    onChange={(e) => setCharacter(prev => ({ ...prev, majorThreshold: parseInt(e.target.value) || 0 }))}
                    className="w-12 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-center text-white font-mono"
                />
                <div className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-500/50 text-red-400 text-sm font-bold">
                    Severe
                </div>
            </div>

            {/* Skull Tracker */}
            <div className="flex items-center justify-center gap-0.5 flex-wrap">
                {Array.from({ length: 11 }).map((_, i) => (
                    <React.Fragment key={i}>
                        <button
                            onClick={() => handleSkullClick(i)}
                            className={clsx(
                                "p-1.5 rounded transition-all",
                                i < character.skulls
                                    ? "text-red-400 bg-red-900/30"
                                    : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            <Icons.Death size={20} />
                        </button>
                        {/* Separators after 3rd (i=2), 7th (i=6), 10th (i=9) */}
                        {separatorAfter.includes(i) && (
                            <div className="w-px h-6 bg-zinc-600 mx-1" />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Token Picker Modal */}
            <TokenPicker
                isOpen={showTokenPicker}
                onClose={() => setShowTokenPicker(false)}
                onSelect={handleTokenSelect}
            />
        </div>
    );
};

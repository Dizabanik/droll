import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OBRStorage, TokenAttachments, DaggerheartCharacter } from '../obr';
import { CharacterStats, GameSystem } from '../types';
import { Icons } from './ui/Icons';
import { EssenceSphere } from './EssenceSphere';
import clsx from 'clsx';
import OBR, { Image } from "@owlbear-rodeo/sdk";
import { DiceStyle } from '../dice-engine/types/DiceStyle';
import { DiceStylePicker } from './DiceStylePicker';

const DEFAULT_CHARACTER: DaggerheartCharacter = {
    agility: 0,
    strength: 0,
    finesse: 0,
    instinct: 0,
    presence: 0,
    knowledge: 0,
    evasion: 10,
    level: 1,
    thresholdMinor: 0,
    thresholdMajor: 0,
    thresholdSevere: 0,
    skulls: 0,
    essenceCurrent: 0,
    essenceMax: 0,
    essenceRank: 1,
    essenceStage: 1,
    customStats: [],
    settings: {
        showStrain: false,
        showReverendInsanity: false,
    },
};

const DH_STAT_NAMES = [
    { key: 'agility', label: 'AGI', full: 'Agility' },
    { key: 'strength', label: 'STR', full: 'Strength' },
    { key: 'finesse', label: 'FIN', full: 'Finesse' },
    { key: 'instinct', label: 'INS', full: 'Instinct' },
    { key: 'presence', label: 'PRE', full: 'Presence' },
    { key: 'knowledge', label: 'KNO', full: 'Knowledge' },
] as const;

const DND_ATTR_NAMES = [
    { key: 'str', label: 'STR', full: 'Strength' },
    { key: 'dex', label: 'DEX', full: 'Dexterity' },
    { key: 'con', label: 'CON', full: 'Constitution' },
    { key: 'int', label: 'INT', full: 'Intelligence' },
    { key: 'wis', label: 'WIS', full: 'Wisdom' },
    { key: 'cha', label: 'CHA', full: 'Charisma' },
] as const;

const DND_SKILLS_LIST = [
    { name: 'Athletics', attr: 'str' },
    { name: 'Acrobatics', attr: 'dex' },
    { name: 'Sleight of Hand', attr: 'dex' },
    { name: 'Stealth', attr: 'dex' },
    { name: 'Arcana', attr: 'int' },
    { name: 'History', attr: 'int' },
    { name: 'Investigation', attr: 'int' },
    { name: 'Nature', attr: 'int' },
    { name: 'Religion', attr: 'int' },
    { name: 'Animal Handling', attr: 'wis' },
    { name: 'Insight', attr: 'wis' },
    { name: 'Medicine', attr: 'wis' },
    { name: 'Perception', attr: 'wis' },
    { name: 'Survival', attr: 'wis' },
    { name: 'Deception', attr: 'cha' },
    { name: 'Intimidation', attr: 'cha' },
    { name: 'Performance', attr: 'cha' },
    { name: 'Persuasion', attr: 'cha' },
] as const;

// === Vertical Stat Pill Component ===
interface VerticalStatPillProps {
    label: string;
    value: number;
    subLabel?: string;
    color?: string;
    bgClass?: string;
    showSign?: boolean;
    large?: boolean;
    onIncrement: () => void;
    onDecrement: () => void;
    onValueClick?: () => void;
}

const VerticalStatPill: React.FC<VerticalStatPillProps> = ({
    label,
    value,
    subLabel,
    color = "text-white",
    showSign = true,
    large = false,
    onIncrement,
    onDecrement,
    onValueClick,
}) => {
    const displayValue = showSign ? (value >= 0 ? `+${value}` : `${value}`) : `${value}`;

    return (
        <div className={clsx(
            "flex flex-col items-center rounded-2xl border border-neutral-800 bg-surface/60 overflow-hidden shadow-fey-subtle hover:border-neutral-700 transition-all",
            large ? "w-20" : "w-14"
        )}>
            {/* Increment Button */}
            <button
                onClick={onIncrement}
                className="w-full py-1 text-muted hover:text-white hover:bg-white/5 font-bold text-sm transition-all active:scale-95 flex items-center justify-center"
            >
                +
            </button>

            {/* Value & Label - Clickable for rolls */}
            <button
                onClick={onValueClick}
                disabled={!onValueClick}
                className={clsx(
                    "flex flex-col items-center justify-center bg-elevated/90 w-full transition-all border-y border-neutral-800/80",
                    large ? "py-2.5" : "py-1.5",
                    onValueClick && "hover:bg-neutral-800/70 cursor-pointer"
                )}
            >
                <span className={clsx("font-mono font-bold tracking-tight", color, large ? "text-xl" : "text-lg")}>
                    {displayValue}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest text-muted font-mono mt-0.5">
                    {label}
                </span>
                {subLabel && (
                    <span className="text-[8px] text-muted/60 font-mono">
                        {subLabel}
                    </span>
                )}
            </button>

            {/* Decrement Button */}
            <button
                onClick={onDecrement}
                className="w-full py-1 text-muted hover:text-white hover:bg-white/5 font-bold text-sm transition-all active:scale-95 flex items-center justify-center"
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface rounded-2xl border border-neutral-800 p-5 max-w-md w-full max-h-[70vh] overflow-y-auto shadow-fey-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
                    <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                        <Icons.Target size={16} className="text-white" />
                        Select Token
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors">
                        <Icons.Close size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                    {tokens.map((token) => (
                        <button
                            key={token.id}
                            onClick={() => { onSelect(token.id, token.imageUrl); onClose(); }}
                            className="aspect-square rounded-xl overflow-hidden border border-neutral-800 hover:border-white transition-all shadow-fey-subtle"
                        >
                            <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
                {tokens.length === 0 && (
                    <p className="text-muted text-xs font-mono text-center py-6">No character tokens found in current scene.</p>
                )}
            </motion.div>
        </motion.div>
    );
};

// === Settings Modal ===
interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeSystem: GameSystem;
    onSelectSystem: (system: GameSystem) => void;
    settings: DaggerheartCharacter['settings'];
    onToggle: (key: keyof DaggerheartCharacter['settings']) => void;
    diceStyle: DiceStyle;
    onSelectDiceStyle: (style: DiceStyle) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    activeSystem,
    onSelectSystem,
    settings,
    onToggle,
    diceStyle,
    onSelectDiceStyle,
}) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface rounded-2xl border border-neutral-800 p-6 max-w-lg w-full shadow-fey-xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-neutral-800">
                    <h3 className="text-white font-bold text-base tracking-tight flex items-center gap-2.5">
                        <Icons.Settings size={18} className="text-white" />
                        Settings & Preferences
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors">
                        <Icons.Close size={18} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Game System Selection */}
                    <div className="p-3.5 bg-elevated/70 rounded-2xl border border-neutral-800 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white">Active System</span>
                            <span className="text-[11px] text-muted">Switch character sheet attributes & roll style</span>
                        </div>
                        <div className="flex items-center bg-surface border border-neutral-800 rounded-full p-0.5 shadow-inner">
                            <button
                                onClick={() => onSelectSystem('daggerheart')}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                    activeSystem === 'daggerheart'
                                        ? "bg-white text-black font-bold shadow-fey-subtle"
                                        : "text-muted hover:text-white"
                                )}
                            >
                                Daggerheart
                            </button>
                            <button
                                onClick={() => onSelectSystem('dnd5e')}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                                    activeSystem === 'dnd5e'
                                        ? "bg-signal text-white font-bold shadow-fey-signal"
                                        : "text-muted hover:text-white"
                                )}
                            >
                                D&D 5e
                            </button>
                        </div>
                    </div>

                    {/* 3D Dice Skin Picker */}
                    <div className="p-4 bg-elevated/70 rounded-2xl border border-neutral-800 shadow-inner">
                        <DiceStylePicker
                            currentStyle={diceStyle}
                            onSelect={onSelectDiceStyle}
                        />
                    </div>

                    {/* Sheet Toggles */}
                    <div className="space-y-2.5">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted font-mono px-1">Optional Features</h4>

                        {/* Strain Tracker Toggle */}
                        <div className="flex items-center justify-between p-3.5 bg-elevated/60 rounded-xl border border-neutral-800">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-white">Strain Tracker</span>
                                <span className="text-[11px] text-muted">Show the 11-skull damage strain tracker</span>
                            </div>
                            <button
                                onClick={() => onToggle('showStrain')}
                                className={clsx(
                                    "w-10 h-5 rounded-full relative transition-colors border border-neutral-700",
                                    settings.showStrain ? "bg-white" : "bg-neutral-800"
                                )}
                            >
                                <div className={clsx(
                                    "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform",
                                    settings.showStrain ? "left-5 bg-black" : "left-0.5 bg-muted"
                                )} />
                            </button>
                        </div>

                        {/* Reverend Insanity Mode Toggle */}
                        <div className="flex items-center justify-between p-3.5 bg-elevated/60 rounded-xl border border-neutral-800">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-white">Reverend Insanity Mode</span>
                                <span className="text-[11px] text-muted">Enable Primeval Essence sphere & cultivation resources</span>
                            </div>
                            <button
                                onClick={() => onToggle('showReverendInsanity')}
                                className={clsx(
                                    "w-10 h-5 rounded-full relative transition-colors border border-neutral-700",
                                    settings.showReverendInsanity ? "bg-signal" : "bg-neutral-800"
                                )}
                            >
                                <div className={clsx(
                                    "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform",
                                    settings.showReverendInsanity ? "left-5 bg-white" : "left-0.5 bg-muted"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-3 border-t border-neutral-800 text-center text-[10px] font-mono text-muted">
                    Preferences are saved automatically to your profile.
                </div>
            </motion.div>
        </motion.div>
    );
};

// === Main Character Panel ===
interface CharacterPanelProps {
    onRoll?: (statKey: string, statValue: number, isDndCheck?: boolean) => void;
    showSettings?: boolean;
    onCloseSettings?: () => void;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({
    onRoll,
    showSettings = false,
    onCloseSettings
}) => {
    const [character, setCharacter] = useState<DaggerheartCharacter>(DEFAULT_CHARACTER);
    const [activeSystem, setActiveSystem] = useState<GameSystem>('daggerheart');
    const [daggerheartStats, setDaggerheartStats] = useState<Record<string, number>>({});
    const [dndAttributes, setDndAttributes] = useState<Record<string, number>>({
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
    });
    const [dndSkills, setDndSkills] = useState<Record<string, number>>({});
    const [customStats, setCustomStats] = useState<Array<{ id: string; name: string; value: number }>>([]);
    const [tokenImage, setTokenImage] = useState<string | null>(null);
    const [showTokenPicker, setShowTokenPicker] = useState(false);
    const [localShowSettings, setLocalShowSettings] = useState(false);
    const [diceStyle, setDiceStyle] = useState<DiceStyle>('GEMSTONE');
    const [isLoaded, setIsLoaded] = useState(false);

    const isSettingsOpen = showSettings || localShowSettings;

    const handleCloseSettings = () => {
        setLocalShowSettings(false);
        onCloseSettings?.();
    };

    const handleDiceStyleChange = async (style: DiceStyle) => {
        setDiceStyle(style);
        await OBRStorage.setDiceStyle(style);
    };

    const handleSystemChange = async (system: GameSystem) => {
        setActiveSystem(system);
        const currentStats = await OBRStorage.getStats();
        if (currentStats) {
            await OBRStorage.setStats({
                ...currentStats,
                activeSystem: system,
            });
        }
    };

    // Load character data and sync with CharacterStats
    useEffect(() => {
        const load = async () => {
            try {
                const saved = await OBRStorage.getDaggerheartCharacter();
                if (saved) {
                    setCharacter({
                        ...DEFAULT_CHARACTER,
                        ...saved,
                        settings: {
                            ...DEFAULT_CHARACTER.settings,
                            ...(saved.settings || {}),
                        },
                    });
                }

                const stats = await OBRStorage.getStats();
                if (stats) {
                    setActiveSystem(stats.activeSystem || 'daggerheart');
                    setDaggerheartStats(stats.daggerheartStats || {});
                    setDndAttributes(stats.dndAttributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
                    setDndSkills(stats.dndSkills || {});
                    setCustomStats(stats.customStats || []);
                }

                const savedStyle = await OBRStorage.getDiceStyle();
                if (savedStyle) setDiceStyle(savedStyle);

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

        const handleStorageChange = async () => {
            const stats = await OBRStorage.getStats();
            if (stats) {
                setActiveSystem(stats.activeSystem || 'daggerheart');
                setDaggerheartStats(stats.daggerheartStats || {});
                setDndAttributes(stats.dndAttributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
                setDndSkills(stats.dndSkills || {});
                setCustomStats(stats.customStats || []);
            }
            const savedStyle = await OBRStorage.getDiceStyle();
            if (savedStyle) setDiceStyle(savedStyle);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Save character on change
    useEffect(() => {
        if (!isLoaded) return;
        OBRStorage.setDaggerheartCharacter(character);
    }, [character, isLoaded]);

    const updateDaggerheartStat = async (key: string, delta: number) => {
        const newValue = (daggerheartStats[key] || 0) + delta;
        setDaggerheartStats(prev => ({ ...prev, [key]: newValue }));

        const stats = await OBRStorage.getStats();
        if (stats) {
            await OBRStorage.setStats({
                ...stats,
                daggerheartStats: { ...stats.daggerheartStats, [key]: newValue }
            });
        }
    };

    const updateDndAttr = async (key: string, delta: number) => {
        const currentScore = dndAttributes[key] ?? 10;
        const newScore = Math.max(1, currentScore + delta);
        const updated = { ...dndAttributes, [key]: newScore };
        setDndAttributes(updated);

        const stats = await OBRStorage.getStats();
        if (stats) {
            await OBRStorage.setStats({
                ...stats,
                dndAttributes: { ...stats.dndAttributes, [key]: newScore }
            });
        }
    };

    const toggleDndSkillProficiency = async (skillName: string) => {
        const current = dndSkills[skillName] ?? 0;
        const newProf = current > 0 ? 0 : 1;
        const updated = { ...dndSkills, [skillName]: newProf };
        setDndSkills(updated);

        const stats = await OBRStorage.getStats();
        if (stats) {
            await OBRStorage.setStats({
                ...stats,
                dndSkills: updated
            });
        }
    };

    const updateCharacter = (updates: Partial<DaggerheartCharacter>) => {
        const newChar = { ...character, ...updates };
        setCharacter(newChar);
        OBRStorage.setDaggerheartCharacter(newChar);
    };

    const updateCharacterStat = (key: keyof DaggerheartCharacter, delta: number) => {
        setCharacter(prev => ({
            ...prev,
            [key]: typeof prev[key] === 'number' ? (prev[key] as number) + delta : prev[key],
        }));
    };

    const handleStatRoll = (statKey: string, statValue: number, isDndCheck?: boolean) => {
        if (onRoll) {
            onRoll(statKey, statValue, isDndCheck !== undefined ? isDndCheck : (activeSystem === 'dnd5e'));
        }
    };

    const updateCustomStat = async (statId: string, delta: number) => {
        const updated = customStats.map(s =>
            s.id === statId ? { ...s, value: s.value + delta } : s
        );
        setCustomStats(updated);

        const stats = await OBRStorage.getStats();
        if (stats) {
            await OBRStorage.setStats({
                ...stats,
                customStats: updated
            });
        }
    };

    const handleTokenSelect = async (tokenId: string, imageUrl: string) => {
        const oldTokenId = await OBRStorage.getSelectedTokenId();
        if (oldTokenId && oldTokenId !== tokenId) {
            await TokenAttachments.delete(oldTokenId);
        }

        await OBRStorage.setSelectedTokenId(tokenId);
        setTokenImage(imageUrl);

        const vitals = await OBRStorage.getDaggerheartVitals();
        const statuses = await OBRStorage.getDaggerheartStatuses();
        if (vitals) {
            await TokenAttachments.create(tokenId, vitals, statuses);
        }
    };

    const handleSkullClick = (index: number) => {
        if (character.skulls === index + 1) {
            setCharacter(prev => ({ ...prev, skulls: index }));
        } else {
            setCharacter(prev => ({ ...prev, skulls: index + 1 }));
        }
    };

    const toggleSetting = (key: keyof DaggerheartCharacter['settings']) => {
        const newSettings = { ...character.settings, [key]: !character.settings[key] };
        updateCharacter({ settings: newSettings });
    };

    const profBonus = useMemo(() => {
        return Math.floor((character.level - 1) / 4) + 2;
    }, [character.level]);

    const separatorAfter = [2, 6, 9];

    return (
        <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto relative select-none">
            {/* System Switch Indicator Header */}
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase font-bold text-muted font-mono tracking-wider">
                    {activeSystem === 'dnd5e' ? 'D&D 5e Character Sheet' : 'Daggerheart Character Sheet'}
                </span>
                <button
                    onClick={() => handleSystemChange(activeSystem === 'dnd5e' ? 'daggerheart' : 'dnd5e')}
                    className="text-[10px] font-mono text-signal hover:underline"
                >
                    Switch to {activeSystem === 'dnd5e' ? 'Daggerheart' : 'D&D 5e'}
                </button>
            </div>

            {/* D&D 5E STATS VIEW */}
            {activeSystem === 'dnd5e' ? (
                <>
                    {/* DND Attributes Grid - 2 rows of 3 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-center gap-2">
                            {DND_ATTR_NAMES.slice(0, 3).map((attr) => {
                                const score = dndAttributes[attr.key] ?? 10;
                                const mod = Math.floor((score - 10) / 2);
                                return (
                                    <VerticalStatPill
                                        key={attr.key}
                                        label={attr.label}
                                        subLabel={`${score}`}
                                        value={mod}
                                        color="text-white"
                                        onIncrement={() => updateDndAttr(attr.key, 1)}
                                        onDecrement={() => updateDndAttr(attr.key, -1)}
                                        onValueClick={() => handleStatRoll(`${attr.full} Check`, mod, true)}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-2">
                            {DND_ATTR_NAMES.slice(3, 6).map((attr) => {
                                const score = dndAttributes[attr.key] ?? 10;
                                const mod = Math.floor((score - 10) / 2);
                                return (
                                    <VerticalStatPill
                                        key={attr.key}
                                        label={attr.label}
                                        subLabel={`${score}`}
                                        value={mod}
                                        color="text-white"
                                        onIncrement={() => updateDndAttr(attr.key, 1)}
                                        onDecrement={() => updateDndAttr(attr.key, -1)}
                                        onValueClick={() => handleStatRoll(`${attr.full} Check`, mod, true)}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Portrait + Proficiency / Level Row */}
                    <div className="flex items-center justify-center gap-4 my-1">
                        {/* Portrait */}
                        <button
                            onClick={() => setShowTokenPicker(true)}
                            className="w-28 h-28 rounded-2xl border border-neutral-800 hover:border-neutral-600 overflow-hidden transition-all bg-surface flex items-center justify-center shadow-fey-subtle group"
                        >
                            {tokenImage ? (
                                <img src={tokenImage} alt="Character" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted group-hover:text-white transition-colors">
                                    <Icons.User size={28} />
                                    <span className="text-[10px] font-mono">Token</span>
                                </div>
                            )}
                        </button>

                        {/* Prof Bonus & Level */}
                        <div className="flex gap-2.5">
                            <VerticalStatPill
                                label="PROF"
                                value={profBonus}
                                color="text-growth"
                                showSign={true}
                                large={true}
                                onIncrement={() => {}}
                                onDecrement={() => {}}
                            />
                            <VerticalStatPill
                                label="LVL"
                                value={character.level}
                                color="text-signal"
                                showSign={false}
                                large={true}
                                onIncrement={() => updateCharacter({ level: character.level + 1 })}
                                onDecrement={() => updateCharacter({ level: Math.max(1, character.level - 1) })}
                            />
                        </div>
                    </div>

                    {/* DND 5e Skills List */}
                    <div className="bg-surface/50 border border-neutral-800 rounded-2xl p-3 space-y-2 shadow-fey-subtle">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] uppercase font-bold text-muted font-mono tracking-wider">Skill Proficiencies & Checks</span>
                            <span className="text-[10px] text-muted font-mono">Click circle to toggle proficiency</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {DND_SKILLS_LIST.map((skill) => {
                                const attrMod = Math.floor(((dndAttributes[skill.attr] ?? 10) - 10) / 2);
                                const isProf = (dndSkills[skill.name] ?? 0) > 0;
                                const skillBonus = attrMod + (isProf ? profBonus : 0);
                                const displayBonus = skillBonus >= 0 ? `+${skillBonus}` : `${skillBonus}`;

                                return (
                                    <div
                                        key={skill.name}
                                        className={clsx(
                                            "flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all",
                                            isProf
                                                ? "bg-elevated/90 border-signal/40 text-white shadow-fey-subtle"
                                                : "bg-surface/40 border-neutral-800/80 text-muted hover:border-neutral-700"
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <button
                                                onClick={() => toggleDndSkillProficiency(skill.name)}
                                                className={clsx(
                                                    "w-2.5 h-2.5 rounded-full border transition-all flex-shrink-0",
                                                    isProf ? "bg-signal border-signal shadow-fey-glow" : "bg-neutral-800 border-neutral-600 hover:border-neutral-400"
                                                )}
                                                title={isProf ? "Proficient" : "Not Proficient"}
                                            />
                                            <button
                                                onClick={() => handleStatRoll(`${skill.name} Check`, skillBonus, true)}
                                                className="text-left font-medium truncate hover:text-white transition-colors"
                                                title={`Roll ${skill.name} (1d20 ${displayBonus})`}
                                            >
                                                {skill.name}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleStatRoll(`${skill.name} Check`, skillBonus, true)}
                                            className={clsx(
                                                "font-mono font-bold text-xs ml-1 flex-shrink-0 px-1.5 py-0.5 rounded bg-surface/80 border border-neutral-800",
                                                isProf ? "text-signal" : "text-muted hover:text-white"
                                            )}
                                            title={`Roll ${skill.name} (1d20 ${displayBonus})`}
                                        >
                                            {displayBonus}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                /* DAGGERHEART STATS VIEW */
                <>
                    {/* Daggerheart Stats Grid - 2 rows of 3 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-center gap-2">
                            {DH_STAT_NAMES.slice(0, 3).map((stat) => (
                                <VerticalStatPill
                                    key={stat.key}
                                    label={stat.label}
                                    value={daggerheartStats[stat.key] || 0}
                                    color="text-white"
                                    onIncrement={() => updateDaggerheartStat(stat.key, 1)}
                                    onDecrement={() => updateDaggerheartStat(stat.key, -1)}
                                    onValueClick={() => handleStatRoll(`${stat.full} Check`, daggerheartStats[stat.key] || 0, false)}
                                />
                            ))}
                        </div>
                        <div className="flex justify-center gap-2">
                            {DH_STAT_NAMES.slice(3, 6).map((stat) => (
                                <VerticalStatPill
                                    key={stat.key}
                                    label={stat.label}
                                    value={daggerheartStats[stat.key] || 0}
                                    color="text-white"
                                    onIncrement={() => updateDaggerheartStat(stat.key, 1)}
                                    onDecrement={() => updateDaggerheartStat(stat.key, -1)}
                                    onValueClick={() => handleStatRoll(`${stat.full} Check`, daggerheartStats[stat.key] || 0, false)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Portrait + Evasion/Level Row */}
                    <div className="flex items-center justify-center gap-4 my-1">
                        {/* Portrait */}
                        <button
                            onClick={() => setShowTokenPicker(true)}
                            className="w-28 h-28 rounded-2xl border border-neutral-800 hover:border-neutral-600 overflow-hidden transition-all bg-surface flex items-center justify-center shadow-fey-subtle group"
                        >
                            {tokenImage ? (
                                <img src={tokenImage} alt="Character" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted group-hover:text-white transition-colors">
                                    <Icons.User size={28} />
                                    <span className="text-[10px] font-mono">Token</span>
                                </div>
                            )}
                        </button>

                        {/* Evasion & Level */}
                        <div className="flex gap-2.5">
                            <VerticalStatPill
                                label="EVA"
                                value={character.evasion}
                                color="text-growth"
                                showSign={false}
                                large={true}
                                onIncrement={() => updateCharacterStat('evasion', 1)}
                                onDecrement={() => updateCharacterStat('evasion', -1)}
                            />
                            <VerticalStatPill
                                label="LVL"
                                value={character.level}
                                color="text-signal"
                                showSign={false}
                                large={true}
                                onIncrement={() => updateCharacter({ level: character.level + 1 })}
                                onDecrement={() => updateCharacter({ level: Math.max(1, character.level - 1) })}
                            />
                        </div>
                    </div>

                    {/* Damage Thresholds */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div className="flex items-center bg-surface border border-neutral-800 rounded-full p-1 shadow-fey-subtle">
                            <span className="px-2.5 text-[10px] font-bold text-mist uppercase font-mono">Minor</span>
                            <input
                                type="number"
                                value={character.thresholdMinor}
                                onChange={(e) => setCharacter(prev => ({ ...prev, thresholdMinor: parseInt(e.target.value) || 0 }))}
                                className="w-10 py-0.5 bg-elevated border border-neutral-800 rounded-full text-center text-white text-xs font-mono font-bold focus:outline-none focus:border-white/50"
                            />
                        </div>
                        <div className="flex items-center bg-surface border border-neutral-800 rounded-full p-1 shadow-fey-subtle">
                            <span className="px-2.5 text-[10px] font-bold text-ember uppercase font-mono">Major</span>
                            <input
                                type="number"
                                value={character.thresholdMajor}
                                onChange={(e) => setCharacter(prev => ({ ...prev, thresholdMajor: parseInt(e.target.value) || 0 }))}
                                className="w-10 py-0.5 bg-elevated border border-neutral-800 rounded-full text-center text-white text-xs font-mono font-bold focus:outline-none focus:border-white/50"
                            />
                        </div>
                        <div className="flex items-center bg-surface border border-neutral-800 rounded-full p-1 shadow-fey-subtle">
                            <span className="px-2.5 text-[10px] font-bold text-rose-400 uppercase font-mono">Severe</span>
                            <input
                                type="number"
                                value={character.thresholdSevere}
                                onChange={(e) => setCharacter(prev => ({ ...prev, thresholdSevere: parseInt(e.target.value) || 0 }))}
                                className="w-10 py-0.5 bg-elevated border border-neutral-800 rounded-full text-center text-white text-xs font-mono font-bold focus:outline-none focus:border-white/50"
                            />
                        </div>
                    </div>

                    {/* Skull Tracker (Conditional Mode) */}
                    {character.settings.showStrain && (
                        <div className="flex items-center justify-center gap-1 flex-wrap bg-surface/40 p-2 rounded-2xl border border-neutral-800/80">
                            {Array.from({ length: 11 }).map((_, i) => (
                                <React.Fragment key={i}>
                                    <button
                                        onClick={() => handleSkullClick(i)}
                                        className={clsx(
                                            "p-1.5 rounded-lg transition-all",
                                            i < character.skulls
                                                ? "text-ember bg-ember/15 shadow-fey-ember"
                                                : "text-neutral-700 hover:text-muted"
                                        )}
                                    >
                                        <Icons.Death size={18} />
                                    </button>
                                    {separatorAfter.includes(i) && (
                                        <div className="w-px h-5 bg-neutral-800 mx-0.5" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Essence Sphere (Conditional Mode for both systems if enabled) */}
            {character.settings.showReverendInsanity && (
                <div className="mx-auto my-2">
                    <EssenceSphere
                        current={character.essenceCurrent}
                        max={character.essenceMax}
                        rank={character.essenceRank}
                        stage={character.essenceStage}
                        onChange={(updates) => {
                            const charUpdates: Partial<DaggerheartCharacter> = {};
                            if (updates.current !== undefined) charUpdates.essenceCurrent = updates.current;
                            if (updates.max !== undefined) charUpdates.essenceMax = updates.max;
                            if (updates.rank !== undefined) charUpdates.essenceRank = updates.rank;
                            if (updates.stage !== undefined) charUpdates.essenceStage = updates.stage;
                            updateCharacter(charUpdates);
                        }}
                    />
                </div>
            )}

            {/* Custom Stats Row (if any) */}
            {customStats.length > 0 && (
                <div className="flex justify-center gap-2">
                    {customStats.slice(0, 3).map((stat) => (
                        <VerticalStatPill
                            key={stat.id}
                            label={stat.name.slice(0, 3).toUpperCase()}
                            value={stat.value}
                            color="text-white"
                            showSign={true}
                            onIncrement={() => updateCustomStat(stat.id, 1)}
                            onDecrement={() => updateCustomStat(stat.id, -1)}
                            onValueClick={() => handleStatRoll(stat.name, stat.value)}
                        />
                    ))}
                </div>
            )}

            {/* Token Picker Modal */}
            <TokenPicker
                isOpen={showTokenPicker}
                onClose={() => setShowTokenPicker(false)}
                onSelect={handleTokenSelect}
            />

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={handleCloseSettings}
                activeSystem={activeSystem}
                onSelectSystem={handleSystemChange}
                settings={character.settings}
                onToggle={toggleSetting}
                diceStyle={diceStyle}
                onSelectDiceStyle={handleDiceStyleChange}
            />
        </div>
    );
};

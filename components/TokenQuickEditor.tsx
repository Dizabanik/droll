import React, { useState, useEffect, useCallback } from 'react';
import OBR, { Image, isImage } from '@owlbear-rodeo/sdk';
import {
    TokenTrackerData,
    getTokenTrackerData,
    setTokenTrackerData,
    removeTokenTrackerData,
} from '../obr/tokenAttachments';
import { DaggerheartStatuses } from '../obr/storage';
import { useOBR } from '../obr';
import clsx from 'clsx';

// === Bubbles-Exact SVG Icons ===
const BookLock = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H10" />
        <path d="M20 15v4.5a2.5 2.5 0 0 1-2.5 2.5H6.5a2.5 2.5 0 0 1-2.5-2.5V19.5" />
        <rect width="8" height="5" x="14" y="7" rx="1" />
        <path d="M16 7V5a2 2 0 1 1 4 0v2" />
    </svg>
);

const BookOpen = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

const MagicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3L11 23l8-8Z" />
        <path d="m5 2 5 5" />
        <path d="m2 5 5 5" />
    </svg>
);

const STATUS_OPTIONS: { key: keyof DaggerheartStatuses; label: string; abbr: string; color: string; bg: string }[] = [
    { key: 'vulnerable', label: 'Vulnerable', abbr: 'VUL', color: 'text-red-400', bg: 'bg-red-950/60 border-red-800/80' },
    { key: 'blinded', label: 'Blinded', abbr: 'BLN', color: 'text-purple-400', bg: 'bg-purple-950/60 border-purple-800/80' },
    { key: 'frightened', label: 'Frightened', abbr: 'FRT', color: 'text-yellow-400', bg: 'bg-yellow-950/60 border-yellow-800/80' },
    { key: 'hidden', label: 'Hidden', abbr: 'HID', color: 'text-slate-400', bg: 'bg-slate-900/60 border-slate-700/80' },
    { key: 'restrained', label: 'Restrained', abbr: 'RST', color: 'text-orange-400', bg: 'bg-orange-950/60 border-orange-800/80' },
    { key: 'slowed', label: 'Slowed', abbr: 'SLW', color: 'text-blue-400', bg: 'bg-blue-950/60 border-blue-800/80' },
    { key: 'weakened', label: 'Weakened', abbr: 'WKN', color: 'text-pink-400', bg: 'bg-pink-950/60 border-pink-800/80' },
    { key: 'empowered', label: 'Empowered', abbr: 'EMP', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800/80' },
];

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

// Math calculation helper from Bubbles
function parseInlineMath(inputContent: string, previousValue: number): number {
    const trimmed = inputContent.trim();
    if (!trimmed) return previousValue;
    const newValue = parseFloat(trimmed);
    if (Number.isNaN(newValue)) return previousValue;
    if (trimmed.startsWith("+") || trimmed.startsWith("-")) {
        return Math.trunc(previousValue + Math.trunc(newValue));
    }
    return newValue;
}

// PartiallyControlledInput from Bubbles
interface PartiallyControlledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    parentValue: string;
    onUserConfirm: (val: string) => void;
}

function PartiallyControlledInput({
    parentValue,
    onUserConfirm,
    className,
    ...inputProps
}: PartiallyControlledInputProps): JSX.Element {
    const [inputContent, setInputContent] = useState<string>(parentValue);

    useEffect(() => {
        setInputContent(parentValue);
    }, [parentValue]);

    const resetInputContent = () => setInputContent(parentValue);

    return (
        <input
            {...inputProps}
            value={inputContent}
            onChange={(e) => {
                if (inputProps.onChange) inputProps.onChange(e);
                setInputContent(e.target.value);
            }}
            onBlur={(e) => {
                if (inputProps.onBlur) inputProps.onBlur(e);
                if (inputContent === "") {
                    resetInputContent();
                } else {
                    onUserConfirm(inputContent);
                }
            }}
            onKeyDown={(e) => {
                if (inputProps.onKeyDown) inputProps.onKeyDown(e);
                if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                    onUserConfirm(inputContent);
                } else if (e.key === "Escape") {
                    (e.target as HTMLInputElement).blur();
                    resetInputContent();
                }
            }}
            onFocus={(e) => {
                if (inputProps.onFocus) inputProps.onFocus(e);
                setInputContent("");
            }}
            className={className}
            placeholder=""
            autoComplete="off"
        />
    );
}

// Curved SVG Text Ring from Bubbles
const TextRing = ({
    topText,
    bottomText,
    letterSpacing = 0.8,
}: {
    topText: string;
    bottomText: string;
    letterSpacing?: number;
}): JSX.Element => {
    const radius = 19;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible text-[7px] font-bold tracking-wider select-none pointer-events-none fill-muted/70"
            width="46"
            height="46"
            viewBox="-23 -23 46 46"
        >
            <path
                id={`topCirclePath-${topText}`}
                d={`M ${-radius} 0 A ${radius} ${radius} 0 0,1 ${radius},0`}
                fill="none"
            />
            <path
                id={`bottomCirclePath-${bottomText}`}
                d={`M ${-radius} 0 A ${radius} ${radius} 0 0,0 ${radius},0`}
                fill="none"
            />
            <text>
                <textPath
                    href={`#topCirclePath-${topText}`}
                    startOffset="50%"
                    dominantBaseline="central"
                    textAnchor="middle"
                    letterSpacing={letterSpacing}
                >
                    {topText}
                </textPath>
            </text>
            <text>
                <textPath
                    href={`#bottomCirclePath-${bottomText}`}
                    startOffset="50%"
                    dominantBaseline="central"
                    textAnchor="middle"
                    letterSpacing={letterSpacing}
                >
                    {bottomText}
                </textPath>
            </text>
        </svg>
    );
};

// Left and Right Cutout SVGs from Bubbles
function LeftCutoutBackground() {
    return (
        <svg className="w-full h-full" viewBox="0 0 100 40">
            <path
                d="M 44 20 l 0 -10 a 10 10 -90 0 0 -10 -10 l 56 0 a 10 10 90 0 1 10 10 l 0 20 a 10 10 90 0 1 -10 10 l -56 0 a 10 10 -90 0 0 10 -10 l 0 -10"
                fill="rgba(220, 38, 38, 0.2)"
            />
        </svg>
    );
}

function RightCutoutBackground() {
    return (
        <svg className="w-full h-full" viewBox="0 0 100 40">
            <path
                d="M 56 20 l 0 -10 a 10 10 -90 0 1 10 -10 l -56 0 a 10 10 90 0 0 -10 10 l 0 20 a 10 10 90 0 0 10 10 l 56 0 a 10 10 -90 0 1 -10 -10 l 0 -10"
                fill="rgba(220, 38, 38, 0.2)"
            />
        </svg>
    );
}

// === MAIN QUICK STATS EDITOR ===
export const TokenQuickEditor: React.FC = () => {
    const { ready, isOBR, role } = useOBR();
    const [token, setToken] = useState<Image | null>(null);
    const [sceneTokens, setSceneTokens] = useState<Image[]>([]);
    const [tokenName, setTokenName] = useState<string>('');
    const [tracker, setTracker] = useState<TokenTrackerData>({
        hp: 10,
        hpMax: 10,
        stress: 0,
        armor: 0,
        hope: 0,
        showHp: false,
        hideStats: false,
        statuses: DEFAULT_STATUSES,
    });
    const [valueHasFocus, setValueHasFocus] = useState(false);
    const [maxHasFocus, setMaxHasFocus] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const selectToken = useCallback((target: Image) => {
        setToken(target);
        setTokenName(target.name || '');
        const existing = getTokenTrackerData(target);
        if (existing) {
            setTracker({
                hp: existing.hp ?? 10,
                hpMax: existing.hpMax ?? 10,
                stress: existing.stress ?? 0,
                armor: existing.armor ?? 0,
                hope: existing.hope ?? 0,
                showHp: existing.showHp ?? false,
                hideStats: existing.hideStats ?? false,
                statuses: existing.statuses || DEFAULT_STATUSES,
            });
        } else {
            setTracker({
                hp: 10,
                hpMax: 10,
                stress: 0,
                armor: 0,
                hope: 0,
                showHp: false,
                hideStats: false,
                statuses: DEFAULT_STATUSES,
            });
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        let isMounted = true;
        let unsubSelection: (() => void) | undefined;
        let unsubItems: (() => void) | undefined;

        const load = async () => {
            try {
                const allCharacterItems = (await OBR.scene.items.getItems(
                    (i) => isImage(i) && (i.layer === 'CHARACTER' || i.layer === 'MOUNT')
                )) as Image[];

                if (isMounted) {
                    setSceneTokens(allCharacterItems);
                }

                let selection = await OBR.player.getSelection();
                if (!selection || selection.length === 0) {
                    await new Promise(r => setTimeout(r, 100));
                    selection = await OBR.player.getSelection();
                }

                let targetItem: Image | undefined;
                if (selection && selection.length > 0) {
                    const selectedItems = await OBR.scene.items.getItems(selection);
                    targetItem = selectedItems.find((i) => isImage(i)) as Image | undefined;
                }

                if (!targetItem && allCharacterItems.length === 1) {
                    targetItem = allCharacterItems[0];
                }

                if (targetItem && isMounted) {
                    selectToken(targetItem);
                }
            } catch (e) {
                console.error("Error loading selected token in quick editor:", e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        load();

        if (isOBR) {
            unsubSelection = OBR.player.onChange(async () => {
                try {
                    const selection = await OBR.player.getSelection();
                    if (selection && selection.length > 0) {
                        const items = await OBR.scene.items.getItems(selection);
                        const valid = items.find((i) => isImage(i)) as Image | undefined;
                        if (valid && isMounted) {
                            selectToken(valid);
                        }
                    }
                } catch (err) {
                    console.error("Selection update error:", err);
                }
            });

            unsubItems = OBR.scene.items.onChange(async (items) => {
                if (!isMounted) return;
                const characterItems = items.filter(
                    (i) => isImage(i) && (i.layer === 'CHARACTER' || i.layer === 'MOUNT')
                ) as Image[];
                setSceneTokens(characterItems);

                if (token) {
                    const currentUpdated = characterItems.find(i => i.id === token.id);
                    if (currentUpdated) {
                        const existing = getTokenTrackerData(currentUpdated);
                        if (existing) {
                            setTracker({
                                hp: existing.hp ?? 10,
                                hpMax: existing.hpMax ?? 10,
                                stress: existing.stress ?? 0,
                                armor: existing.armor ?? 0,
                                hope: existing.hope ?? 0,
                                showHp: existing.showHp ?? false,
                                hideStats: existing.hideStats ?? false,
                                statuses: existing.statuses || DEFAULT_STATUSES,
                            });
                        }
                    }
                }
            });
        }

        return () => {
            isMounted = false;
            unsubSelection?.();
            unsubItems?.();
        };
    }, [ready, isOBR, selectToken, token?.id]);

    const handleUpdateHp = async (rawInput: string) => {
        const newHp = Math.max(0, parseInlineMath(rawInput, tracker.hp));
        const updated = { ...tracker, hp: newHp };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleUpdateMaxHp = async (rawInput: string) => {
        const newMax = Math.max(1, parseInlineMath(rawInput, tracker.hpMax));
        const updated = { ...tracker, hpMax: newMax };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleUpdateStat = async (stat: 'armor' | 'stress' | 'hope', rawInput: string) => {
        const current = tracker[stat] ?? 0;
        const newVal = Math.max(0, parseInlineMath(rawInput, current));
        const updated = { ...tracker, [stat]: newVal };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleToggleStatus = async (statusKey: keyof DaggerheartStatuses) => {
        const baseStatuses: DaggerheartStatuses = tracker.statuses || DEFAULT_STATUSES;
        const updatedStatuses: DaggerheartStatuses = {
            ...baseStatuses,
            [statusKey]: !baseStatuses[statusKey],
        };
        const updated: TokenTrackerData = {
            ...tracker,
            statuses: updatedStatuses,
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleToggleShowHp = async () => {
        const updated = {
            ...tracker,
            showHp: !tracker.showHp,
        };
        setTracker(updated);
        if (token) {
            await setTokenTrackerData(token.id, updated);
        }
    };

    const handleNameChange = async (newName: string) => {
        setTokenName(newName);
        if (token && newName.trim() !== "") {
            await OBR.scene.items.updateItems([token.id], (items) => {
                for (const item of items) {
                    item.name = newName;
                }
            });
        }
    };

    const handleRemoveTracker = async () => {
        if (token) {
            await removeTokenTrackerData(token.id);
            setTracker({
                hp: 10,
                hpMax: 10,
                stress: 0,
                armor: 0,
                hope: 0,
                showHp: false,
                hideStats: false,
                statuses: DEFAULT_STATUSES,
            });
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background text-muted select-none">
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
        );
    }

    if (!token) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-background text-muted text-center select-none overflow-y-auto">
                <p className="text-xs font-mono font-bold text-white mb-1">Select a Token</p>
                <p className="text-[10px] text-muted font-mono mb-2">Click a token from the scene to edit:</p>
                {sceneTokens.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1 w-full max-h-28 overflow-y-auto p-1">
                        {sceneTokens.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => selectToken(t)}
                                className="aspect-square rounded-lg border border-neutral-800 hover:border-neutral-600 p-1 bg-surface flex flex-col items-center justify-center gap-1 transition-all"
                            >
                                {t.image?.url ? (
                                    <img src={t.image.url} alt={t.name} className="w-5 h-5 object-cover rounded" />
                                ) : (
                                    <div className="w-5 h-5 rounded bg-neutral-800" />
                                )}
                                <span className="text-[8px] font-mono text-muted truncate w-full">{t.name || 'Token'}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-muted font-mono">No character tokens found.</p>
                )}
            </div>
        );
    }

    return (
        <div className="h-full w-full space-y-1.5 overflow-hidden px-2 py-1.5 select-none bg-background text-white font-sans flex flex-col justify-between">
            {/* 1. Name Field */}
            <div className="grid grid-cols-[1fr,auto,1fr] place-items-center">
                <div />
                <div className="w-[140px] relative">
                    <input
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        onBlur={(e) => handleNameChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                                handleNameChange(tokenName);
                            }
                        }}
                        placeholder="Name"
                        className="h-[24px] w-full rounded-lg bg-surface border border-neutral-800 px-2 text-center text-xs font-bold text-white outline-none focus:border-neutral-500 shadow-inner"
                    />
                </div>
                <div className="flex items-center gap-1 pl-1">
                    <button
                        onClick={async () => {
                            if (token) {
                                const currentName = token.name || 'Token';
                                setTokenName(currentName);
                                await handleNameChange(currentName);
                            }
                        }}
                        className="p-1 rounded-md bg-surface/50 hover:bg-surface border border-neutral-800 text-muted hover:text-white transition-all"
                        title="Sync token name"
                    >
                        <MagicIcon />
                    </button>
                    <button
                        onClick={handleRemoveTracker}
                        className="p-1 rounded-md bg-surface/50 hover:bg-rose-950/50 border border-neutral-800 hover:border-rose-800 text-muted hover:text-rose-400 transition-all"
                        title="Remove HUD attachments from token"
                    >
                        <TrashIcon />
                    </button>
                </div>
            </div>

            {/* 2. Stats Grid (5-Column Bar + Bubbles) */}
            <div className="grid grid-cols-5 rounded-xl bg-surface/60 border border-neutral-800/80 p-1.5 gap-1 items-center shadow-inner">
                {/* Column 1-2: Hit Points & Maximum (BarInput) */}
                <div className="col-span-2 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[7.5px] font-bold tracking-wider text-muted uppercase font-mono">
                        HIT POINTS
                    </span>
                    <div className="relative flex h-[30px] w-[86px] justify-between items-center rounded-lg bg-rose-950/30 border border-rose-800/50 shadow-inner">
                        <PartiallyControlledInput
                            parentValue={tracker.hp.toString()}
                            onUserConfirm={handleUpdateHp}
                            onFocus={() => setValueHasFocus(true)}
                            onBlur={() => setValueHasFocus(false)}
                            className="w-[38px] h-full bg-transparent text-center text-xs font-bold font-mono text-white outline-none"
                        />
                        <span className="text-muted/60 font-mono text-xs select-none">/</span>
                        <PartiallyControlledInput
                            parentValue={tracker.hpMax.toString()}
                            onUserConfirm={handleUpdateMaxHp}
                            onFocus={() => setMaxHasFocus(true)}
                            onBlur={() => setMaxHasFocus(false)}
                            className="w-[38px] h-full bg-transparent text-center text-xs font-bold font-mono text-muted focus:text-white outline-none"
                        />
                    </div>
                    <span className="text-[7.5px] font-bold tracking-wider text-muted uppercase font-mono">
                        & MAXIMUM
                    </span>
                </div>

                {/* Column 3: Armor Class Bubble */}
                <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <TextRing topText="ARMOR" bottomText="CLASS" letterSpacing={0.8} />
                    </div>
                    <div className="w-[30px] h-[30px] rounded-full bg-blue-950/40 border border-blue-600/70 flex items-center justify-center shadow-fey-subtle my-auto">
                        <PartiallyControlledInput
                            parentValue={tracker.armor.toString()}
                            onUserConfirm={(val) => handleUpdateStat('armor', val)}
                            className="w-full h-full bg-transparent text-center text-xs font-bold font-mono text-blue-300 outline-none"
                        />
                    </div>
                </div>

                {/* Column 4: Stress Bubble */}
                <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <TextRing topText="STRESS" bottomText="VALUE" letterSpacing={0.7} />
                    </div>
                    <div className="w-[30px] h-[30px] rounded-full bg-amber-950/40 border border-amber-600/70 flex items-center justify-center shadow-fey-subtle my-auto">
                        <PartiallyControlledInput
                            parentValue={tracker.stress.toString()}
                            onUserConfirm={(val) => handleUpdateStat('stress', val)}
                            className="w-full h-full bg-transparent text-center text-xs font-bold font-mono text-amber-300 outline-none"
                        />
                    </div>
                </div>

                {/* Column 5: Hope Bubble */}
                <div className="flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <TextRing topText="HOPE" bottomText="POINTS" letterSpacing={0.8} />
                    </div>
                    <div className="w-[30px] h-[30px] rounded-full bg-emerald-950/40 border border-emerald-600/70 flex items-center justify-center shadow-fey-subtle my-auto">
                        <PartiallyControlledInput
                            parentValue={tracker.hope.toString()}
                            onUserConfirm={(val) => handleUpdateStat('hope', val)}
                            className="w-full h-full bg-transparent text-center text-xs font-bold font-mono text-emerald-300 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* 3. Daggerheart Status Conditions */}
            <div className="grid grid-cols-8 gap-0.5">
                {STATUS_OPTIONS.map((status) => {
                    const isActive = !!tracker.statuses?.[status.key];
                    return (
                        <button
                            key={status.key}
                            onClick={() => handleToggleStatus(status.key)}
                            className={clsx(
                                "py-0.5 rounded text-[8px] font-mono font-bold transition-all border text-center",
                                isActive
                                    ? `${status.bg} ${status.color} shadow-fey-subtle`
                                    : "bg-surface/50 border-neutral-800 text-muted/60 hover:text-white hover:border-neutral-700"
                            )}
                        >
                            {status.abbr}
                        </button>
                    );
                })}
            </div>

            {/* 4. DM Mode / Stealth Toggle + Clear Attachments */}
            <div className="flex items-center gap-1.5 w-full">
                <button
                    onClick={handleToggleShowHp}
                    className={clsx(
                        "flex-1 py-1 px-2.5 rounded-lg text-[10.5px] font-mono font-medium transition-all flex items-center justify-center gap-1.5 border shadow-sm",
                        !tracker.showHp
                            ? "bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/40"
                            : "bg-surface/80 border-neutral-800 text-muted hover:text-white hover:bg-surface"
                    )}
                >
                    {!tracker.showHp ? (
                        <>
                            <BookLock />
                            <span>Stealth (Damage Dealt Only)</span>
                        </>
                    ) : (
                        <>
                            <BookOpen />
                            <span>Visible (Standard HP Bar)</span>
                        </>
                    )}
                </button>
                <button
                    onClick={handleRemoveTracker}
                    className="py-1 px-2 rounded-lg bg-surface/80 hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-800 text-muted hover:text-rose-400 transition-all flex items-center justify-center gap-1 text-[10px] font-mono"
                    title="Remove HUD attachments from token"
                >
                    <TrashIcon />
                    <span>Clear</span>
                </button>
            </div>
        </div>
    );
};

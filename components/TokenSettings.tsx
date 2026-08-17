
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OBR, { Image, Item } from "@owlbear-rodeo/sdk";
import { Icons } from './ui/Icons';
import { OBRStorage, DaggerheartVitals } from '../obr/storage';
import { TokenAttachments } from '../obr/tokenAttachments';
import { useOBR } from '../obr';
import clsx from 'clsx';

interface TokenInfo {
    id: string;
    name: string;
    imageUrl: string;
}

interface TokenSettingsProps {
    vitals: DaggerheartVitals;
}

export const TokenSettings: React.FC<TokenSettingsProps> = ({ vitals }) => {
    const { isOBR, ready } = useOBR();
    const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([]);
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!ready || !isOBR) {
            setIsLoading(false);
            return;
        }

        const load = async () => {
            try {
                const savedTokenId = await OBRStorage.getSelectedTokenId();
                if (savedTokenId) {
                    setSelectedTokenId(savedTokenId);
                }
                await refreshTokenList();
            } catch (e) {
                console.error("Failed to load token settings:", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();

        const unsubscribe = OBR.scene.items.onChange(async () => {
            await refreshTokenList();
        });

        return () => {
            unsubscribe();
        };
    }, [ready, isOBR]);

    useEffect(() => {
        if (!selectedTokenId || !ready || !isOBR) return;
        TokenAttachments.update(selectedTokenId, vitals);
    }, [vitals, selectedTokenId, ready, isOBR]);

    const refreshTokenList = async () => {
        setIsRefreshing(true);
        try {
            const items = await OBR.scene.items.getItems(
                (item) => item.type === "IMAGE" && item.layer === "CHARACTER"
            );

            const tokens: TokenInfo[] = items.map((item) => {
                const img = item as Image;
                return {
                    id: item.id,
                    name: item.name || "Unnamed Token",
                    imageUrl: img.image?.url || "",
                };
            });

            setAvailableTokens(tokens);
        } catch (e) {
            console.error("Failed to refresh tokens:", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const selectToken = async (tokenId: string | null) => {
        if (selectedTokenId && selectedTokenId !== tokenId) {
            await TokenAttachments.delete(selectedTokenId);
        }

        setSelectedTokenId(tokenId);
        await OBRStorage.setSelectedTokenId(tokenId || undefined);

        if (tokenId) {
            await TokenAttachments.create(tokenId, vitals);
        }
    };

    const clearSelection = async () => {
        if (selectedTokenId) {
            await TokenAttachments.delete(selectedTokenId);
        }
        setSelectedTokenId(null);
        await OBRStorage.setSelectedTokenId(undefined);
    };

    if (!isOBR) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted p-8 text-center select-none">
                <Icons.Dice size={36} className="mb-3 opacity-20 text-muted" />
                <p className="text-xs font-mono">Token visualization is only available inside Owlbear Rodeo.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted select-none">
                <div className="text-xs font-mono animate-pulse">Loading tokens...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background select-none">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-surface/30">
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Icons.Target size={16} className="text-white" />
                    Token Visualization
                </h2>
                <button
                    onClick={() => refreshTokenList()}
                    disabled={isRefreshing}
                    className="p-1.5 text-muted hover:text-white hover:bg-elevated rounded-full transition-colors disabled:opacity-50"
                    title="Refresh token list"
                >
                    <Icons.Refresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Selected Token */}
            {selectedTokenId && (
                <div className="p-4 bg-surface/50 border-b border-neutral-800">
                    <div className="text-[10px] uppercase font-bold text-muted tracking-widest font-mono mb-2">
                        Active Attached Token
                    </div>
                    <div className="flex items-center gap-3">
                        {(() => {
                            const token = availableTokens.find(t => t.id === selectedTokenId);
                            return token ? (
                                <>
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-elevated border border-white shadow-fey-glow">
                                        {token.imageUrl && (
                                            <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white text-xs font-bold">{token.name}</div>
                                        <div className="text-[11px] text-muted font-mono">Live HUD pills attached</div>
                                    </div>
                                    <button
                                        onClick={clearSelection}
                                        className="p-2 text-muted hover:text-rose-400 hover:bg-white/5 rounded-full transition-colors"
                                        title="Detach from token"
                                    >
                                        <Icons.Close size={16} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-muted text-xs font-mono">Token no longer exists in scene</div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Token List */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-[10px] uppercase font-bold text-muted tracking-widest font-mono mb-3">
                    {selectedTokenId ? "Switch Scene Token" : "Select Scene Token"}
                </div>

                {availableTokens.length === 0 ? (
                    <div className="text-center text-muted py-12 flex flex-col items-center gap-2">
                        <Icons.Dice size={36} className="opacity-20 text-muted" />
                        <p className="text-xs font-mono">No character tokens found in scene.</p>
                        <p className="text-[10px] text-muted font-mono">Add character tokens to the CHARACTER layer.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {availableTokens.map((token) => (
                            <button
                                key={token.id}
                                onClick={() => selectToken(token.id)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all shadow-fey-subtle active:scale-95",
                                    token.id === selectedTokenId
                                        ? "bg-surface border-white shadow-fey-glow"
                                        : "bg-surface/50 border-neutral-800 hover:border-neutral-700 hover:bg-surface"
                                )}
                            >
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-elevated border border-neutral-800">
                                    {token.imageUrl && (
                                        <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <span className="text-xs font-medium text-center text-white truncate w-full">
                                    {token.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Text */}
            <div className="p-3.5 border-t border-neutral-800 text-[11px] text-muted font-mono bg-surface/20">
                Attaching displays live Daggerheart HUD pills (Hope, Stress, HP, Armor) anchored beneath the token on the map canvas.
            </div>
        </div>
    );
};


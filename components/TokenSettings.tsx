
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

    // Load saved token and available tokens
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

        // Listen for scene changes
        const unsubscribe = OBR.scene.items.onChange(async () => {
            await refreshTokenList();
        });

        return () => {
            // unsubscribe?.();
        };
    }, [ready, isOBR]);

    // Update token attachments when vitals change
    useEffect(() => {
        if (!selectedTokenId || !ready || !isOBR) return;
        TokenAttachments.update(selectedTokenId, vitals);
    }, [vitals, selectedTokenId, ready, isOBR]);

    const refreshTokenList = async () => {
        setIsRefreshing(true);
        try {
            // Get all tokens (Images) from the scene
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
        // Remove old attachments if changing token
        if (selectedTokenId && selectedTokenId !== tokenId) {
            await TokenAttachments.delete(selectedTokenId);
        }

        setSelectedTokenId(tokenId);
        await OBRStorage.setSelectedTokenId(tokenId || undefined);

        // Create new attachments
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
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8 text-center">
                <Icons.Dice size={48} className="mb-4 opacity-20" />
                <p>Token visualization is only available inside Owlbear Rodeo.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <div className="animate-pulse">Loading tokens...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Icons.Dice size={20} className="text-accent" />
                    Token Visualization
                </h2>
                <button
                    onClick={() => refreshTokenList()}
                    disabled={isRefreshing}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh token list"
                >
                    <Icons.Refresh size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Selected Token */}
            {selectedTokenId && (
                <div className="p-4 bg-zinc-900/50 border-b border-zinc-800">
                    <div className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2">
                        Active Token
                    </div>
                    <div className="flex items-center gap-3">
                        {(() => {
                            const token = availableTokens.find(t => t.id === selectedTokenId);
                            return token ? (
                                <>
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 border-2 border-accent">
                                        {token.imageUrl && (
                                            <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-medium">{token.name}</div>
                                        <div className="text-xs text-zinc-500">Stats synced to token</div>
                                    </div>
                                    <button
                                        onClick={clearSelection}
                                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove visualization"
                                    >
                                        <Icons.Close size={18} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-zinc-500 text-sm">Token no longer exists</div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Token List */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-3">
                    {selectedTokenId ? "Change Token" : "Select a Token"}
                </div>

                {availableTokens.length === 0 ? (
                    <div className="text-center text-zinc-600 py-10">
                        <Icons.Dice size={48} className="mx-auto mb-2 opacity-20" />
                        <p>No tokens found on the map.</p>
                        <p className="text-xs mt-2">Add character tokens to the CHARACTER layer.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {availableTokens.map((token) => (
                            <button
                                key={token.id}
                                onClick={() => selectToken(token.id)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                                    token.id === selectedTokenId
                                        ? "bg-accent/10 border-accent"
                                        : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50"
                                )}
                            >
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
                                    {token.imageUrl && (
                                        <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <span className="text-xs text-center text-zinc-300 truncate w-full">
                                    {token.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Text */}
            <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
                Select a token to display your Daggerheart vitals (Hope, Stress, HP, Armor) as pill bubbles below the token.
                Stats will automatically sync when you make changes.
            </div>
        </div>
    );
};

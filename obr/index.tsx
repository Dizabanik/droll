/**
 * OBR Main Entry Point
 * Initializes Owlbear Rodeo SDK and provides React context
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import OBR from "@owlbear-rodeo/sdk";
import { OBRBroadcast } from "./broadcast";
export * from "./broadcast"; // Re-export for convenience
import { isOBREnvironment } from "./storage";

interface OBRContextValue {
    ready: boolean;
    playerId: string | null;
    playerName: string | null;
    playerColor: string | null;
    isOBR: boolean;
}

const OBRContext = createContext<OBRContextValue>({
    ready: false,
    playerId: null,
    playerName: null,
    playerColor: null,
    isOBR: false,
});

export const useOBR = () => useContext(OBRContext);

interface OBRProviderProps {
    children: ReactNode;
}

export const OBRProvider: React.FC<OBRProviderProps> = ({ children }) => {
    const [ready, setReady] = useState(false);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [playerColor, setPlayerColor] = useState<string | null>(null);
    const [isOBR] = useState(() => isOBREnvironment());

    useEffect(() => {
        if (!isOBR) {
            // Not in OBR, immediately ready for dev mode
            setReady(true);
            setPlayerId('local-dev');
            setPlayerName('Local Player');
            setPlayerColor('#3b82f6');
            return;
        }

        OBR.onReady(async () => {
            try {
                // Initialize broadcast listener
                await OBRBroadcast.init();

                // Get player info
                const [id, name, color] = await Promise.all([
                    OBR.player.getId(),
                    OBR.player.getName(),
                    OBR.player.getColor(),
                ]);

                setPlayerId(id);
                setPlayerName(name);
                setPlayerColor(color);
                setReady(true);

                // Subscribe to player changes
                OBR.player.onChange(async () => {
                    const [newName, newColor] = await Promise.all([
                        OBR.player.getName(),
                        OBR.player.getColor(),
                    ]);
                    setPlayerName(newName);
                    setPlayerColor(newColor);
                });

            } catch (e) {
                console.error("OBR initialization error:", e);
                // Still mark as ready so app can function
                setReady(true);
            }
        });
    }, [isOBR]);

    return (
        <OBRContext.Provider value={{ ready, playerId, playerName, playerColor, isOBR }}>
            {children}
        </OBRContext.Provider>
    );
};

export { OBRBroadcast } from "./broadcast";
export { OBRStorage, isOBREnvironment } from "./storage";
export type { RollHistoryEntry, DaggerheartVitals, DaggerheartStatuses } from "./storage";
export { TokenAttachments } from "./tokenAttachments";

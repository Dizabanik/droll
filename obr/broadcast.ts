/**
 * OBR Broadcast Service
 * Handles real-time multiplayer messaging for dice rolls
 */

import OBR from "@owlbear-rodeo/sdk";
import { StepResult, DamageType } from "../types";
import { PendingDie } from "../utils/engine";
import { isOBREnvironment } from "./storage";

const CHANNEL = "com.fateweaver.dice/roll";

export interface DiceRollStartMessage {
    type: 'ROLL_START';
    playerId: string;
    playerName: string;
    playerColor: string;
    presetName: string;
    itemName: string;
    diceConfig: PendingDie[];
    steps: Array<{
        id: string;
        label: string;
        type: 'standard' | 'daggerheart';
        formula: string;
        damageType: DamageType;
    }>;
    variables: Record<string, number>;
}

export interface DiceValuesMessage {
    type: 'DICE_VALUES';
    playerId: string;
    stepIndex: number;
    values: Record<string, number>;
    activeDiceIds: string[];
}

export interface RollCompleteMessage {
    type: 'ROLL_COMPLETE';
    playerId: string;
    results: StepResult[];
    grandTotal: number;
    breakdown: string;
}

export type DiceRollMessage = DiceRollStartMessage | DiceValuesMessage | RollCompleteMessage;

type MessageCallback = (message: DiceRollMessage, senderId: string) => void;

const listeners: Set<MessageCallback> = new Set();

let isInitialized = false;

/**
 * Initialize the broadcast listener
 */
export const initBroadcast = async (): Promise<void> => {
    if (!isOBREnvironment() || isInitialized) return;

    isInitialized = true;

    OBR.broadcast.onMessage(CHANNEL, (event) => {
        const message = event.data as DiceRollMessage;
        const senderId = event.connectionId;

        listeners.forEach(callback => {
            try {
                callback(message, senderId);
            } catch (e) {
                console.error("Broadcast listener error:", e);
            }
        });
    });
};

/**
 * Send a dice roll message to all other players
 */
export const sendRollMessage = async (message: DiceRollMessage): Promise<void> => {
    if (!isOBREnvironment()) {
        // In dev mode, simulate by calling local listeners immediately
        const myId = 'local-dev';
        listeners.forEach(callback => callback(message, myId));
        return;
    }

    try {
        await OBR.broadcast.sendMessage(CHANNEL, message, { destination: "ALL" });
    } catch (e) {
        console.error("Failed to send broadcast:", e);
    }
};

/**
 * Subscribe to dice roll messages
 * Returns unsubscribe function
 */
export const onRollMessage = (callback: MessageCallback): (() => void) => {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
};

/**
 * Get current player info for broadcasts
 */
export const getPlayerInfo = async (): Promise<{ id: string; name: string; color: string }> => {
    if (!isOBREnvironment()) {
        return { id: 'local-dev', name: 'Local Player', color: '#3b82f6' };
    }

    try {
        const [id, name, color] = await Promise.all([
            OBR.player.getId(),
            OBR.player.getName(),
            OBR.player.getColor(),
        ]);
        return { id, name, color };
    } catch (e) {
        console.error("Failed to get player info:", e);
        return { id: 'unknown', name: 'Unknown Player', color: '#888888' };
    }
};

export const OBRBroadcast = {
    init: initBroadcast,
    send: sendRollMessage,
    onMessage: onRollMessage,
    getPlayerInfo,
};

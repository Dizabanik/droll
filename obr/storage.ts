/**
 * Storage Service
 * Uses localStorage for persistent per-player data
 * Works the same way in both Owlbear Rodeo and standalone mode
 */

import { Item, CharacterStats } from "../types";

const STORAGE_KEY = "fateweaver_data";

export interface DaggerheartVitals {
  hope: number;
  hopeMax: number;
  stress: number;
  stressMax: number;
  hp: number;
  hpMax: number;
  armor: number;
  armorMax: number;
}

export interface DaggerheartStatuses {
  vulnerable: boolean;
  blinded: boolean;
  frightened: boolean;
  hidden: boolean;
  restrained: boolean;
  slowed: boolean;
  weakened: boolean;
  empowered: boolean;
}

export interface RollHistoryEntry {
  id: string;
  timestamp: number;
  playerId: string;
  playerName: string;
  presetName: string;
  itemName: string;
  grandTotal: number;
  breakdown: string;
}

interface FateWeaverData {
  items?: Item[];
  stats?: CharacterStats;
  rollHistory?: RollHistoryEntry[];
  daggerheartVitals?: DaggerheartVitals;
  daggerheartStatuses?: DaggerheartStatuses;
  selectedTokenId?: string;
}

/**
 * Check if we're running inside Owlbear Rodeo (iframe)
 */
export const isOBREnvironment = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
};

/**
 * Get all stored data from localStorage
 */
const getData = (): FateWeaverData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return {};
  }
};

/**
 * Save data to localStorage (merges with existing)
 */
const setData = (data: Partial<FateWeaverData>): void => {
  try {
    const existing = getData();
    const merged = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    // Dispatch storage event for cross-tab sync
    const event = new StorageEvent("storage", {
      key: STORAGE_KEY,
      newValue: JSON.stringify(merged),
    });
    window.dispatchEvent(event);
  } catch (e) {
    console.error("Failed to write to localStorage:", e);
  }
};

// === Async wrappers for compatibility ===

export const getPlayerData = async (): Promise<FateWeaverData> => {
  return getData();
};

export const setPlayerData = async (data: Partial<FateWeaverData>): Promise<void> => {
  setData(data);
};

// === Item helpers ===

export const getItems = async (): Promise<Item[] | undefined> => {
  return getData().items;
};

export const setItems = async (items: Item[]): Promise<void> => {
  setData({ items });
};

// === Stats helpers ===

export const getStats = async (): Promise<CharacterStats | undefined> => {
  return getData().stats;
};

export const setStats = async (stats: CharacterStats): Promise<void> => {
  setData({ stats });
};

// === Export/Import ===

export const exportData = async (): Promise<string> => {
  return JSON.stringify(getData(), null, 2);
};

export const importData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to import data:", e);
    return false;
  }
};

// === Main export ===

export const OBRStorage = {
  getPlayerData,
  setPlayerData,
  getItems,
  setItems,
  getStats,
  setStats,
  exportData,
  importData,
  isOBREnvironment,

  // Roll history
  getRollHistory: async (): Promise<RollHistoryEntry[]> => {
    return getData().rollHistory || [];
  },
  setRollHistory: async (history: RollHistoryEntry[]): Promise<void> => {
    setData({ rollHistory: history.slice(0, 20) });
  },

  // Daggerheart vitals
  getDaggerheartVitals: async (): Promise<DaggerheartVitals | undefined> => {
    return getData().daggerheartVitals;
  },
  setDaggerheartVitals: async (vitals: DaggerheartVitals): Promise<void> => {
    setData({ daggerheartVitals: vitals });
  },

  // Daggerheart statuses
  getDaggerheartStatuses: async (): Promise<DaggerheartStatuses | undefined> => {
    return getData().daggerheartStatuses;
  },
  setDaggerheartStatuses: async (statuses: DaggerheartStatuses): Promise<void> => {
    setData({ daggerheartStatuses: statuses });
  },

  // Selected token
  getSelectedTokenId: async (): Promise<string | undefined> => {
    return getData().selectedTokenId;
  },
  setSelectedTokenId: async (tokenId: string | undefined): Promise<void> => {
    setData({ selectedTokenId: tokenId });
  },
};

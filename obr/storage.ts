/**
 * Storage Service
 * Uses localStorage for persistent per-player data
 * scoped to the current Campaign (Room ID) if available
 */

import { Item, CharacterStats } from "../types";
import OBR from "@owlbear-rodeo/sdk";

const GLOBAL_STORAGE_KEY = "fateweaver_data";

export interface OBRCustomStat {
  id: string;
  name: string;
  value: number;
}

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
  results?: Array<{
    stepId: string;
    uniqueId: string;
    label: string;
    total: number;
    rolls: number[];
    formula: string;
    type: 'standard' | 'daggerheart';
    damageType: string;
    skipped: boolean;
    addToSum?: boolean;
    wasCrit?: boolean;
    dhHope?: number;
    dhFear?: number;
    dhOutcome?: 'hope' | 'fear' | 'crit';
  }>;
}

export interface DaggerheartCharacter {
  // 6 core stats (can bexport interface DaggerheartCharacter {
  agility: number;
  strength: number;
  finesse: number;
  instinct: number;
  presence: number;
  knowledge: number;
  evasion: number;
  level: number;
  thresholdMinor: number;
  thresholdMajor: number;
  thresholdSevere: number;
  skulls: number; // 0-11
  essenceCurrent: number;
  essenceMax: number;
  essenceRank: number; // 1-5
  essenceStage: number; // 1-4
  customStats: OBRCustomStat[];
  settings: {
    showStrain: boolean;
    showReverendInsanity: boolean;
  };
}

export const DEFAULT_CHARACTER: DaggerheartCharacter = {
  agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0,
  evasion: 10, level: 1,
  thresholdMinor: 0, thresholdMajor: 0, thresholdSevere: 0,
  skulls: 0,
  essenceCurrent: 0, essenceMax: 0, essenceRank: 1, essenceStage: 1,
  customStats: [],
  settings: {
    showStrain: true,
    showReverendInsanity: false, // Hidden by default
  },
};

export interface DaggerheartMoney {
  primevalFragment: number; // 1/8 Stone
  primevalStone: number;
  primevalK: number; // 1k Stone
  primeval10K: number; // 10k Stone
  immortalEssence: number;
}

interface FateWeaverData {
  items?: Item[];
  stats?: CharacterStats;
  rollHistory?: RollHistoryEntry[];
  daggerheartVitals?: DaggerheartVitals;
  daggerheartStatuses?: DaggerheartStatuses;
  daggerheartCharacter?: DaggerheartCharacter;
  daggerheartMoney?: DaggerheartMoney;
  selectedTokenId?: string;
  fear?: number;
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
 * Get the storage key for the current campaign
 * Returns simple global key if not in OBR or not ready
 */
const getStorageKey = async (): Promise<string> => {
  if (isOBREnvironment()) {
    try {
      // Ensure OBR is ready before asking for ID
      // Since this runs often, we assume OBR.onReady is handled at app root, 
      // but room.id should be available if we are inside the room.
      const roomId = await OBR.room.id;
      return `${GLOBAL_STORAGE_KEY}_${roomId}`;
    } catch (e) {
      console.warn("Could not get Room ID, falling back to global storage:", e);
      return GLOBAL_STORAGE_KEY;
    }
  }
  return GLOBAL_STORAGE_KEY;
};

/**
 * Get all stored data from localStorage
 * Handles migration from Global -> Campaign storage
 */
const getData = async (): Promise<FateWeaverData> => {
  try {
    const key = await getStorageKey();
    const data = localStorage.getItem(key);

    if (data) {
      return JSON.parse(data);
    }

    // MIGRATION: If no data found in scoped key, check standard global key
    if (key !== GLOBAL_STORAGE_KEY) {
      const globalData = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if (globalData) {
        console.log("Migrating data from Global to Campaign storage...");
        // Copy to new key immediately so next time it's found
        localStorage.setItem(key, globalData);
        return JSON.parse(globalData);
      }
    }

    return {};
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return {};
  }
};

/**
 * Save data to localStorage (merges with existing)
 */
const setData = async (data: Partial<FateWeaverData>): Promise<void> => {
  try {
    const key = await getStorageKey();
    const existing = await getData();
    const merged = { ...existing, ...data };
    localStorage.setItem(key, JSON.stringify(merged));

    // Dispatch storage event for cross-tab sync
    const event = new StorageEvent("storage", {
      key: key,
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
  await setData(data);
};

// === Item helpers ===

export const getItems = async (): Promise<Item[] | undefined> => {
  const data = await getData();
  return data.items;
};

export const setItems = async (items: Item[]): Promise<void> => {
  await setData({ items });
};

// === Stats helpers ===

export const getStats = async (): Promise<CharacterStats | undefined> => {
  const data = await getData();
  return data.stats;
};

export const setStats = async (stats: CharacterStats): Promise<void> => {
  await setData({ stats });
};

// === Export/Import ===

export const exportData = async (): Promise<string> => {
  const data = await getData();
  return JSON.stringify(data, null, 2);
};

export const importData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString);
    const key = await getStorageKey();
    localStorage.setItem(key, JSON.stringify(data));
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
    const data = await getData();
    return data.rollHistory || [];
  },
  setRollHistory: async (history: RollHistoryEntry[]): Promise<void> => {
    await setData({ rollHistory: history.slice(0, 20) });
  },

  // Daggerheart vitals
  getDaggerheartVitals: async (): Promise<DaggerheartVitals | undefined> => {
    const data = await getData();
    return data.daggerheartVitals;
  },
  setDaggerheartVitals: async (vitals: DaggerheartVitals): Promise<void> => {
    await setData({ daggerheartVitals: vitals });
  },

  // Daggerheart Statuses
  getDaggerheartStatuses: async (): Promise<DaggerheartStatuses | undefined> => {
    const data = await getData();
    return data.daggerheartStatuses;
  },
  setDaggerheartStatuses: async (statuses: DaggerheartStatuses): Promise<void> => {
    await setData({ daggerheartStatuses: statuses });
  },



  // Daggerheart Money
  getDaggerheartMoney: async (): Promise<DaggerheartMoney | undefined> => {
    const data = await getData();
    return data.daggerheartMoney;
  },
  setDaggerheartMoney: async (money: DaggerheartMoney): Promise<void> => {
    await setData({ daggerheartMoney: money });
  },

  // Selected token
  getSelectedTokenId: async (): Promise<string | undefined> => {
    const data = await getData();
    return data.selectedTokenId;
  },
  setSelectedTokenId: async (tokenId: string | undefined): Promise<void> => {
    await setData({ selectedTokenId: tokenId });
  },

  // Daggerheart character (stats, evasion, level, thresholds, skulls)
  getDaggerheartCharacter: async (): Promise<DaggerheartCharacter | undefined> => {
    const data = await getData();
    return data.daggerheartCharacter;
  },
  setDaggerheartCharacter: async (character: DaggerheartCharacter): Promise<void> => {
    await setData({ daggerheartCharacter: character });
  },

  // Fear tracker (GM resource)
  getFear: async (): Promise<number | null> => {
    const data = await getData();
    return data.fear !== undefined ? data.fear : null;
  },
  setFear: async (fear: number): Promise<void> => {
    await setData({ fear });
  },
};

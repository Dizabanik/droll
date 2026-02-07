/**
 * Storage Service
 * Uses localStorage for persistent per-player data
 * Works the same way in both Owlbear Rodeo and standalone mode
 */

import { Item, CharacterStats } from "../types";
import OBR from "@owlbear-rodeo/sdk";

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
  // 6 core stats (can be negative or positive)
  agility: number;
  strength: number;
  finesse: number;
  instinct: number;
  presence: number;
  knowledge: number;
  // Evasion and Level
  evasion: number;
  level: number;
  // Damage thresholds
  minorThreshold: number;
  majorThreshold: number;
  // Skull damage tracker (0-11)
  skulls: number;
  // Primeval Essence
  essenceCurrent: number;
  essenceMax: number;
  essenceRank: number; // 1-5
  essenceStage: number; // 1-4
}

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
 * Get all stored data from localStorage
 */
const METADATA_KEY = "com.fateweaver.data";

/**
 * Get all stored data from OBR Player Metadata (or localStorage fallback if outside OBR)
 */
const getData = async (): Promise<FateWeaverData> => {
  try {
    if (isOBREnvironment()) {
      const metadata = await OBR.player.getMetadata();
      return (metadata[METADATA_KEY] as FateWeaverData) || {};
    } else {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    }
  } catch (e) {
    console.error("Failed to read data:", e);
    return {};
  }
};

/**
 * Save data to OBR Player Metadata (or localStorage fallback)
 */
const setData = async (data: Partial<FateWeaverData>): Promise<void> => {
  try {
    if (isOBREnvironment()) {
      const existing = await getData(); // Need to fetch existing to merge, though metadata merge might be partial? 
      // OBR metadata merge is usually shallow at root, so we should merge our object manually
      const merged = { ...existing, ...data };
      await OBR.player.setMetadata({ [METADATA_KEY]: merged });
    } else {
      const existing = await getData();
      const merged = { ...existing, ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

      // Dispatch storage event for cross-tab sync (local only)
      const event = new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify(merged),
      });
      window.dispatchEvent(event);
    }
  } catch (e) {
    console.error("Failed to write data:", e);
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
    if (isOBREnvironment()) {
      await OBR.player.setMetadata({ [METADATA_KEY]: data });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
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

/**
 * OBR Storage Service
 * Handles persistent per-player data via Owlbear Rodeo's player metadata
 */

import OBR from "@owlbear-rodeo/sdk";
import { Item, CharacterStats } from "../types";

const METADATA_KEY = "com.fateweaver.dice";

interface FateWeaverMetadata {
  items?: Item[];
  stats?: CharacterStats;
}

/**
 * Check if we're running inside Owlbear Rodeo
 */
export const isOBREnvironment = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true; // If access blocked, we are likely in an iframe (OBR)
  }
};

/**
 * Get all player data from OBR metadata
 */
export const getPlayerData = async (): Promise<FateWeaverMetadata> => {
  if (!isOBREnvironment()) {
    // Fallback to localStorage in dev mode
    const items = localStorage.getItem('fateweaver_items');
    const stats = localStorage.getItem('fateweaver_stats');
    return {
      items: items ? JSON.parse(items) : undefined,
      stats: stats ? JSON.parse(stats) : undefined,
    };
  }

  try {
    const metadata = await OBR.player.getMetadata();
    const data = metadata[METADATA_KEY] as FateWeaverMetadata | undefined;
    return data || {};
  } catch (e) {
    console.error("Failed to get OBR metadata:", e);
    return {};
  }
};

/**
 * Save all player data to OBR metadata
 */
export const setPlayerData = async (data: Partial<FateWeaverMetadata>): Promise<void> => {
  if (!isOBREnvironment()) {
    // Fallback to localStorage in dev mode
    if (data.items) {
      localStorage.setItem('fateweaver_items', JSON.stringify(data.items));
    }
    if (data.stats) {
      localStorage.setItem('fateweaver_stats', JSON.stringify(data.stats));
    }
    return;
  }

  try {
    const existing = await getPlayerData();
    const merged = { ...existing, ...data };
    await OBR.player.setMetadata({
      [METADATA_KEY]: merged
    });
  } catch (e) {
    console.error("Failed to set OBR metadata:", e);
  }
};

/**
 * Get items from player data
 */
export const getItems = async (): Promise<Item[] | undefined> => {
  const data = await getPlayerData();
  return data.items;
};

/**
 * Save items to player data
 */
export const setItems = async (items: Item[]): Promise<void> => {
  await setPlayerData({ items });
};

/**
 * Get character stats from player data
 */
export const getStats = async (): Promise<CharacterStats | undefined> => {
  const data = await getPlayerData();
  return data.stats;
};

/**
 * Save character stats to player data
 */
export const setStats = async (stats: CharacterStats): Promise<void> => {
  await setPlayerData({ stats });
};

/**
 * Export all player data as JSON for device migration
 */
export const exportData = async (): Promise<string> => {
  const data = await getPlayerData();
  return JSON.stringify(data, null, 2);
};

/**
 * Import player data from JSON
 */
export const importData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString) as FateWeaverMetadata;
    if (data.items || data.stats) {
      await setPlayerData(data);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Failed to import data:", e);
    return false;
  }
};

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
};

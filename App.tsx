
import React, { useState, useEffect, useRef } from 'react';
import { Item, DicePreset, StepResult, CharacterStats, APP_VERSION } from './types';
import { generateId, getStatLabel } from './utils/engine';
import { DiceChainEditor } from './components/DiceChainEditor';
import { Roller } from './components/Roller';
import { VariableModal } from './components/VariableModal';
import { CharacterSheet } from './components/CharacterSheet';
import { HistoryControl } from './components/HistoryControl';
import { RollHistoryPanel, HistoryEntry } from './components/RollHistoryPanel';
import { TokenSettings } from './components/TokenSettings';
import { TokenQuickEditor } from './components/TokenQuickEditor';
import { QuickDiceToolbar } from './components/QuickDiceToolbar';
import { LeftToolbarPopover } from './components/LeftToolbarPopover';
import { Icons } from './components/ui/Icons';
import { DiceStyle } from './dice-engine/types/DiceStyle';
import { DiceStylePicker } from './components/DiceStylePicker';
import { MiroBoardEmbed } from './components/MiroBoardEmbed';
import { useOBR, OBRStorage, OBRBroadcast, DiceRollMessage, RollCompleteMessage, DaggerheartVitals } from './obr';
import { TokenAttachments } from './obr/tokenAttachments';
import clsx from 'clsx';

// Initial Mock Data
const INITIAL_ITEMS: Item[] = [
  {
    id: 'item-1',
    name: "Flame Tongue Longsword",
    description: "A rare magical sword that bursts into flames.",
    presets: [
      {
        id: 'p1',
        name: 'Full Attack Chain',
        variables: [{ id: 'v1', name: 'AC', defaultValue: 15 }],
        steps: [
          { id: 's1', label: 'Attack Roll', type: 'standard', formula: '1d20+2', statModifier: 'dnd_attr:str', damageType: 'none' },
          {
            id: 's2',
            label: 'Slashing Dmg',
            type: 'standard',
            formula: '1d8',
            statModifier: 'dnd_attr:str',
            damageType: 'slashing',
            condition: { dependsOnStepId: 's1', operator: '>', compareTarget: 'variable', variableId: 'v1', value: 0 }
          },
          {
            id: 's3',
            label: 'Fire Dmg',
            type: 'standard',
            formula: '2d6',
            damageType: 'fire',
            condition: { dependsOnStepId: 's1', operator: '>', compareTarget: 'variable', variableId: 'v1', value: 0 }
          }
        ]
      }
    ]
  }
];

const INITIAL_STATS: CharacterStats = {
  activeSystem: 'dnd5e',
  dndAttributes: {
    str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8
  },
  dndSkills: {
    'Acrobatics': 0, 'Animal Handling': 0, 'Arcana': 0, 'Athletics': 3, 'Deception': 0,
    'History': 0, 'Insight': 1, 'Intimidation': 0, 'Investigation': 0, 'Medicine': 0,
    'Nature': 0, 'Perception': 2, 'Performance': 0, 'Persuasion': 0, 'Religion': 0,
    'Sleight of Hand': 0, 'Stealth': 2, 'Survival': 0
  },
  daggerheartStats: {
    agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0
  },
  customStats: []
};

const App: React.FC = () => {
  const { ready, isOBR, playerName, playerId } = useOBR();

  // Overlay / Popover / Toolbar / ContextMenu Mode Detection
  const [isOverlay, setIsOverlay] = useState(false);
  const [isPopover, setIsPopover] = useState(false);
  const [isToolbar, setIsToolbar] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setIsOverlay(query.get('overlay') === 'true');
    setIsPopover(query.get('popover') === 'true');
    setIsToolbar(query.get('toolbar') === 'true');
    setIsContextMenu(query.get('contextMenu') === 'true');
  }, []);

  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [stats, setStats] = useState<CharacterStats>(INITIAL_STATS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'items' | 'character' | 'token' | 'settings'>('items');
  const [editingItem, setEditingItem] = useState<boolean>(false);
  const [diceStyle, setDiceStyle] = useState<DiceStyle>('GEMSTONE');
  const [characterSheetMode, setCharacterSheetMode] = useState<'sheet' | 'miro'>('sheet');
  const [daggerheartVitals, setDaggerheartVitals] = useState<DaggerheartVitals>({
    hope: 0, hopeMax: 6, stress: 0, stressMax: 6, hp: 10, hpMax: 10, armor: 0, armorMax: 5
  });

  // Rolling State
  const [pendingPreset, setPendingPreset] = useState<DicePreset | null>(null);
  const [activeRollPreset, setActiveRollPreset] = useState<DicePreset | null>(null);
  const [activeRollVars, setActiveRollVars] = useState<Record<string, number>>({});
  const [activeRollItemName, setActiveRollItemName] = useState<string>('');

  // History State
  const [rollHistory, setRollHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Cache for mapping results back to names
  const [playerMetaCache, setPlayerMetaCache] = useState<Record<string, { name: string, preset: string, item: string }>>({});

  // Listen for Rolls for History
  useEffect(() => {
    const unsubscribe = OBRBroadcast.onMessage((message: DiceRollMessage, senderId: string) => {
      if (message.type === 'ROLL_START') {
        const startMsg = message;
        setPlayerMetaCache(prev => ({
          ...prev,
          [startMsg.playerId]: {
            name: startMsg.playerName,
            preset: startMsg.presetName,
            item: startMsg.itemName
          }
        }));
      } else if (message.type === 'ROLL_COMPLETE') {
        const msg = message as RollCompleteMessage;
        setRollHistory(prev => {
          // Try to resolve name from cache or current message if available (it isn't in COMPLETE)
          // Or fallback to "Unknown"
          const meta = playerMetaCache[msg.playerId];
          // If it's me, use my name from hook if cache missing
          const resolvedName = (msg.playerId === playerId) ? (playerName || 'Me') : (meta?.name || 'Unknown');
          const resolvedPreset = meta?.preset || 'Roll';
          const resolvedItem = meta?.item || 'Item';

          const newEntry: HistoryEntry = {
            id: `${msg.playerId}-${Date.now()}`,
            timestamp: Date.now(),
            playerId: msg.playerId,
            playerName: resolvedName,
            presetName: resolvedPreset,
            itemName: resolvedItem,
            results: msg.results,
            grandTotal: msg.grandTotal,
            breakdown: msg.breakdown
          };
          return [newEntry, ...prev].slice(0, 20);
        });
      }
    });
    return () => unsubscribe();
  }, [playerId, playerName, playerMetaCache, isOverlay, isPopover]);
  // dependency on playerMetaCache might cause excessive re-binds but onMessage returns unsubscribe so it's fine. 
  // actually, using functional state updates inside callback is safer to avoid dep loops.
  // usage of playerMetaCache inside callback checks the CURRENT closure value. 
  // So I SHOULD assume playerMetaCache is fresh. 
  // But standard pattern: use refs or updated deps. 
  // Let's rely on functional updates where possible, but here we read separate state.
  // It's acceptable for now given low traffic.

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data from OBR storage on mount (only in main controller mode)
  useEffect(() => {
    if (!ready || isOverlay || isPopover || isLoaded) return;

    const loadData = async () => {
      try {
        console.log("Loading Die data...");
        const [savedItems, savedStats] = await Promise.all([
          OBRStorage.getItems(),
          OBRStorage.getStats(),
        ]);

        if (savedItems && savedItems.length > 0) {
          console.log("Loaded items:", savedItems.length);
          setItems(savedItems);
          setActiveItemId(savedItems[0]?.id || null);
        } else {
          // If explicitly empty array (user deleted all), keep empty.
          // If undefined (new user), use INITIAL.
          console.log("No saved items found (or new user). Using defaults if undefined.");
          if (savedItems && savedItems.length === 0) {
            setItems([]);
            setActiveItemId(null);
          } else {
            // Only reset to initial if we truly have nothing
            setActiveItemId(INITIAL_ITEMS[0]?.id || null);
          }
        }

        if (savedStats) {
          console.log("Loaded stats.");
          setStats(savedStats);
        }

        const savedStyle = await OBRStorage.getDiceStyle();
        if (savedStyle) {
          setDiceStyle(savedStyle);
        }

        const savedMode = await OBRStorage.getCharacterSheetMode();
        if (savedMode) {
          setCharacterSheetMode(savedMode);
        }
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
  }, [ready, isOverlay, isPopover]);

  // Open the overlay window and register tools on mount (if acting as controller)
  useEffect(() => {
    if (ready && isOBR && !isOverlay && !isPopover && !isToolbar && !isContextMenu) {
      // We are the controller. Try to open the controls, left dice toolbar, and register context menu.
      import('@owlbear-rodeo/sdk').then(({ default: OBR }) => {
        // Ensure legacy overlay is closed
        OBR.modal.close('com.fateweaver.dice.overlay');

        // 1. Interactive Controls (Popover, Anchored Bottom-Right)
        OBR.popover.open({
          id: 'com.fateweaver.dice.controls',
          url: window.location.pathname + '?popover=true',
          width: 60,
          height: 60,
          anchorOrigin: { horizontal: 'RIGHT', vertical: 'BOTTOM' },
          disableClickAway: true,
          hidePaper: true,
        }).catch(e => console.error("Failed to open controls popover:", e));

        // 2. Persistent Left Dice Toolbar (Popover, Anchored Left-Center)
        OBR.popover.open({
          id: 'com.fateweaver.dice.left_toolbar',
          url: window.location.pathname + '?toolbar=true',
          width: 80,
          height: 550,
          anchorOrigin: { horizontal: 'LEFT', vertical: 'CENTER' },
          transformOrigin: { horizontal: 'LEFT', vertical: 'CENTER' },
          disableClickAway: true,
          hidePaper: true,
        }).catch(e => console.error("Failed to open left toolbar popover:", e));

        // 3. Register Context Menu for Token Trackers (Shift + S / right-click token)
        OBR.contextMenu.create({
          id: 'com.fateweaver.dice.token_stats',
          icons: [
            {
              icon: '/stats-icon.svg',
              label: 'Edit Stats / Tracker',
              filter: {
                every: [
                  { key: 'type', value: 'IMAGE' },
                  { key: 'layer', value: 'CHARACTER', coordinator: '||' },
                  { key: 'layer', value: 'MOUNT' },
                ],
                max: 1,
              },
            },
          ],
          shortcut: 'Shift + S',
          embed: {
            url: window.location.pathname + '?contextMenu=true',
            height: 220,
          },
        }).catch(e => console.error("Failed to create context menu:", e));

        // Initial sync of all scene token attachments
        TokenAttachments.syncAll();
      });
    }
  }, [ready, isOBR, isOverlay, isPopover, isToolbar, isContextMenu]);

  // Save items when they change (only in main controller mode)
  useEffect(() => {
    if (!isLoaded || isOverlay || isPopover) return;
    console.log("Saving items...");
    OBRStorage.setItems(items);
  }, [items, isLoaded, isOverlay, isPopover]);

  // Save stats when they change (only in main controller mode)
  // Use ref to track if change came from storage event to avoid loop
  const statsFromStorageRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || isOverlay || isPopover) return;
    if (statsFromStorageRef.current) {
      // Skip save - this change came from storage event
      statsFromStorageRef.current = false;
      return;
    }
    console.log("Saving stats...");
    OBRStorage.setStats(stats);
  }, [stats, isLoaded, isOverlay, isPopover]);

  // Listen for storage changes to sync stats and settings
  useEffect(() => {
    const handleStorageChange = async () => {
      const newStats = await OBRStorage.getStats();
      if (newStats) {
        statsFromStorageRef.current = true;
        setStats(newStats);
      }
      const newStyle = await OBRStorage.getDiceStyle();
      if (newStyle) {
        setDiceStyle(newStyle);
      }
      const newMode = await OBRStorage.getCharacterSheetMode();
      if (newMode) {
        setCharacterSheetMode(newMode);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleDiceStyleChange = async (style: DiceStyle) => {
    setDiceStyle(style);
    await OBRStorage.setDiceStyle(style);
  };

  const handleSheetModeChange = async (mode: 'sheet' | 'miro') => {
    setCharacterSheetMode(mode);
    await OBRStorage.setCharacterSheetMode(mode);
  };

  // Listen for stat roll events from CharacterPanel to trigger rolls
  useEffect(() => {
    const handleStatRoll = (e: Event) => {
      const event = e as CustomEvent<{ statKey: string; statValue: number; statLabel: string }>;
      const { statKey, statValue, statLabel } = event.detail;

      // Create a temporary preset for this roll
      const statRollPreset: DicePreset = {
        id: `stat-roll-${statKey}`,
        name: `${statLabel} Check`,
        variables: [],
        steps: [{
          id: 'dh-stat-roll',
          label: `${statLabel} Check`,
          type: 'daggerheart',
          formula: `2d12+${statValue}`,
          damageType: 'none',
        }]
      };

      // Trigger the roller
      setActiveRollPreset(statRollPreset);
      setActiveRollVars({});
      setActiveRollItemName(`${statLabel} Check`);
    };

    window.addEventListener('fateweaver:statroll', handleStatRoll);
    return () => window.removeEventListener('fateweaver:statroll', handleStatRoll);
  }, []);

  const activeItem = items.find(i => i.id === activeItemId);

  const createItem = () => {
    const newItem: Item = {
      id: generateId(),
      name: 'New Artifact',
      description: 'Description...',
      presets: []
    };
    setItems([...items, newItem]);
    setActiveItemId(newItem.id);
    setActiveView('items');
    setEditingItem(true);
  };

  const updateActiveItem = (changes: Partial<Item>) => {
    if (!activeItemId) return;
    setItems(items.map(i => i.id === activeItemId ? { ...i, ...changes } : i));
  };

  const deleteActiveItem = () => {
    if (!activeItemId) return;
    const newItems = items.filter(i => i.id !== activeItemId);
    setItems(newItems);
    setActiveItemId(newItems[0]?.id || null);
    setEditingItem(false);
  };

  const initiateRoll = (preset: DicePreset, itemName?: string) => {
    if (preset.variables && preset.variables.length > 0) {
      setPendingPreset(preset);
    } else {
      startRoller(preset, {}, itemName);
    }
  };

  const handleVariableConfirm = (values: Record<string, number>) => {
    if (pendingPreset) {
      startRoller(pendingPreset, values);
      setPendingPreset(null);
    }
  };

  const startRoller = (preset: DicePreset, variables: Record<string, number>, itemName?: string) => {
    setActiveRollPreset(preset);
    setActiveRollVars(variables);
    setActiveRollItemName(itemName || activeItem?.name || preset.name || 'Action');
  };

  const closeRoller = () => {
    setActiveRollPreset(null);
    setActiveRollVars({});
    setActiveRollItemName('');
  };

  const addPreset = () => {
    if (!activeItem) return;
    const newPreset: DicePreset = {
      id: generateId(),
      name: 'New Roll',
      variables: [],
      steps: [{ id: generateId(), label: 'Roll', type: 'standard', formula: '1d20', damageType: 'none' }]
    };
    updateActiveItem({ presets: [...activeItem.presets, newPreset] });
  };

  const updatePreset = (index: number, updated: DicePreset) => {
    if (!activeItem) return;
    const newPresets = [...activeItem.presets];
    newPresets[index] = updated;
    updateActiveItem({ presets: newPresets });
  };

  const deletePreset = (index: number) => {
    if (!activeItem) return;
    const newPresets = activeItem.presets.filter((_, i) => i !== index);
    updateActiveItem({ presets: newPresets });
  };

  // Export handler
  const handleExport = async () => {
    const data = await OBRStorage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `die-${playerName || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import handler
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const success = await OBRStorage.importData(text);

    if (success) {
      // Reload data
      const [savedItems, savedStats] = await Promise.all([
        OBRStorage.getItems(),
        OBRStorage.getStats(),
      ]);

      if (savedItems) {
        setItems(savedItems);
        setActiveItemId(savedItems[0]?.id || null);
      }
      if (savedStats) {
        setStats(savedStats);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // If Popover Mode, render Controls
  if (isPopover) {
    return (
      <div className="w-full h-full overflow-hidden bg-transparent">
        <HistoryControl />
      </div>
    );
  }

  // If Left Toolbar Mode, render persistent LeftToolbarPopover
  if (isToolbar) {
    return (
      <div className="w-full h-full overflow-hidden bg-transparent">
        <LeftToolbarPopover />
      </div>
    );
  }

  // If Context Menu Mode, render TokenQuickEditor
  if (isContextMenu) {
    return (
      <div className="w-full h-full overflow-hidden bg-background">
        <TokenQuickEditor />
      </div>
    );
  }



  // Show loading while OBR is initializing
  if (!ready) {
    return (
      <div className="flex h-screen bg-background text-white items-center justify-center">
        <div className="text-center">
          <Icons.Dice size={40} className="mx-auto mb-3 animate-pulse text-white opacity-80" />
          <p className="text-xs font-mono text-muted tracking-wider uppercase">Initializing Virtual Table...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden select-none">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Sidebar */}
      <div className="w-64 border-r border-neutral-800/80 flex flex-col bg-elevated/80 backdrop-blur-md">
        {/* Header Branding */}
        <div className="p-4 border-b border-neutral-800/80">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-surface border border-neutral-700/60 flex items-center justify-center text-white shadow-fey-subtle">
                <Icons.Dice size={16} />
              </span>
              <span>Die</span>
            </h1>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface text-muted border border-neutral-800">
              {APP_VERSION}
            </span>
          </div>
          {isOBR && playerName && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-growth animate-pulse" />
              <p className="text-xs text-muted truncate font-medium">{playerName}</p>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="p-3 space-y-1 border-b border-neutral-800/80">
          <button
            onClick={() => setActiveView('items')}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              activeView === 'items'
                ? "bg-surface text-white border border-neutral-700/80 shadow-fey-subtle"
                : "text-muted hover:text-white hover:bg-surface/40"
            )}
          >
            <Icons.Attack size={14} />
            <span>Inventory</span>
          </button>
          <button
            onClick={() => setActiveView('character')}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              activeView === 'character'
                ? "bg-surface text-white border border-neutral-700/80 shadow-fey-subtle"
                : "text-muted hover:text-white hover:bg-surface/40"
            )}
          >
            <Icons.User size={14} />
            <span>Character</span>
          </button>
          <button
            onClick={() => setActiveView('token')}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              activeView === 'token'
                ? "bg-surface text-white border border-neutral-700/80 shadow-fey-subtle"
                : "text-muted hover:text-white hover:bg-surface/40"
            )}
          >
            <Icons.Target size={14} />
            <span>Token</span>
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              activeView === 'settings'
                ? "bg-surface text-white border border-neutral-700/80 shadow-fey-subtle"
                : "text-muted hover:text-white hover:bg-surface/40"
            )}
          >
            <Icons.Settings size={14} />
            <span>Settings</span>
          </button>
        </div>

        {activeView === 'items' && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="px-2 pb-1 text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                Items ({items.length})
              </div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveItemId(item.id); setEditingItem(false); }}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group",
                    activeItemId === item.id
                      ? "bg-surface text-white border border-neutral-700/90 shadow-fey-subtle"
                      : "text-muted hover:text-white hover:bg-surface/40 border border-transparent"
                  )}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[10px] font-mono opacity-50 group-hover:opacity-100">
                    {item.presets.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-neutral-800/80 space-y-2 bg-background/50">
              <button
                onClick={createItem}
                className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded-full font-bold text-xs hover:bg-pale active:scale-98 transition-all shadow-fey-subtle"
              >
                <Icons.Add size={14} />
                <span>New Item</span>
              </button>

              {/* Export/Import Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-surface text-muted hover:text-white py-1.5 rounded-full text-[11px] font-medium border border-neutral-800 hover:border-neutral-700 transition-all active:scale-98"
                >
                  <Icons.ArrowRight size={11} className="rotate-90 text-mist" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-surface text-muted hover:text-white py-1.5 rounded-full text-[11px] font-medium border border-neutral-800 hover:border-neutral-700 transition-all active:scale-98"
                >
                  <Icons.ArrowRight size={11} className="-rotate-90 text-mist" />
                  <span>Import</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background">

        {activeView === 'character' ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            <div className="flex items-center justify-between px-8 py-3.5 border-b border-neutral-800/80 bg-surface/30">
              <div className="flex items-center gap-2.5">
                <Icons.User size={16} className="text-white" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  {characterSheetMode === 'miro' ? 'Miro Character Board' : 'Character Sheet'}
                </h2>
              </div>

              {/* Mode Toggle Button */}
              <div className="flex items-center bg-elevated border border-neutral-800 rounded-full p-0.5 shadow-inner">
                <button
                  onClick={() => handleSheetModeChange('sheet')}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    characterSheetMode === 'sheet'
                      ? "bg-white text-black shadow-sm font-bold"
                      : "text-muted hover:text-white"
                  )}
                >
                  <Icons.User size={12} />
                  <span>Sheet</span>
                </button>
                <button
                  onClick={() => handleSheetModeChange('miro')}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    characterSheetMode === 'miro'
                      ? "bg-signal text-white shadow-sm font-bold"
                      : "text-muted hover:text-white"
                  )}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 7v10" />
                    <path d="M12 7v10" />
                    <path d="M17 7v10" />
                  </svg>
                  <span>Miro</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {characterSheetMode === 'miro' ? (
                <MiroBoardEmbed />
              ) : (
                <CharacterSheet stats={stats} onChange={setStats} />
              )}
            </div>
          </div>
        ) : activeView === 'token' ? (
          <TokenSettings vitals={daggerheartVitals} />
        ) : activeView === 'settings' ? (
          <div className="flex-1 p-8 overflow-y-auto bg-background">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Icons.Settings size={20} className="text-white" />
                    Settings & Appearance
                  </h2>
                  <p className="text-xs text-muted mt-1">Configure your personal preferences, 3D dice appearance, and campaign data.</p>
                </div>
                <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-elevated text-muted border border-neutral-800">
                  {APP_VERSION}
                </span>
              </div>

              {/* 3D Dice Skin Selector */}
              <div className="p-6 bg-surface/60 rounded-2xl border border-neutral-800/80 shadow-fey-xl">
                <DiceStylePicker
                  currentStyle={diceStyle}
                  onSelect={handleDiceStyleChange}
                />
              </div>

              {/* Data Backup & Restore */}
              <div className="p-6 bg-surface/60 rounded-2xl border border-neutral-800/80 space-y-4 shadow-fey-subtle">
                <div>
                  <h3 className="text-sm font-semibold text-white">Campaign Data & Backup</h3>
                  <p className="text-xs text-muted mt-0.5">Export or import your custom items, dice chains, and character profiles.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-elevated hover:bg-neutral-800 text-white px-4 py-2 rounded-full text-xs font-medium transition-all border border-neutral-800 hover:border-neutral-700 shadow-fey-subtle active:scale-98"
                  >
                    <Icons.ArrowRight size={13} className="rotate-90 text-mist" />
                    <span>Export JSON Backup</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-elevated hover:bg-neutral-800 text-white px-4 py-2 rounded-full text-xs font-medium transition-all border border-neutral-800 hover:border-neutral-700 shadow-fey-subtle active:scale-98"
                  >
                    <Icons.ArrowRight size={13} className="-rotate-90 text-mist" />
                    <span>Import JSON Backup</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          activeItem ? (
            <>
              {/* Header */}
              <div className="p-8 pb-4 border-b border-neutral-800/80 bg-surface/20">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 pr-6">
                      {editingItem ? (
                        <input
                          value={activeItem.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveItem({ name: e.target.value })}
                          className="bg-transparent text-2xl font-bold text-white focus:outline-none border-b border-white/50 w-full tracking-tight"
                          autoFocus
                        />
                      ) : (
                        <h2
                          className="text-2xl font-bold text-white cursor-pointer hover:text-mist tracking-tight transition-colors"
                          onClick={() => setEditingItem(true)}
                        >
                          {activeItem.name}
                        </h2>
                      )}

                      {editingItem ? (
                        <textarea
                          value={activeItem.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateActiveItem({ description: e.target.value })}
                          className="bg-elevated text-muted p-3 rounded-xl border border-neutral-800 mt-3 w-full h-20 focus:outline-none resize-none text-xs leading-relaxed"
                          placeholder="Item description..."
                        />
                      ) : (
                        <p
                          className="text-muted mt-2 text-xs leading-relaxed max-w-2xl cursor-pointer hover:text-mist transition-colors"
                          onClick={() => setEditingItem(true)}
                        >
                          {activeItem.description || "No description provided. Click to edit."}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editingItem ? (
                        <>
                          <button
                            onClick={() => setEditingItem(false)}
                            className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded-full hover:bg-pale active:scale-95 transition-all"
                          >
                            Done
                          </button>
                          <button
                            onClick={deleteActiveItem}
                            className="px-3 py-1.5 bg-elevated text-rose-400 text-xs rounded-full hover:bg-rose-950/30 border border-rose-900/40 transition-all active:scale-95"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingItem(true)}
                          className="px-3.5 py-1.5 bg-surface text-muted hover:text-white text-xs rounded-full border border-neutral-800 hover:border-neutral-700 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Icons.Settings size={12} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Presets List */}
              <div className="flex-1 overflow-y-auto p-8 bg-background">
                <div className="max-w-4xl mx-auto space-y-6">
                  {activeItem.presets.map((preset, idx) => (
                    <div key={preset.id} className="group">
                      {editingItem ? (
                        <DiceChainEditor
                          preset={preset}
                          onUpdate={(u) => updatePreset(idx, u)}
                          onDelete={() => deletePreset(idx)}
                          characterStats={stats}
                        />
                      ) : (
                        <div className="bg-surface/50 border border-neutral-800/90 rounded-2xl p-5 hover:border-neutral-700/80 transition-all shadow-fey-subtle">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <h3 className="text-base font-semibold text-white tracking-tight">
                                {preset.name}
                              </h3>
                              {(preset.variables?.length || 0) > 0 && (
                                <span className="text-[10px] font-mono bg-elevated text-muted px-2.5 py-0.5 rounded-full border border-neutral-800">
                                  {preset.variables?.length} Vars
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => initiateRoll(preset)}
                              className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full font-bold text-xs hover:bg-pale active:scale-95 transition-all shadow-fey-subtle"
                            >
                              <Icons.Dice size={14} />
                              <span>Roll Chain</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {preset.steps.map((step, sIdx) => (
                              <div key={step.id} className="flex items-center text-xs bg-elevated/90 border border-neutral-800/80 rounded-xl px-3 py-1.5 text-muted shadow-sm">
                                <span className="font-mono text-white font-semibold mr-2">
                                  {step.formula || 'DH'}
                                  {step.statModifier && <span className="text-signal ml-1">+{getStatLabel(stats, step.statModifier)}</span>}
                                </span>
                                <span className="text-mist font-medium">{step.label}</span>
                                {step.damageType && step.damageType !== 'none' && (
                                  <span className="ml-1.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-neutral-800 text-muted">
                                    {step.damageType}
                                  </span>
                                )}
                                {step.condition && (
                                  <span className="ml-2 pl-2 border-l border-neutral-800 text-ember font-mono text-[11px]">
                                    if {step.condition.operator} {step.condition.compareTarget === 'variable'
                                      ? (preset.variables?.find(v => v.id === step.condition?.variableId)?.name || 'Var')
                                      : step.condition.value}
                                  </span>
                                )}
                                {sIdx < preset.steps.length - 1 && <Icons.ArrowRight size={10} className="ml-2 text-smoke" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {editingItem && (
                    <button
                      onClick={addPreset}
                      className="w-full py-6 border border-dashed border-neutral-800 rounded-2xl text-muted font-medium hover:border-neutral-700 hover:text-white transition-all flex flex-col items-center justify-center gap-2 bg-surface/20"
                    >
                      <Icons.Add size={20} />
                      <span className="text-xs font-semibold">Add New Dice Chain</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">
              <div className="text-center">
                <Icons.Dice size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-xs font-mono uppercase tracking-wider">Select or create an item to begin</p>
              </div>
            </div>
          )
        )}

        {/* Modals */}
        {pendingPreset && (
          <VariableModal
            variables={pendingPreset.variables || []}
            onConfirm={handleVariableConfirm}
            onCancel={() => setPendingPreset(null)}
          />
        )}

        {/* Roller Overlay */}
        {activeRollPreset && (
          <Roller
            preset={activeRollPreset}
            variables={activeRollVars}
            characterStats={stats}
            itemName={activeRollItemName}
            onClose={closeRoller}
            hideCanvas={false}
            showResultsUI={true}
          />
        )}
      </div>

      {/* History Toggle Button - Available in Plugin Window */}
      {!isOverlay && (
        <>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-4 right-4 z-40 p-3 bg-surface text-mist hover:text-white rounded-full shadow-fey-xl border border-neutral-800 hover:border-neutral-700 transition-all active:scale-95"
            title="Open Roll History"
          >
            <Icons.Menu size={20} />
          </button>

          <RollHistoryPanel
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            history={rollHistory}
          />
        </>
      )}

    </div>
  );
};

export default App;
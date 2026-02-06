
import React, { useState, useEffect, useRef } from 'react';
import { Item, DicePreset, StepResult, CharacterStats } from './types';
import { generateId, getStatLabel } from './utils/engine';
import { DiceChainEditor } from './components/DiceChainEditor';
import { Roller } from './components/Roller';
import { VariableModal } from './components/VariableModal';
import { CharacterSheet } from './components/CharacterSheet';
import { HistoryControl } from './components/HistoryControl';
import { RollHistoryPanel, HistoryEntry } from './components/RollHistoryPanel';
import { TokenSettings } from './components/TokenSettings';
import { Icons } from './components/ui/Icons';
import { useOBR, OBRStorage, OBRBroadcast, DiceRollMessage, RollCompleteMessage, DaggerheartVitals } from './obr';
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

  // Overlay / Popover Mode Detection
  const [isOverlay, setIsOverlay] = useState(false);
  const [isPopover, setIsPopover] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setIsOverlay(query.get('overlay') === 'true');
    setIsPopover(query.get('popover') === 'true');
  }, []);

  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [stats, setStats] = useState<CharacterStats>(INITIAL_STATS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'items' | 'character' | 'token'>('items');
  const [editingItem, setEditingItem] = useState<boolean>(false);
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
      } else if (message.type === 'STAT_ROLL_REQUEST') {
        // Handle stat roll from fullscreen CharacterPanel
        const { statKey, statValue, statLabel } = message;

        // Create a temporary preset for this roll
        const statRollPreset: DicePreset = {
          id: `stat-roll-${statKey}`,
          name: `${statLabel} Check`,
          variables: [],
          steps: [{
            id: 'dh_stat_roll',
            label: `${statLabel} Check`,
            type: 'daggerheart',
            formula: `2d12+${statValue}`,
            damageType: 'none',
            addToSum: true
          }]
        };

        initiateRoll(statRollPreset);
      }
    });
    return () => unsubscribe();
  }, [playerId, playerName, playerMetaCache]);
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
        console.log("Loading FateWeaver data...");
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
      } catch (e) {
        console.error("Error loading data:", e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
  }, [ready, isOverlay, isPopover]);

  // Open the overlay window on mount (if acting as controller)
  useEffect(() => {
    if (ready && isOBR && !isOverlay) {
      // We are the controller. Try to open the overlay AND the popover.
      import('@owlbear-rodeo/sdk').then(({ default: OBR }) => {
        // 1. Visual Overlay (Fullscreen, Non-Interactive)
        // Ensure legacy overlay is closed - We only use Popover now
        OBR.modal.close('com.fateweaver.dice.overlay');

        // 2. Interactive Controls (Popover, Anchored Bottom-Right)
        OBR.popover.open({
          id: 'com.fateweaver.dice.controls',
          url: window.location.pathname + '?popover=true',
          width: 60,
          height: 60,
          anchorOrigin: { horizontal: 'RIGHT', vertical: 'BOTTOM' },
          disableClickAway: true,
          hidePaper: true,
        }).catch(e => console.error("Failed to open popover:", e));
      });
    }
  }, [ready, isOBR, isOverlay, isPopover]);

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

  // Listen for storage changes to sync stats from fullscreen to main window
  useEffect(() => {
    const handleStorageChange = async () => {
      const newStats = await OBRStorage.getStats();
      if (newStats) {
        statsFromStorageRef.current = true;
        setStats(newStats);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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

  const initiateRoll = (preset: DicePreset) => {
    if (preset.variables && preset.variables.length > 0) {
      setPendingPreset(preset);
    } else {
      startRoller(preset, {});
    }
  };

  const handleVariableConfirm = (values: Record<string, number>) => {
    if (pendingPreset) {
      startRoller(pendingPreset, values);
      setPendingPreset(null);
    }
  };

  const startRoller = (preset: DicePreset, variables: Record<string, number>) => {
    setActiveRollPreset(preset);
    setActiveRollVars(variables);
    setActiveRollItemName(activeItem?.name || 'Unknown Item');
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
    a.download = `fateweaver-${playerName || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
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



  // Show loading while OBR is initializing
  if (!ready) {
    return (
      <div className="flex h-screen bg-background text-primary items-center justify-center">
        <div className="text-center">
          <Icons.Dice size={48} className="mx-auto mb-4 animate-pulse text-accent" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-primary font-sans overflow-hidden">
      {/* SharedDiceOverlay removed from Controller view to prevent double-popups */}
      {/* <SharedDiceOverlay /> */}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-zinc-950/50">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Icons.Dice className="text-accent" />
            FateWeaver
          </h1>
          {isOBR && playerName && (
            <p className="text-xs text-zinc-500 mt-1">{playerName}</p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="p-2 space-y-1 border-b border-border">
          <button
            onClick={() => setActiveView('items')}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all font-medium",
              activeView === 'items'
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            )}
          >
            <Icons.Attack size={16} /> Inventory
          </button>
          <button
            onClick={() => setActiveView('character')}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all font-medium",
              activeView === 'character'
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            )}
          >
            <Icons.User size={16} /> Character
          </button>
          <button
            onClick={() => setActiveView('token')}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all font-medium",
              activeView === 'token'
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            )}
          >
            <Icons.Target size={16} /> Token
          </button>
        </div>

        {activeView === 'items' && (
          <>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="px-2 pb-1 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Items</div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveItemId(item.id); setEditingItem(false); }}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                    activeItemId === item.id
                      ? "bg-surface text-white border border-border shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-surface/50"
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <button
                onClick={createItem}
                className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded-md font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                <Icons.Add size={16} /> New Item
              </button>

              {/* Export/Import Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-1 bg-zinc-800 text-zinc-300 py-1.5 rounded-md text-xs hover:bg-zinc-700 transition-colors"
                >
                  <Icons.ArrowRight size={12} className="rotate-90" /> Export
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1 bg-zinc-800 text-zinc-300 py-1.5 rounded-md text-xs hover:bg-zinc-700 transition-colors"
                >
                  <Icons.ArrowRight size={12} className="-rotate-90" /> Import
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {activeView === 'character' ? (
          <CharacterSheet stats={stats} onChange={setStats} />
        ) : activeView === 'token' ? (
          <TokenSettings vitals={daggerheartVitals} />
        ) : (
          activeItem ? (
            <>
              {/* Header */}
              <div className="p-8 pb-4 border-b border-border bg-gradient-to-b from-surface to-background">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      {editingItem ? (
                        <input
                          value={activeItem.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveItem({ name: e.target.value })}
                          className="bg-transparent text-3xl font-bold text-white focus:outline-none border-b border-accent/50 w-full"
                          autoFocus
                        />
                      ) : (
                        <h2
                          className="text-3xl font-bold text-white cursor-pointer hover:text-zinc-200"
                          onClick={() => setEditingItem(true)}
                        >
                          {activeItem.name}
                        </h2>
                      )}

                      {editingItem ? (
                        <textarea
                          value={activeItem.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateActiveItem({ description: e.target.value })}
                          className="bg-transparent text-zinc-400 mt-2 w-full h-20 focus:outline-none resize-none text-sm"
                          placeholder="Item description..."
                        />
                      ) : (
                        <p
                          className="text-zinc-400 mt-2 text-sm leading-relaxed max-w-2xl cursor-pointer hover:text-zinc-300"
                          onClick={() => setEditingItem(true)}
                        >
                          {activeItem.description || "No description provided."}
                        </p>
                      )}
                    </div>

                    {editingItem && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingItem(false)}
                          className="px-4 py-2 bg-zinc-800 text-white text-xs rounded hover:bg-zinc-700"
                        >
                          Done
                        </button>
                        <button
                          onClick={deleteActiveItem}
                          className="px-4 py-2 bg-red-500/10 text-red-500 text-xs rounded hover:bg-red-500/20 border border-red-500/20"
                        >
                          Delete Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Presets List */}
              <div className="flex-1 overflow-y-auto p-8 bg-zinc-950">
                <div className="max-w-4xl mx-auto space-y-8">
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
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-zinc-200 flex items-center gap-3">
                              {preset.name}
                              {(preset.variables?.length || 0) > 0 && (
                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-normal">
                                  {preset.variables?.length} Vars
                                </span>
                              )}
                            </h3>
                            <button
                              onClick={() => initiateRoll(preset)}
                              className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm hover:bg-accent hover:text-white transition-all shadow-lg shadow-white/5"
                            >
                              <Icons.Dice size={16} /> Roll
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {preset.steps.map((step, sIdx) => (
                              <div key={step.id} className="flex items-center text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-400">
                                <span className="font-mono text-zinc-300 mr-2">
                                  {step.formula || 'DH'}
                                  {step.statModifier && <span className="text-accent ml-1">+{getStatLabel(stats, step.statModifier)}</span>}
                                </span>
                                <span>{step.label}</span>
                                {step.condition && (
                                  <span className="ml-2 pl-2 border-l border-zinc-800 text-yellow-600/80">
                                    if {step.condition.operator} {step.condition.compareTarget === 'variable'
                                      ? (preset.variables?.find(v => v.id === step.condition?.variableId)?.name || 'Var')
                                      : step.condition.value}
                                  </span>
                                )}
                                {sIdx < preset.steps.length - 1 && <Icons.ArrowRight size={10} className="ml-2 text-zinc-700" />}
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
                      className="w-full py-8 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600 font-medium hover:border-zinc-700 hover:text-zinc-400 transition-all flex flex-col items-center gap-2"
                    >
                      <Icons.Add size={24} />
                      Add New Dice Chain
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <Icons.Dice size={48} className="mx-auto mb-4 opacity-20" />
                <p>Select or create an item to begin weaving fate.</p>
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
            hideCanvas={isOBR} // Hide 3D canvas in main window if in OBR (overlay handles it)
            showResultsUI={!isOBR} // Only show results UI in local dev. In OBR, the Overlay handles it.
          />
        )}
      </div>

      {/* History Toggle Button - Available in Plugin Window */}
      {!isOverlay && (
        <>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="fixed bottom-4 right-4 z-40 p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full shadow-lg border border-zinc-700 transition-all active:scale-95"
            title="Open Roll History"
          >
            <Icons.Menu size={24} />
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
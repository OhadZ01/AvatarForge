import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AvatarConfig, EthnicityMorphs, ColorConfig, SlotAssignments } from '@/domain/schemas';
import type { AssetSlot } from '@/domain/constants';
import { createDefaultAvatarConfig } from '@/domain/defaults';

interface HistoryEntry {
  config: AvatarConfig;
  timestamp: number;
}

interface AvatarState {
  config: AvatarConfig;
  history: HistoryEntry[];
  historyIndex: number;
  isDirty: boolean;

  // Ethnicity morphs
  setEthnicityMorph: (key: keyof EthnicityMorphs, value: number) => void;
  setEthnicityMorphs: (morphs: Partial<EthnicityMorphs>) => void;

  // Face detail morphs
  setFaceDetailMorph: (key: string, value: number) => void;
  setFaceDetailMorphs: (morphs: Record<string, number>) => void;

  // Body detail morphs
  setBodyDetailMorph: (key: string, value: number) => void;
  setBodyDetailMorphs: (morphs: Record<string, number>) => void;

  // Colors
  setColor: (key: keyof ColorConfig, value: string) => void;
  setColors: (colors: Partial<ColorConfig>) => void;

  // Slots & expression
  setSlot: (slot: AssetSlot, assetId: string | null) => void;
  setExpression: (expression: string) => void;
  setName: (name: string) => void;

  // Config management
  loadConfig: (config: AvatarConfig) => void;
  resetConfig: () => void;
  resetSlots: () => void;
  resetMorphs: () => void;
  resetColors: () => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markClean: () => void;
}

const MAX_HISTORY = 50;

function pushHistory(state: AvatarState): Pick<AvatarState, 'history' | 'historyIndex' | 'isDirty'> {
  const entry: HistoryEntry = {
    config: structuredClone(state.config),
    timestamp: Date.now(),
  };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(entry);
  if (newHistory.length > MAX_HISTORY) newHistory.shift();
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
    isDirty: true,
  };
}

export const useAvatarStore = create<AvatarState>()(
  subscribeWithSelector((set, get) => ({
    config: createDefaultAvatarConfig(),
    history: [{ config: createDefaultAvatarConfig(), timestamp: Date.now() }],
    historyIndex: 0,
    isDirty: false,

    setEthnicityMorph: (key, value) =>
      set((state) => {
        const config = {
          ...state.config,
          ethnicityMorphs: { ...state.config.ethnicityMorphs, [key]: Math.max(0, Math.min(1, value)) },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setEthnicityMorphs: (morphs) =>
      set((state) => {
        const clamped = Object.fromEntries(
          Object.entries(morphs).map(([k, v]) => [k, Math.max(0, Math.min(1, v))])
        );
        const config = {
          ...state.config,
          ethnicityMorphs: { ...state.config.ethnicityMorphs, ...clamped },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setFaceDetailMorph: (key, value) =>
      set((state) => {
        const config = {
          ...state.config,
          faceDetailMorphs: { ...state.config.faceDetailMorphs, [key]: Math.max(0, Math.min(1, value)) },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setFaceDetailMorphs: (morphs) =>
      set((state) => {
        const clamped = Object.fromEntries(
          Object.entries(morphs).map(([k, v]) => [k, Math.max(0, Math.min(1, v))])
        );
        const config = {
          ...state.config,
          faceDetailMorphs: { ...state.config.faceDetailMorphs, ...clamped },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setBodyDetailMorph: (key, value) =>
      set((state) => {
        const config = {
          ...state.config,
          bodyDetailMorphs: { ...(state.config.bodyDetailMorphs || {}), [key]: Math.max(0, Math.min(1, value)) },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setBodyDetailMorphs: (morphs) =>
      set((state) => {
        const clamped = Object.fromEntries(
          Object.entries(morphs).map(([k, v]) => [k, Math.max(0, Math.min(1, v))])
        );
        const config = {
          ...state.config,
          bodyDetailMorphs: { ...(state.config.bodyDetailMorphs || {}), ...clamped },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setColor: (key, value) =>
      set((state) => {
        const config = {
          ...state.config,
          colors: { ...state.config.colors, [key]: value },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setColors: (colors) =>
      set((state) => {
        const config = {
          ...state.config,
          colors: { ...state.config.colors, ...colors },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setSlot: (slot, assetId) =>
      set((state) => {
        const config = {
          ...state.config,
          slots: { ...state.config.slots, [slot]: assetId },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    setExpression: (expression) =>
      set((state) => ({
        config: { ...state.config, expression },
      })),

    setName: (name) =>
      set((state) => ({
        config: { ...state.config, name },
        isDirty: true,
      })),

    loadConfig: (config) =>
      set(() => ({
        config: structuredClone(config),
        history: [{ config: structuredClone(config), timestamp: Date.now() }],
        historyIndex: 0,
        isDirty: false,
      })),

    resetConfig: () => {
      const config = createDefaultAvatarConfig();
      set((state) => ({
        config,
        ...pushHistory({ ...state, config }),
      }));
    },

    resetSlots: () =>
      set((state) => {
        const config = {
          ...state.config,
          slots: { hair: null, top: null, bottom: null, shoes: null, hat: null, glasses: null, accessory: null },
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    resetMorphs: () =>
      set((state) => {
        const defaults = createDefaultAvatarConfig();
        const config = {
          ...state.config,
          ethnicityMorphs: defaults.ethnicityMorphs,
          faceDetailMorphs: defaults.faceDetailMorphs,
          bodyDetailMorphs: defaults.bodyDetailMorphs,
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    resetColors: () =>
      set((state) => {
        const defaults = createDefaultAvatarConfig();
        const config = {
          ...state.config,
          colors: defaults.colors,
        };
        return { config, ...pushHistory({ ...state, config }) };
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return state;
        const newIndex = state.historyIndex - 1;
        return {
          config: structuredClone(state.history[newIndex].config),
          historyIndex: newIndex,
          isDirty: true,
        };
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const newIndex = state.historyIndex + 1;
        return {
          config: structuredClone(state.history[newIndex].config),
          historyIndex: newIndex,
          isDirty: true,
        };
      }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    markClean: () => set({ isDirty: false }),
  }))
);

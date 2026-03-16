'use client';

import { useEffect, useRef } from 'react';
import { useAvatarStore } from '@/store';
import { saveDraft, loadDraft } from '@/services/persistence';

const AUTOSAVE_INTERVAL = 3000;

/**
 * Autosave hook — saves draft to localStorage every 3s when dirty.
 * Also loads draft on mount if one exists.
 */
export function useAutosave() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start fresh on each page load — don't restore draft
  // Users can save/load via Presets panel if they want persistence
  useEffect(() => {
    useAvatarStore.getState().resetConfig();
  }, []);

  // Autosave interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const state = useAvatarStore.getState();
      if (state.isDirty) {
        saveDraft(state.config);
        state.markClean();
      }
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}

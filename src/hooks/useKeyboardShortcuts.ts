'use client';

import { useEffect } from 'react';
import { useAvatarStore } from '@/store';

/**
 * Global keyboard shortcuts for undo/redo.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCmd = e.metaKey || e.ctrlKey;

      if (isCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useAvatarStore.getState().undo();
      }
      if (isCmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useAvatarStore.getState().redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

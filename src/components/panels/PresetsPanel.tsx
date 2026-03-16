'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Upload, Download, Save } from 'lucide-react';
import { useAvatarStore } from '@/store';
import { loadPresets, savePreset, deletePreset, importConfigFromJson } from '@/services/persistence';
import type { Preset } from '@/domain/schemas';

export default function PresetsPanel() {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [newName, setNewName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const config = useAvatarStore((s) => s.config);
  const loadConfig = useAvatarStore((s) => s.loadConfig);
  const resetConfig = useAvatarStore((s) => s.resetConfig);

  const handleSave = useCallback(() => {
    if (!newName.trim()) return;
    const preset: Preset = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      config: structuredClone(config),
      createdAt: new Date().toISOString(),
    };
    savePreset(preset);
    setPresets(loadPresets());
    setNewName('');
    setShowSaveForm(false);
  }, [newName, config]);

  const handleDelete = useCallback((id: string) => {
    deletePreset(id);
    setPresets(loadPresets());
  }, []);

  const handleLoad = useCallback(
    (preset: Preset) => {
      loadConfig(preset.config);
    },
    [loadConfig],
  );

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const imported = await importConfigFromJson(file);
        loadConfig(imported);
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    input.click();
  }, [loadConfig]);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Presets</h3>
        <p className="text-xs text-surface-500 mt-0.5">Save and load avatar configurations</p>
      </div>

      {/* Actions */}
      <div className="px-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveForm(!showSaveForm)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Current
          </button>
          <button
            onClick={handleImport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700/50 text-surface-300 hover:bg-surface-600/50 text-xs font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
        </div>

        <AnimatePresence>
          {showSaveForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-600 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={resetConfig}
          className="text-xs text-surface-500 hover:text-red-400 transition-colors text-center py-1"
        >
          Reset to defaults
        </button>
      </div>

      {/* Saved presets */}
      <div className="px-3 flex flex-col gap-1.5">
        {presets.length === 0 ? (
          <p className="text-xs text-surface-500 text-center py-6">No saved presets yet</p>
        ) : (
          presets.map((preset) => (
            <motion.div
              key={preset.id}
              layout
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-800/60 border border-surface-700/50 group"
            >
              <button
                onClick={() => handleLoad(preset)}
                className="flex-1 text-left"
              >
                <p className="text-xs font-medium text-surface-200">{preset.name}</p>
                <p className="text-[10px] text-surface-500">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </p>
              </button>
              <button
                onClick={() => handleDelete(preset.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

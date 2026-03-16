'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Scissors,
  Shirt,
  Watch,
  User,
  Palette,
  BookMarked,
  Download,
  Search,
  X,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useUIStore, useAvatarStore } from '@/store';
import type { SidebarTab } from '@/store';

import PhotoPanel from '@/components/panels/PhotoPanel';
import HairPanel from '@/components/panels/HairPanel';
import ClothingPanel from '@/components/panels/ClothingPanel';
import AccessoriesPanel from '@/components/panels/AccessoriesPanel';
import BodyPanel from '@/components/panels/BodyPanel';
import ColorsPanel from '@/components/panels/ColorsPanel';
import PresetsPanel from '@/components/panels/PresetsPanel';
import ExportPanel from '@/components/panels/ExportPanel';

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof Scissors }> = [
  { id: 'photo', label: 'Photo', icon: Camera },
  { id: 'hair', label: 'Hair', icon: Scissors },
  { id: 'clothing', label: 'Clothing', icon: Shirt },
  { id: 'accessories', label: 'Acc.', icon: Watch },
  { id: 'body', label: 'Body', icon: User },
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'presets', label: 'Presets', icon: BookMarked },
  { id: 'export', label: 'Export', icon: Download },
];

const PANEL_MAP: Record<SidebarTab, React.ComponentType> = {
  photo: PhotoPanel,
  hair: HairPanel,
  clothing: ClothingPanel,
  accessories: AccessoriesPanel,
  body: BodyPanel,
  colors: ColorsPanel,
  presets: PresetsPanel,
  export: ExportPanel,
};

export default function Sidebar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const canUndo = useAvatarStore((s) => s.canUndo());
  const canRedo = useAvatarStore((s) => s.canRedo());
  const undo = useAvatarStore((s) => s.undo);
  const redo = useAvatarStore((s) => s.redo);

  const showSearch = activeTab === 'hair' || activeTab === 'clothing' || activeTab === 'accessories';

  const ActivePanel = useMemo(() => PANEL_MAP[activeTab], [activeTab]);

  return (
    <div className="flex flex-col h-full bg-surface-900/95 backdrop-blur-xl border-l border-surface-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50">
        <h2 className="text-sm font-semibold text-surface-200 tracking-wide">Customize</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-surface-700/50 disabled:opacity-30 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-surface-400" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-surface-700/50 disabled:opacity-30 transition-all"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5 text-surface-400" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 px-2 py-2 border-b border-surface-700/50 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg min-w-[48px] transition-colors
                ${isActive ? 'text-white' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-accent/15 border border-accent/20 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="text-[9px] font-medium relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search (for asset tabs) */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-surface-700/50"
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-surface-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="flex-1 bg-transparent text-xs text-white placeholder-surface-500 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-3.5 h-3.5 text-surface-500 hover:text-surface-300" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-700 py-3">
        <ActivePanel />
      </div>
    </div>
  );
}

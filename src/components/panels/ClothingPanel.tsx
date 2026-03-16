'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AssetGrid from '@/components/ui/AssetGrid';

type ClothingTab = 'tops' | 'bottoms';

export default function ClothingPanel() {
  const [activeTab, setActiveTab] = useState<ClothingTab>('tops');

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Clothing</h3>
        <p className="text-xs text-surface-500 mt-0.5">Dress your avatar</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-3">
        {(['tops', 'bottoms'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              relative px-4 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize
              ${activeTab === tab
                ? 'text-white'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
              }
            `}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="clothingTab"
                className="absolute inset-0 bg-surface-700 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      <AssetGrid
        category={activeTab}
        slotOverride={activeTab === 'tops' ? 'top' : 'bottom'}
      />
    </div>
  );
}

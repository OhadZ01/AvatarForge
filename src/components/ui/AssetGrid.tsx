'use client';

import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PackageOpen, Loader2 } from 'lucide-react';
import { AssetCard } from './AssetCard';
import { useAssets } from '@/hooks/useAssets';
import { useAvatarStore, useUIStore } from '@/store';
import type { AssetCategory, AssetSlot } from '@/domain/constants';
import { CATEGORY_TO_SLOTS } from '@/domain/constants';

interface AssetGridProps {
  category: AssetCategory;
  /** Override which slot this grid controls (for accessories sub-types) */
  slotOverride?: AssetSlot;
}

export default function AssetGrid({ category, slotOverride }: AssetGridProps) {
  const searchQuery = useUIStore((s) => s.searchQuery);
  const { items, isLoading, error } = useAssets(category, searchQuery);
  const slots = useAvatarStore((s) => s.config.slots);
  const setSlot = useAvatarStore((s) => s.setSlot);
  const loadingAssets = useUIStore((s) => s.loadingAssets);

  const targetSlots = useMemo(
    () => slotOverride ? [slotOverride] : CATEGORY_TO_SLOTS[category],
    [slotOverride, category],
  );

  const handleSelect = useCallback(
    (assetId: string) => {
      const slot = targetSlots[0];
      const currentId = slots[slot];
      setSlot(slot, currentId === assetId ? null : assetId);
    },
    [targetSlots, slots, setSlot],
  );

  const isSelected = (assetId: string) => {
    return targetSlots.some((slot) => slots[slot] === assetId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-surface-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-red-400">Failed to load assets</p>
        <p className="text-xs text-surface-500 mt-1">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <PackageOpen className="w-8 h-8 text-surface-500 mb-2" />
        <p className="text-sm text-surface-400">
          {searchQuery ? 'No matching assets' : 'No assets available'}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-3 gap-2 p-1"
      initial={false}
    >
      <AnimatePresence mode="sync">
        {items.map((item) => (
          <AssetCard
            key={item.id}
            item={item}
            category={category}
            isSelected={isSelected(item.id)}
            isLoading={loadingAssets.has(item.id)}
            onSelect={handleSelect}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

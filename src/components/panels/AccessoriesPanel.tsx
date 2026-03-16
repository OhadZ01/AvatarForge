'use client';

import AssetGrid from '@/components/ui/AssetGrid';

export default function AccessoriesPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Accessories</h3>
        <p className="text-xs text-surface-500 mt-0.5">Shoes, hats, and more</p>
      </div>
      <AssetGrid category="accessories" slotOverride="shoes" />
    </div>
  );
}

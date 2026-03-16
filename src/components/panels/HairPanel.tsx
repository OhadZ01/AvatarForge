'use client';

import AssetGrid from '@/components/ui/AssetGrid';

export default function HairPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Hairstyles</h3>
        <p className="text-xs text-surface-500 mt-0.5">Choose a hairstyle for your avatar</p>
      </div>
      <AssetGrid category="hair" slotOverride="hair" />
    </div>
  );
}

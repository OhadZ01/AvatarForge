'use client';

import { useAvatarStore } from '@/store';
import { ColorPicker } from '@/components/ui/ColorPicker';
import type { ColorConfig } from '@/domain/schemas';

export default function ColorsPanel() {
  const colors = useAvatarStore((s) => s.config.colors);
  const setColor = useAvatarStore((s) => s.setColor);
  const resetColors = useAvatarStore((s) => s.resetColors);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Colors</h3>
        <p className="text-xs text-surface-500 mt-0.5">Customize skin, hair, and eye colors</p>
      </div>

      <div className="px-3 flex flex-col gap-1">
        <ColorPicker
          label="Skin"
          value={colors.skin}
          onChange={(c) => setColor('skin' as keyof ColorConfig, c)}
        />
        <ColorPicker
          label="Hair"
          value={colors.hair}
          onChange={(c) => setColor('hair' as keyof ColorConfig, c)}
        />
        <ColorPicker
          label="Eye"
          value={colors.eye}
          onChange={(c) => setColor('eye' as keyof ColorConfig, c)}
        />

        <button
          onClick={resetColors}
          className="mt-3 text-xs text-surface-400 hover:text-accent transition-colors text-center py-2"
        >
          Reset to default colors
        </button>
      </div>
    </div>
  );
}

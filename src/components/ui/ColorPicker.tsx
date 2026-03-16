'use client';

import { memo, useCallback, useState } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  presets?: string[];
  onChange: (color: string) => void;
}

const SKIN_PRESETS = ['#f5d6b8', '#e8c4a0', '#d4a574', '#c8956c', '#a67c52', '#8b6c47', '#6b4423', '#4a2f17'];
const HAIR_PRESETS = ['#f5e6c8', '#d4a253', '#8b4513', '#3d2314', '#1a0f0a', '#8b0000', '#4a0082', '#1a1a2e'];
const EYE_PRESETS = ['#8fbc8f', '#5b7553', '#4a8c62', '#6b8e23', '#8b7355', '#4682b4', '#708090', '#2f4f4f'];

const PRESET_MAP: Record<string, string[]> = {
  skin: SKIN_PRESETS,
  hair: HAIR_PRESETS,
  eye: EYE_PRESETS,
};

export const ColorPicker = memo(function ColorPicker({
  label,
  value,
  presets,
  onChange,
}: ColorPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorPresets = presets || PRESET_MAP[label.toLowerCase()] || [];

  const handlePresetClick = useCallback(
    (color: string) => {
      onChange(color);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-300 capitalize">{label} Color</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-7 h-7 rounded-lg border-2 border-surface-600 transition-all hover:border-surface-400 shadow-inner"
            style={{ backgroundColor: value }}
            title="Click to expand"
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-0 h-0 opacity-0 absolute"
            id={`color-${label}`}
          />
          <label
            htmlFor={`color-${label}`}
            className="text-[10px] font-mono text-surface-500 cursor-pointer hover:text-surface-300 transition-colors uppercase"
          >
            {value}
          </label>
        </div>
      </div>

      {/* Preset swatches — always visible */}
      <div className="flex flex-wrap gap-1.5">
        {colorPresets.map((color) => (
          <button
            key={color}
            onClick={() => handlePresetClick(color)}
            className={`
              w-6 h-6 rounded-md border-2 transition-all hover:scale-110
              ${value === color ? 'border-accent shadow-md shadow-accent/30' : 'border-surface-600 hover:border-surface-400'}
            `}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
});

'use client';

import { memo, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

interface MorphSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export const MorphSlider = memo(function MorphSlider({
  label,
  value,
  min = -1,
  max = 1,
  step = 0.01,
  onChange,
}: MorphSliderProps) {
  const handleReset = useCallback(() => onChange(0), [onChange]);
  const percentage = ((value - min) / (max - min)) * 100;
  const displayLabel = label
    .replace(/^(body_|face_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="group flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-300">{displayLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-500 w-10 text-right">
            {value.toFixed(2)}
          </span>
          {value !== 0 && (
            <button
              onClick={handleReset}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-700"
              title="Reset to 0"
            >
              <RotateCcw className="w-3 h-3 text-surface-400" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 appearance-none bg-surface-700 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125
          "
          style={{
            background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${percentage}%, rgb(51, 65, 85) ${percentage}%, rgb(51, 65, 85) 100%)`,
          }}
        />
      </div>
    </div>
  );
});

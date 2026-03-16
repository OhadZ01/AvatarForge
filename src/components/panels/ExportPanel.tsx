'use client';

import { useState, useCallback } from 'react';
import { Camera, FileJson, Download, Check, Loader2 } from 'lucide-react';
import { useAvatarStore } from '@/store';
import { exportConfigAsJson } from '@/services/persistence';

export default function ExportPanel() {
  const config = useAvatarStore((s) => s.config);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done'>('idle');

  const handleExportJson = useCallback(() => {
    exportConfigAsJson(config);
  }, [config]);

  const handleScreenshot = useCallback(async () => {
    setScreenshotStatus('capturing');
    try {
      // Find the canvas element
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `avatar-${config.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      setScreenshotStatus('done');
      setTimeout(() => setScreenshotStatus('idle'), 2000);
    } catch (err) {
      console.error('Screenshot failed:', err);
      setScreenshotStatus('idle');
    }
  }, [config.name]);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Export</h3>
        <p className="text-xs text-surface-500 mt-0.5">Save your avatar in different formats</p>
      </div>

      <div className="px-3 flex flex-col gap-2.5">
        {/* Screenshot */}
        <button
          onClick={handleScreenshot}
          disabled={screenshotStatus === 'capturing'}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-800/60 border border-surface-700/50 hover:border-accent/30 hover:bg-surface-700/60 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            {screenshotStatus === 'capturing' ? (
              <Loader2 className="w-4.5 h-4.5 text-blue-400 animate-spin" />
            ) : screenshotStatus === 'done' ? (
              <Check className="w-4.5 h-4.5 text-green-400" />
            ) : (
              <Camera className="w-4.5 h-4.5 text-blue-400" />
            )}
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-surface-200">Screenshot</p>
            <p className="text-[10px] text-surface-500">Save as PNG image</p>
          </div>
        </button>

        {/* JSON Config */}
        <button
          onClick={handleExportJson}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-800/60 border border-surface-700/50 hover:border-accent/30 hover:bg-surface-700/60 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
            <FileJson className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-surface-200">Configuration</p>
            <p className="text-[10px] text-surface-500">Export avatar settings as JSON</p>
          </div>
        </button>

        {/* GLB Export (future) */}
        <button
          disabled
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-800/60 border border-surface-700/30 opacity-50 cursor-not-allowed"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Download className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-surface-300">3D Model (GLB)</p>
            <p className="text-[10px] text-surface-500">Coming soon — assembled avatar export</p>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="px-3 mt-2">
        <div className="px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/10">
          <p className="text-[10px] text-surface-400 leading-relaxed">
            The JSON configuration file can be re-imported later to restore your avatar exactly as configured.
          </p>
        </div>
      </div>
    </div>
  );
}

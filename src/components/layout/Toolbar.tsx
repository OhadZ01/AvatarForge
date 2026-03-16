'use client';

import { motion } from 'framer-motion';
import { Eye, Maximize2, User, ScanFace } from 'lucide-react';
import { useUIStore } from '@/store';

const CAMERA_VIEWS = [
  { id: 'fullBody' as const, label: 'Full', icon: Maximize2 },
  { id: 'upper' as const, label: 'Upper', icon: User },
  { id: 'face' as const, label: 'Face', icon: ScanFace },
];

export default function Toolbar() {
  const cameraPreset = useUIStore((s) => s.cameraPreset);
  const setCameraPreset = useUIStore((s) => s.setCameraPreset);
  const isLoading = useUIStore((s) => s.isBaseModelLoading);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
      {/* Camera views */}
      <div className="flex items-center gap-1 bg-surface-900/80 backdrop-blur-xl rounded-xl border border-surface-700/50 p-1">
        <div className="px-2 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-surface-400" />
        </div>
        {CAMERA_VIEWS.map((view) => {
          const Icon = view.icon;
          const isActive = cameraPreset === view.id;
          return (
            <button
              key={view.id}
              onClick={() => setCameraPreset(view.id)}
              className={`
                relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5
                ${isActive ? 'text-white' : 'text-surface-400 hover:text-surface-200'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="cameraView"
                  className="absolute inset-0 bg-surface-700/80 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{view.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-900/80 backdrop-blur-xl rounded-xl border border-surface-700/50"
        >
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="text-[10px] text-surface-400 font-medium">Loading model...</span>
        </motion.div>
      )}
    </div>
  );
}

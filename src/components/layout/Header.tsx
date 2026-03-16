'use client';

import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-surface-950/90 backdrop-blur-xl border-b border-surface-700/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-lg shadow-accent/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">AvatarForge</h1>
          <p className="text-[10px] text-surface-500 -mt-0.5">3D Avatar Creator</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[10px] font-mono text-surface-600 px-2 py-0.5 bg-surface-800/50 rounded-md">
          v2.0
        </span>
      </div>
    </header>
  );
}

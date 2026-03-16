'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import Toolbar from '@/components/layout/Toolbar';
import { useAutosave, useKeyboardShortcuts } from '@/hooks';

// Lazy load the 3D scene — it pulls in Three.js which is heavy
const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-surface-400 font-medium">Initializing 3D engine...</p>
      </div>
    </div>
  ),
});

/**
 * The base model URL. In the old app this came from a backend API.
 * In the rebuild, we serve it from /public/models/ for standalone operation.
 * When a backend is connected, this can be swapped to a dynamic URL.
 */
const BASE_MODEL_URL = '/models/mpfb2_body.glb';

export default function AvatarCreatorPage() {
  useAutosave();
  useKeyboardShortcuts();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Viewport — hero area */}
        <div className="flex-1 relative bg-surface-950">
          <Toolbar />
          <AvatarScene modelUrl={BASE_MODEL_URL} />

          {/* Gradient overlays for premium look */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface-950/60 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-surface-950/30 to-transparent" />
          </div>
        </div>

        {/* Sidebar — right side */}
        <div className="w-[340px] flex-shrink-0">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}

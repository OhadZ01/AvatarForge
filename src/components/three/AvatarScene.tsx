'use client';

import { Suspense, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '@/store';
import { CAMERA_PRESETS } from '@/domain/constants';
import AvatarModel from './AvatarModel';

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-surface-400 whitespace-nowrap font-medium">Loading model...</p>
      </div>
    </Html>
  );
}

interface SceneContentProps {
  modelUrl: string;
  controlsRef: React.RefObject<any>; // OrbitControls type from drei is complex
}

function SceneContent({ modelUrl, controlsRef }: SceneContentProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />

      {/* Environment */}
      <Environment preset="studio" />

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />

      {/* Avatar */}
      <Suspense fallback={<Loader />}>
        <AvatarModel url={modelUrl} />
      </Suspense>

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        minDistance={0.6}
        maxDistance={6}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.85}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0.9, 0]}
      />
    </>
  );
}

interface AvatarSceneProps {
  modelUrl: string;
  className?: string;
}

export default function AvatarScene({ modelUrl, className = '' }: AvatarSceneProps) {
  const controlsRef = useRef<any>(null); // OrbitControls type from drei
  const cameraPreset = useUIStore((s) => s.cameraPreset);

  // Animate camera to preset position
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const preset = CAMERA_PRESETS[cameraPreset];
    const targetPos = new THREE.Vector3(...preset.position);
    const targetLookAt = new THREE.Vector3(...preset.target);

    // Smooth transition using animation frame
    const camera = controls.object as THREE.PerspectiveCamera;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();
    const duration = 600;
    let rafId: number;

    function animate() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLookAt, ease);
      controls.update();

      if (t < 1) rafId = requestAnimationFrame(animate);
    }

    animate();

    // Cancel any pending animation frame on cleanup
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [cameraPreset]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <Canvas
        camera={{
          position: CAMERA_PRESETS.fullBody.position,
          fov: 35,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.LinearToneMapping,
          toneMappingExposure: 1.0,
          preserveDrawingBuffer: true, // needed for screenshots
        }}
        shadows
      >
        <SceneContent modelUrl={modelUrl} controlsRef={controlsRef} />
      </Canvas>
    </div>
  );
}

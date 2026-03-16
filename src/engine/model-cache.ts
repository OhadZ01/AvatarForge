import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLB model loading.
 *
 * Loads fresh from GLTFLoader each time — no cache-and-clone.
 * Next.js/webpack bundling breaks THREE's clone() constructor chain,
 * converting SkinnedMesh → Mesh. Fresh loads preserve the real types.
 * Browser HTTP cache handles repeat-request performance.
 */

const loader = new GLTFLoader();
const DEFAULT_LOAD_TIMEOUT_MS = 30_000;

/** Load a GLB and return the scene directly. */
export async function loadGLB(url: string, timeoutMs = DEFAULT_LOAD_TIMEOUT_MS): Promise<THREE.Group> {
  return new Promise<THREE.Group>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`[ModelCache] Loading timed out after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);

    loader.load(
      url,
      (gltf) => {
        clearTimeout(timeoutId);
        resolve(gltf.scene);
      },
      undefined,
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

/** Preload a GLB (browser will HTTP-cache it) */
export function preloadGLB(url: string): void {
  loadGLB(url).catch(() => {});
}

/** Clear cache — no-op, browser HTTP cache handles this */
export function clearModelCache(): void {
  // no-op
}

/** Get cache stats for debugging */
export function getCacheStats(): { size: number; urls: string[] } {
  return { size: 0, urls: [] };
}

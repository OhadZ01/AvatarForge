'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useAvatarStore } from '@/store';
import { useUIStore } from '@/store';
import { EXPRESSION_PRESETS, ARKIT_BLENDSHAPES } from '@/domain/constants';
import { generateEyeTexture } from '@/engine/eye-texture';
import {
  findSkinnedMesh,
  applyRelaxedPose,
  bindAssetToAvatarSkeleton,
  disposeSceneGraph,
} from '@/engine/skeleton-utils';
import { positionContractAsset, positionAssetHeuristic } from '@/engine/asset-fitting';
import { autoSkinStaticMeshes } from '@/engine/auto-skinning';
import { loadGLB } from '@/engine/model-cache';
import { getAssetById, getAssetModelUrl } from '@/services/asset-registry';
import type { AssetCategory } from '@/domain/constants';
import type { SlotAssignments } from '@/domain/schemas';

/**
 * Slot-to-category mapping for asset loading.
 * A slot knows which manifest category to look up assets from.
 */
const SLOT_TO_CATEGORY: Record<string, AssetCategory> = {
  hair: 'hair',
  top: 'tops',
  bottom: 'bottoms',
  shoes: 'accessories',
  hat: 'accessories',
  glasses: 'accessories',
  accessory: 'accessories',
};

/**
 * Prepare an eye/cornea sphere: clone geometry, scale it down, and
 * recess it into the face socket.
 *
 * IMPORTANT: uses a flag on the mesh to prevent double-application.
 * useGLTF caches the scene, and React StrictMode re-runs effects,
 * so without a guard the geometry would be modified multiple times.
 *
 * MPFB2 eye spheres (radius ≈0.0105) sit almost flush with the face
 * surface (protrusion ≈0.0006). Scaling to 70% and recessing −0.008
 * in Z tucks them well behind the face so only the portion visible
 * through the eye-socket opening is rendered.
 */
function prepareEyeGeometry(mesh: THREE.Mesh, isEye: boolean): void {
  // Guard: never double-apply (cached scene + strict mode)
  const tag = isEye ? '__eyePrepared' : '__corneaPrepared';
  if ((mesh.userData as Record<string, unknown>)[tag]) return;
  (mesh.userData as Record<string, unknown>)[tag] = true;

  // Clone so we don't mutate the cached GLB geometry
  mesh.geometry = mesh.geometry.clone();
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return;

  geo.computeBoundingSphere();
  const center = geo.boundingSphere!.center.clone();
  const origRadius = geo.boundingSphere!.radius;

  // Eye sphere: center Z ≈ 0.134, radius ≈ 0.0105, face socket Z ≈ 0.144.
  // Original front = 0.1446, protrusion ≈ 0.0006.
  // Keep original size (scale 1.0) so the sphere fills the socket opening.
  // Recess −0.003 tucks the front to ~0.1416, safely behind face surface.
  const scale = 1.0;
  const zRecess = -0.003;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(
      i,
      center.x + (x - center.x) * scale,
      center.y + (y - center.y) * scale,
      center.z + (z - center.z) * scale + zRecess,
    );
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  console.log(
    `[EYE] ${mesh.name}: radius ${origRadius.toFixed(5)} → ${geo.boundingSphere!.radius.toFixed(5)}, ` +
    `center Z ${center.z.toFixed(5)} → ${geo.boundingSphere!.center.z.toFixed(5)}`
  );

  // For eye meshes (not cornea): replace atlas UVs with frontal projection
  if (isEye) {
    const newPos = geo.attributes.position;
    geo.computeBoundingSphere();
    const c = geo.boundingSphere!.center;
    const r = geo.boundingSphere!.radius;
    const uvData = new Float32Array(newPos.count * 2);
    const dir = new THREE.Vector3();

    for (let i = 0; i < newPos.count; i++) {
      dir.set(newPos.getX(i), newPos.getY(i), newPos.getZ(i)).sub(c).divideScalar(r);
      // Frontal projection: +Z face maps to UV center (0.5, 0.5)
      uvData[i * 2] = dir.x * 0.5 + 0.5;
      uvData[i * 2 + 1] = dir.y * 0.5 + 0.5;
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvData, 2));
  }
}

interface LoadedAsset {
  slotKey: string;
  assetId: string;
  scene: THREE.Group;
}

interface AvatarModelProps {
  url: string;
}

export default function AvatarModel({ url }: AvatarModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const loadedAssetsRef = useRef<LoadedAsset[]>([]);
  const hairMeshesRef = useRef<THREE.Mesh[]>([]);
  const poseAppliedRef = useRef(false);
  const eyeMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const eyeTexRef = useRef<THREE.DataTexture | null>(null);
  const corneaMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const loadGenRef = useRef(0);

  // Read store values
  const config = useAvatarStore((s) => s.config);
  const { ethnicityMorphs, faceDetailMorphs, bodyDetailMorphs, colors, slots, expression } = config;

  // Refs for values needed during asset load (avoids stale closures in callbacks)
  const hairColorRef = useRef(colors.hair);
  useEffect(() => { hairColorRef.current = colors.hair; }, [colors.hair]);

  // Find the primary skinned mesh
  const avatarMesh = useMemo(() => findSkinnedMesh(scene), [scene]);

  // ─── Eye Materials (once on scene load) ─────────────

  useEffect(() => {
    const eyeTex = generateEyeTexture(colors.eye, 512);
    eyeTexRef.current = eyeTex;

    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.15,
      side: THREE.FrontSide,
    });
    eyeMatRef.current = eyeMat;

    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.0,
      metalness: 0.0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    corneaMatRef.current = corneaMat;

    // Apply eye and cornea materials to the separate eye/cornea meshes.
    // Match by mesh name OR material name (handles Blender export name increments).
    const isEyeName = (n: string) => {
      const lo = n.toLowerCase();
      return (lo.includes('eye') && !lo.includes('brow') && !lo.includes('lash') && !lo.includes('cornea'));
    };
    const isCorneaName = (n: string) => n.toLowerCase().includes('cornea');

    scene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      const meshName = m.name || '';
      const matName = Array.isArray(m.material)
        ? ''
        : ((m.material as THREE.Material)?.name || '');

      // Cornea meshes → transparent gloss, recessed to avoid protrusion
      if (isCorneaName(meshName) || isCorneaName(matName)) {
        console.warn(`[EYE] Found cornea mesh: "${meshName}" (mat: "${matName}"), guard=${!!(m.userData as Record<string, unknown>).__corneaPrepared}`);
        m.material = corneaMat;
        prepareEyeGeometry(m, false);
        return;
      }
      // Eye meshes → iris/pupil texture, recessed to sit flush in socket
      if (isEyeName(meshName) || isEyeName(matName)) {
        console.warn(`[EYE] Found eye mesh: "${meshName}" (mat: "${matName}"), guard=${!!(m.userData as Record<string, unknown>).__eyePrepared}`);
        m.material = eyeMat;
        prepareEyeGeometry(m, true);
        return;
      }
      // Multi-material fallback (body mesh with eye material slot)
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mat) =>
          isEyeName(mat.name || '') ? eyeMat : mat
        );
      }
    });

    return () => {
      eyeTexRef.current?.dispose();
      eyeMatRef.current?.dispose();
      corneaMatRef.current?.dispose();
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Eye Color Updates ──────────────────────────────

  useEffect(() => {
    if (!eyeMatRef.current) return;
    const oldTex = eyeTexRef.current;
    const newTex = generateEyeTexture(colors.eye, 512);
    eyeTexRef.current = newTex;
    eyeMatRef.current.map = newTex;
    eyeMatRef.current.needsUpdate = true;
    oldTex?.dispose();
    // Dispose the new texture if unmounted during this effect
    return () => {
      // Only dispose if this texture is no longer the current one
      if (eyeTexRef.current !== newTex) {
        newTex.dispose();
      }
    };
  }, [colors.eye]);

  // ─── Relaxed Pose (once) ────────────────────────────
  //
  // No centering/offset is applied to the group. The body and all
  // clothing share the same coordinate space (MPFB2 neutral, origin
  // at feet, ~1.66m tall). Camera presets are configured to
  // look at this range directly.

  useEffect(() => {
    if (!avatarMesh || poseAppliedRef.current) return;
    applyRelaxedPose(avatarMesh);
    poseAppliedRef.current = true;
    useUIStore.getState().setBaseModelLoading(false);
  }, [avatarMesh]);

  // ─── Skin Color ─────────────────────────────────────

  useEffect(() => {
    if (!avatarMesh) return;
    // Apply skin color — handle multi-material (Skin + Eyes on same mesh)
    const materials = Array.isArray(avatarMesh.material)
      ? avatarMesh.material
      : [avatarMesh.material];
    for (const mat of materials) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat?.color && stdMat.name !== 'Eyes' && stdMat.name !== 'eyes') {
        stdMat.color.set(new THREE.Color(colors.skin));
        stdMat.needsUpdate = true;
      }
    }
  }, [avatarMesh, colors.skin]);

  // ─── Hair Color (reactive — tints already-loaded hair meshes) ──

  useEffect(() => {
    hairMeshesRef.current.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat?.color) {
        mat.color.set(new THREE.Color(colors.hair));
        mat.needsUpdate = true;
      }
    });
  }, [colors.hair]);

  // ─── Force eye materials (Center may re-parent) ────

  // No per-frame eye material enforcement needed — eyes are part of body mesh

  // ─── Morph Animation (expressions + face params) ───

  useFrame(() => {
    if (!avatarMesh?.morphTargetDictionary || !avatarMesh?.morphTargetInfluences) return;
    const dict = avatarMesh.morphTargetDictionary;
    const inf = avatarMesh.morphTargetInfluences;

    // Ethnicity morphs (direct, 0-1 range)
    for (const [key, value] of Object.entries(ethnicityMorphs)) {
      if (dict[key] !== undefined) {
        inf[dict[key]] = value;
      }
    }

    // Face detail morphs (direct, 0-1 range)
    for (const [key, value] of Object.entries(faceDetailMorphs)) {
      if (dict[key] !== undefined) {
        inf[dict[key]] = value;
      }
    }

    // Body detail morphs (direct, 0-1 range)
    if (bodyDetailMorphs) {
      for (const [key, value] of Object.entries(bodyDetailMorphs)) {
        if (dict[key] !== undefined) {
          inf[dict[key]] = value;
        }
      }
    }

    // Expression preset (ARKit blendshapes)
    const preset = EXPRESSION_PRESETS[expression];
    if (preset) {
      // Zero all ARKit morphs first to clear stale values
      for (const arkitName of ARKIT_BLENDSHAPES) {
        if (dict[arkitName] !== undefined) {
          inf[dict[arkitName]] = 0;
        }
      }
      // Apply the preset blend
      for (const [key, value] of Object.entries(preset.morphs)) {
        if (dict[key] !== undefined) {
          inf[dict[key]] = value;
        }
      }
    }
  });

  // ─── Asset Loading & Attachment ─────────────────────
  //
  // IMPORTANT: This callback only depends on `avatarMesh`.
  // bodyMorphs and colors.hair are read from refs to avoid
  // recreating the callback (and triggering asset reload storms)
  // every time a slider moves.

  const loadAndAttachAsset = useCallback(
    async (
      slotKey: string,
      assetId: string,
      generation: number,
    ): Promise<void> => {
      const group = groupRef.current;
      if (!group || !avatarMesh) return;

      const category = SLOT_TO_CATEGORY[slotKey];
      if (!category) {
        console.warn(`[AvatarModel] Unknown slot: ${slotKey}`);
        return;
      }

      const uiStore = useUIStore.getState();
      uiStore.addLoadingAsset(assetId);

      try {
        const item = await getAssetById(category, assetId);
        if (!item) {
          console.warn(`[AvatarModel] Asset not found: ${category}/${assetId}`);
          return;
        }
        if (generation !== loadGenRef.current) return;

        const modelUrl = getAssetModelUrl(category, item.file);
        console.log(`[AvatarModel] Loading ${slotKey}/${assetId} from ${modelUrl}`);

        const assetScene = await loadGLB(modelUrl);
        if (generation !== loadGenRef.current) {
          disposeSceneGraph(assetScene);
          return;
        }

        assetScene.name = `asset_${slotKey}_${assetId}`;

        // Position the asset
        const positionedByContract = positionContractAsset(assetScene, item);
        console.log(`[AvatarModel] Positioned ${assetId}: contract=${positionedByContract}, mode=${item.attachment?.mode}`);

        if (!positionedByContract) {
          positionAssetHeuristic(assetScene, avatarMesh, category, item, group);
        }

        // Rebind skeleton for skinned meshes
        bindAssetToAvatarSkeleton(assetScene, avatarMesh);

        // Fallback: auto-skin static meshes for clothing slots
        if (['top', 'bottom', 'shoes'].includes(slotKey)) {
          autoSkinStaticMeshes(assetScene, avatarMesh);
        }

        // Note: body morph sync removed — MPFB2 clothing will need its own morph transfer

        // Clone materials to prevent cache contamination
        const meshes: THREE.Mesh[] = [];
        assetScene.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && m.material) {
            m.material = (m.material as THREE.Material).clone();
            const stdMat = m.material as THREE.MeshStandardMaterial;
            if (stdMat.flatShading) {
              stdMat.flatShading = false;
              stdMat.needsUpdate = true;
            }
            meshes.push(m);
          }
        });

        // Apply hair tint (read from ref for current color)
        if (slotKey === 'hair') {
          hairMeshesRef.current = meshes;
          const currentHairColor = hairColorRef.current;
          meshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat?.color) mat.color.set(new THREE.Color(currentHairColor));
          });
        }

        group.add(assetScene);
        loadedAssetsRef.current.push({ slotKey, assetId, scene: assetScene });
        console.log(`[AvatarModel] Attached ${slotKey}/${assetId} (${meshes.length} meshes)`);
      } catch (err) {
        console.warn(`[AvatarModel] Failed to load asset ${assetId} for slot ${slotKey}:`, err);
      } finally {
        uiStore.removeLoadingAsset(assetId);
      }
    },
    [avatarMesh], // Only depends on avatarMesh — no stale closure issues
  );

  // Keep a stable ref to the callback so the slot-change effect doesn't
  // re-run when the callback identity changes (prevents reload storms).
  const loadAndAttachRef = useRef(loadAndAttachAsset);
  useEffect(() => { loadAndAttachRef.current = loadAndAttachAsset; }, [loadAndAttachAsset]);

  // React to slot changes — ONLY re-runs when slots or avatarMesh change
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !avatarMesh) return;

    const generation = ++loadGenRef.current;

    const currentSlots = slots;
    const loadedMap = new Map(
      loadedAssetsRef.current.map((la) => [la.slotKey, la])
    );

    // Remove assets that are no longer in slots
    for (const loaded of loadedAssetsRef.current) {
      const currentId = currentSlots[loaded.slotKey as keyof SlotAssignments];
      if (currentId !== loaded.assetId) {
        group.remove(loaded.scene);
        disposeSceneGraph(loaded.scene);
        if (loaded.slotKey === 'hair') hairMeshesRef.current = [];
      }
    }

    // Filter to keep only still-valid assets
    loadedAssetsRef.current = loadedAssetsRef.current.filter((la) => {
      const currentId = currentSlots[la.slotKey as keyof SlotAssignments];
      return currentId === la.assetId;
    });

    // Load new assets
    for (const [slotKey, assetId] of Object.entries(currentSlots)) {
      if (!assetId) continue;
      const existing = loadedMap.get(slotKey);
      if (existing && existing.assetId === assetId) continue;
      loadAndAttachRef.current(slotKey, assetId, generation);
    }

    // Cleanup on unmount: invalidate generation and clear loading indicators
    return () => {
      // Increment to invalidate any in-flight asset loads from this effect
      loadGenRef.current = generation + 1;
      useUIStore.getState().clearAllLoadingAssets();
    };
  }, [slots, avatarMesh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={groupRef}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

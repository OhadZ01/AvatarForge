import * as THREE from 'three';

/**
 * Skeleton utility functions — isolated from React components.
 *
 * These handle the critical bone-matching, skeleton-rebinding,
 * and morph-syncing operations that the old app had scattered
 * across a 900-line component.
 *
 * ORIGIN/AXIS INVARIANT:
 * - Authored assets (authored_local) share the same world-space coordinate
 *   system as the MPFB2 body. Identity bind matrices are correct.
 * - Legacy assets use heuristic bone matching. The positioning function
 *   converts between world and local space explicitly to prevent drift.
 * - All world matrix updates happen BEFORE position reads and AFTER writes.
 */

/** Find the primary (largest) SkinnedMesh in a scene graph */
export function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  let maxVerts = 0;
  root.traverse((child) => {
    const sm = child as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.geometry) {
      const count = sm.geometry.attributes.position?.count || 0;
      if (count > maxVerts) {
        maxVerts = count;
        found = sm;
      }
    }
  });
  return found;
}

/** Find a bone by trying multiple candidate names (case-insensitive) */
export function findBone(
  skeleton: THREE.Skeleton,
  candidates: string[],
): THREE.Bone | null {
  for (const candidate of candidates) {
    const bone = skeleton.bones.find(
      (b) => b.name.toLowerCase() === candidate.toLowerCase()
    );
    if (bone) return bone;
  }
  return null;
}

/** Get world position of a bone by candidate names */
export function getBoneWorldPosition(
  skeleton: THREE.Skeleton,
  candidates: string[],
): THREE.Vector3 | null {
  const bone = findBone(skeleton, candidates);
  if (!bone) return null;
  bone.updateWorldMatrix(true, false);
  return bone.getWorldPosition(new THREE.Vector3());
}

/**
 * Rebind skinned meshes in an asset to the avatar's skeleton.
 *
 * When a clothing GLB has its own skeleton, we replace it with the
 * avatar's skeleton so clothing deforms with the body.
 *
 * KEY: Uses identity bind matrix because both GLBs share the same
 * world-space coordinate system (MPFB2 neutral). The IBMs handle
 * the world→bone-local transform.
 */
export function bindAssetToAvatarSkeleton(
  assetScene: THREE.Object3D,
  avatarMesh: THREE.SkinnedMesh,
): void {
  const avatarBonesByName = new Map<string, THREE.Bone>();
  // Also index by dot-stripped name for glTF exporters that sanitize dots
  const avatarBonesByStrippedName = new Map<string, THREE.Bone>();
  avatarMesh.skeleton.bones.forEach((bone) => {
    avatarBonesByName.set(bone.name, bone);
    avatarBonesByStrippedName.set(bone.name.replace(/\./g, ''), bone);
  });

  let skinnedCount = 0;
  assetScene.traverse((child) => {
    const sm = child as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    skinnedCount++;

    // Swap bone OBJECT references to point to the avatar's bones (so the
    // clothing follows the avatar's runtime pose), but keep the clothing's
    // OWN boneInverses and bindMatrix (they match its vertex positions).
    const newBones: THREE.Bone[] = [];
    const clothingInverses: THREE.Matrix4[] = [];
    let matchedCount = 0;
    const fallbackBone = avatarMesh.skeleton.bones[0]; // root

    for (let i = 0; i < sm.skeleton.bones.length; i++) {
      const assetBone = sm.skeleton.bones[i];
      // Try exact match first, then dot-stripped fallback (glTF may strip dots)
      const avatarBone = avatarBonesByName.get(assetBone.name)
        || avatarBonesByStrippedName.get(assetBone.name);
      if (avatarBone) {
        newBones.push(avatarBone);
        clothingInverses.push(sm.skeleton.boneInverses[i]); // clothing's OWN inverse
        matchedCount++;
      } else {
        newBones.push(fallbackBone);
        clothingInverses.push(sm.skeleton.boneInverses[i]);
      }
    }

    if (matchedCount > 0) {
      const bindMatrix = sm.bindMatrix.clone(); // clothing's OWN bind matrix
      const skeleton = new THREE.Skeleton(newBones, clothingInverses);
      sm.bind(skeleton, bindMatrix);
      console.log(
        `[SkeletonBind] ✓ Bound "${sm.name}" — ${matchedCount}/${sm.skeleton.bones.length} bones matched`
      );
    } else {
      console.warn(
        `[SkeletonBind] ✗ Failed "${sm.name}" — 0/${sm.skeleton.bones.length} bones matched`
      );
    }
  });

  if (skinnedCount === 0) {
    // Diagnostic: list all mesh types found
    const types: string[] = [];
    assetScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        types.push(`${child.name}(type=${child.type})`);
      }
    });
    console.warn(`[SkeletonBind] No SkinnedMesh found in asset. Meshes: ${types.join(', ')}`);
  }
}

/**
 * Apply the relaxed arm pose to avoid T-pose stiffness.
 * Modifies bone rotations in-place — call once after model load.
 */
export function applyRelaxedPose(mesh: THREE.SkinnedMesh): void {
  const adjustments: Array<[string, { x: number; y: number; z: number }]> = [
    ['mixamorigLeftShoulder', { x: 0, y: 0, z: -0.12 }],
    ['mixamorigRightShoulder', { x: 0, y: 0, z: 0.12 }],
    ['mixamorigLeftArm', { x: 0, y: 0, z: -0.24 }],
    ['mixamorigRightArm', { x: 0, y: 0, z: 0.24 }],
    ['mixamorigLeftArm_twist', { x: 0.02, y: 0, z: -0.08 }],
    ['mixamorigRightArm_twist', { x: 0.02, y: 0, z: 0.08 }],
    ['mixamorigLeftForeArm', { x: 0, y: 0, z: -0.06 }],
    ['mixamorigRightForeArm', { x: 0, y: 0, z: 0.06 }],
  ];

  for (const [boneName, delta] of adjustments) {
    const bone = mesh.skeleton.bones.find((b) => b.name === boneName);
    if (!bone) continue;
    bone.rotation.x += delta.x;
    bone.rotation.y += delta.y;
    bone.rotation.z += delta.z;
    bone.updateMatrixWorld(true);
  }

  mesh.updateMatrixWorld(true);
}

/**
 * Sync body morph targets on clothing meshes.
 * When clothing GLBs contain body_* morphs (baked via Surface Deform),
 * this sets their influences to match the avatar's body params.
 */
export function syncClothingBodyMorphs(
  clothingScene: THREE.Object3D,
  bodyMorphValues: Record<string, number>,
): void {
  clothingScene.traverse((child) => {
    const sm = child as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.morphTargetDictionary || !sm.morphTargetInfluences) return;
    for (const [name, value] of Object.entries(bodyMorphValues)) {
      if (name.startsWith('body_') && sm.morphTargetDictionary[name] !== undefined) {
        const idx = sm.morphTargetDictionary[name];
        sm.morphTargetInfluences[idx] = value;
      }
    }
  });
}

/** Dispose all geometries and materials in a scene graph */
export function disposeSceneGraph(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if (mat) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.map?.dispose();
          stdMat.normalMap?.dispose();
          stdMat.roughnessMap?.dispose();
          stdMat.metalnessMap?.dispose();
          mat.dispose();
        }
      }
    }
  });
}

import * as THREE from 'three';

/**
 * Runtime auto-skinning for static meshes that lack skeleton data.
 *
 * When a clothing/accessory GLB was exported without armature binding
 * (plain Mesh, no skinIndex/skinWeight), this module converts it to
 * a SkinnedMesh by computing bone-proximity weights at runtime.
 *
 * This is a FALLBACK for legacy assets. Properly exported GLBs with
 * armature binding (SkinnedMesh) are handled by bindAssetToAvatarSkeleton.
 */

const MAX_INFLUENCES = 4; // glTF standard

/**
 * Convert a static Mesh to SkinnedMesh using bone-proximity weighting.
 *
 * For each vertex, finds the N closest bones and assigns inverse-distance
 * weights normalized to sum to 1.0. The resulting SkinnedMesh is bound
 * to the avatar's skeleton with an identity bind matrix.
 */
export function autoSkinMesh(
  mesh: THREE.Mesh,
  avatarSkeleton: THREE.Skeleton,
  avatarBoneInverses: THREE.Matrix4[],
): THREE.SkinnedMesh {
  const geometry = mesh.geometry.clone();
  const position = geometry.attributes.position;
  const vertexCount = position.count;

  // Get bone world positions (rest pose)
  const bonePositions: THREE.Vector3[] = avatarSkeleton.bones.map((bone) => {
    bone.updateWorldMatrix(true, false);
    return bone.getWorldPosition(new THREE.Vector3());
  });

  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  const vertex = new THREE.Vector3();

  // Apply mesh's world transform to get vertices in world space
  mesh.updateWorldMatrix(true, false);
  const meshWorldMatrix = mesh.matrixWorld;

  for (let i = 0; i < vertexCount; i++) {
    vertex.fromBufferAttribute(position, i);
    vertex.applyMatrix4(meshWorldMatrix);

    // Find closest bones by distance
    const distances: Array<{ index: number; dist: number }> = [];
    for (let j = 0; j < bonePositions.length; j++) {
      distances.push({ index: j, dist: vertex.distanceTo(bonePositions[j]) });
    }
    distances.sort((a, b) => a.dist - b.dist);
    const closest = distances.slice(0, MAX_INFLUENCES);

    // Inverse-distance weighting
    let totalWeight = 0;
    const weights: number[] = [];
    for (const d of closest) {
      const w = 1 / (d.dist + 0.0001); // avoid division by zero
      weights.push(w);
      totalWeight += w;
    }

    for (let k = 0; k < MAX_INFLUENCES; k++) {
      const offset = i * 4 + k;
      if (k < closest.length) {
        skinIndices[offset] = closest[k].index;
        skinWeights[offset] = weights[k] / totalWeight;
      } else {
        skinIndices[offset] = 0;
        skinWeights[offset] = 0;
      }
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const skinnedMesh = new THREE.SkinnedMesh(geometry, mesh.material);
  skinnedMesh.name = mesh.name;
  skinnedMesh.castShadow = mesh.castShadow;
  skinnedMesh.receiveShadow = mesh.receiveShadow;
  skinnedMesh.frustumCulled = mesh.frustumCulled;

  // Copy transform
  skinnedMesh.position.copy(mesh.position);
  skinnedMesh.rotation.copy(mesh.rotation);
  skinnedMesh.scale.copy(mesh.scale);

  // Bind to the avatar's skeleton with identity bind matrix
  const skeleton = new THREE.Skeleton(
    avatarSkeleton.bones,
    avatarBoneInverses.map((m) => m.clone()),
  );
  skinnedMesh.bind(skeleton, new THREE.Matrix4());

  return skinnedMesh;
}

/**
 * Find all static Mesh objects in a scene and convert them to SkinnedMesh.
 *
 * Only converts meshes that:
 * 1. Are plain Mesh (not already SkinnedMesh)
 * 2. Have no skinIndex attribute (not already skinned)
 *
 * Returns the number of meshes converted.
 */
export function autoSkinStaticMeshes(
  assetScene: THREE.Object3D,
  avatarMesh: THREE.SkinnedMesh,
): number {
  const meshesToConvert: THREE.Mesh[] = [];

  assetScene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (
      mesh.isMesh &&
      !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
      !mesh.geometry.attributes.skinIndex
    ) {
      meshesToConvert.push(mesh);
    }
  });

  let converted = 0;
  for (const mesh of meshesToConvert) {
    const parent = mesh.parent;
    if (!parent) continue;

    const skinnedMesh = autoSkinMesh(
      mesh,
      avatarMesh.skeleton,
      avatarMesh.skeleton.boneInverses,
    );

    // Replace the mesh in the scene graph
    const index = parent.children.indexOf(mesh);
    if (index !== -1) {
      parent.children[index] = skinnedMesh;
      skinnedMesh.parent = parent;
      mesh.parent = null;
    }

    // Dispose the old mesh geometry (material is shared)
    mesh.geometry.dispose();

    console.log(
      `[AutoSkin] Converted "${mesh.name}" → SkinnedMesh (${avatarMesh.skeleton.bones.length} bones)`
    );
    converted++;
  }

  return converted;
}

import * as THREE from 'three';
import type { AssetItem } from '@/domain/schemas';
import type { AssetCategory } from '@/domain/constants';
import { getBoneWorldPosition } from './skeleton-utils';

/**
 * Asset fitting / positioning module.
 *
 * Two distinct pipelines:
 * 1. CONTRACT-BASED (authored_local) — the asset is pre-positioned in
 *    MPFB2's coordinate space. No heuristics needed.
 * 2. HEURISTIC-BASED (legacy_makehuman) — uses bone positions to compute
 *    an offset from the asset's bounding box to the target bone.
 *
 * ORIGIN/AXIS INVARIANT:
 * - All position arithmetic happens in the parent group's local space.
 * - We call updateWorldMatrix() before ANY position read.
 * - We call updateWorldMatrix() after ANY position write.
 * - This prevents the stale-matrix bugs that plagued the old system.
 */

/** Determine accessory sub-type from asset metadata */
function getAccessoryKind(item: AssetItem): 'hat' | 'shoes' | 'generic' {
  const tags = item.tags || [];
  if (tags.includes('hat') || tags.includes('headwear')) return 'hat';
  if (tags.includes('shoes') || tags.includes('footwear') || tags.includes('boots') || tags.includes('sneakers')) return 'shoes';
  return 'generic';
}

/**
 * Position a contract-based asset. Returns true if handled.
 *
 * authored_local: asset is already in MPFB2's coordinate space.
 */
export function positionContractAsset(
  assetScene: THREE.Group,
  item: AssetItem,
): boolean {
  const attachment = item.attachment;
  if (!attachment) return false;

  if (attachment.mode === 'authored_local') {
    // Already positioned by Blender export. Just ensure matrices are fresh.
    assetScene.updateWorldMatrix(true, true);
    return true;
  }

  return false;
}

/**
 * Heuristic positioning for legacy assets without contract data.
 *
 * Computes the offset between the asset's bounding box anchor and the
 * target bone position. All arithmetic is in parentGroup's local space
 * to prevent coordinate mismatch.
 */
export function positionAssetHeuristic(
  assetScene: THREE.Group,
  avatarMesh: THREE.SkinnedMesh,
  category: AssetCategory,
  item: AssetItem,
  parentGroup: THREE.Group,
): void {
  // CRITICAL: update all matrices before reading any positions
  avatarMesh.updateWorldMatrix(true, true);
  parentGroup.updateWorldMatrix(true, true);
  assetScene.updateWorldMatrix(true, true);

  const assetBox = new THREE.Box3().setFromObject(assetScene);
  const assetSize = assetBox.getSize(new THREE.Vector3());
  const assetCenter = assetBox.getCenter(new THREE.Vector3());
  const accessoryKind = category === 'accessories' ? getAccessoryKind(item) : 'generic';

  let target: THREE.Vector3 | null = null;
  const anchor = new THREE.Vector3(assetCenter.x, assetCenter.y, assetCenter.z);

  if (category === 'hair' || (category === 'accessories' && accessoryKind === 'hat')) {
    target = getBoneWorldPosition(avatarMesh.skeleton, ['head', 'Head', 'head.x', 'mixamorigHead']);
    anchor.set(assetCenter.x, assetBox.max.y - assetSize.y * 0.18, assetCenter.z);
    if (target) target.y += assetSize.y * 0.32;
  } else if (category === 'tops') {
    target = getBoneWorldPosition(avatarMesh.skeleton, ['spine03', 'spine02', 'chest', 'upperchest', 'neck03', 'mixamorigSpine2']);
    anchor.set(assetCenter.x, assetBox.min.y + assetSize.y * 0.60, assetCenter.z);
  } else if (category === 'bottoms') {
    target = getBoneWorldPosition(avatarMesh.skeleton, ['pelvis', 'hips', 'hip', 'spine', 'spine01', 'mixamorigHips']);
    anchor.set(assetCenter.x, assetBox.min.y + assetSize.y * 0.48, assetCenter.z);
  } else if (category === 'accessories' && accessoryKind === 'shoes') {
    const leftFoot = getBoneWorldPosition(avatarMesh.skeleton, ['foot_l', 'foot.l', 'leftfoot', 'ankle_l', 'mixamorigLeftFoot']);
    const rightFoot = getBoneWorldPosition(avatarMesh.skeleton, ['foot_r', 'foot.r', 'rightfoot', 'ankle_r', 'mixamorigRightFoot']);
    if (leftFoot && rightFoot) {
      target = leftFoot.add(rightFoot).multiplyScalar(0.5);
    } else {
      target = leftFoot || rightFoot;
    }
    anchor.set(assetCenter.x, assetBox.min.y + assetSize.y * 0.10, assetCenter.z);
  } else {
    target = getBoneWorldPosition(avatarMesh.skeleton, ['spine02', 'spine01', 'spine', 'mixamorigSpine1']);
  }

  if (!target) return;

  // Convert target from world space to parentGroup's local space.
  // This is the key step that prevents coordinate mismatch.
  const targetLocal = parentGroup.worldToLocal(target.clone());

  assetScene.position.x += targetLocal.x - anchor.x;
  assetScene.position.y += targetLocal.y - anchor.y;
  assetScene.position.z += targetLocal.z - anchor.z;

  // CRITICAL: update matrices after position change
  assetScene.updateWorldMatrix(true, true);
}

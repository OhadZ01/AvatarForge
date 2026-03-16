import { AssetManifestSchema, type AssetItem, type AssetManifest } from '@/domain/schemas';
import { ASSET_BASE_PATH, type AssetCategory, ASSET_CATEGORIES } from '@/domain/constants';

/**
 * Asset Registry — the single source of truth for all available assets.
 *
 * Loads manifests from /public/assets/{category}/manifest.json,
 * validates them with Zod, caches results, and provides typed lookups.
 *
 * This replaces the old assetLoader.ts which had no validation and
 * cached raw JSON without type safety.
 */

const manifestCache = new Map<AssetCategory, AssetManifest>();
const loadingPromises = new Map<AssetCategory, Promise<AssetManifest>>();

function emptyManifest(category: AssetCategory): AssetManifest {
  return { category, items: [] };
}

export async function loadManifest(category: AssetCategory): Promise<AssetManifest> {
  // Return cached
  const cached = manifestCache.get(category);
  if (cached) return cached;

  // Deduplicate in-flight requests
  const existing = loadingPromises.get(category);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`${ASSET_BASE_PATH}/${category}/manifest.json`);
      if (!res.ok) {
        console.warn(`[AssetRegistry] Failed to load ${category} manifest: ${res.status}`);
        return emptyManifest(category);
      }
      const raw = await res.json();
      const parsed = AssetManifestSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn(`[AssetRegistry] Invalid ${category} manifest:`, parsed.error.issues);
        return emptyManifest(category);
      }
      manifestCache.set(category, parsed.data);
      return parsed.data;
    } catch (err) {
      console.warn(`[AssetRegistry] Error loading ${category} manifest:`, err);
      return emptyManifest(category);
    } finally {
      loadingPromises.delete(category);
    }
  })();

  loadingPromises.set(category, promise);
  return promise;
}

export async function loadAllManifests(): Promise<Map<AssetCategory, AssetManifest>> {
  await Promise.all(ASSET_CATEGORIES.map(loadManifest));
  return manifestCache;
}

export async function getAssetById(category: AssetCategory, id: string): Promise<AssetItem | null> {
  const manifest = await loadManifest(category);
  return manifest.items.find((item) => item.id === id) ?? null;
}

export async function getAssetsByCategory(category: AssetCategory): Promise<AssetItem[]> {
  const manifest = await loadManifest(category);
  return manifest.items;
}

export function getAssetModelUrl(category: AssetCategory, filename: string): string {
  return `${ASSET_BASE_PATH}/${category}/${filename}`;
}

export function getAssetThumbnailUrl(category: AssetCategory, filename: string): string {
  return `${ASSET_BASE_PATH}/${category}/thumbnails/${filename}`;
}

/** Search assets across all categories by name or tags */
export async function searchAssets(query: string): Promise<Array<AssetItem & { category: AssetCategory }>> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: Array<AssetItem & { category: AssetCategory }> = [];
  for (const category of ASSET_CATEGORIES) {
    const manifest = await loadManifest(category);
    for (const item of manifest.items) {
      const nameMatch = item.name.toLowerCase().includes(q);
      const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(q));
      if (nameMatch || tagMatch) {
        results.push({ ...item, category });
      }
    }
  }
  return results;
}

/** Clear manifest cache — useful for hot-reload scenarios */
export function clearManifestCache(): void {
  manifestCache.clear();
}

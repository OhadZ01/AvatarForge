'use client';

import { useState, useEffect } from 'react';
import { getAssetsByCategory } from '@/services/asset-registry';
import type { AssetItem } from '@/domain/schemas';
import type { AssetCategory } from '@/domain/constants';

/**
 * Hook to load and cache assets for a category.
 * Returns loading state + items, filters by search query.
 */
export function useAssets(category: AssetCategory, searchQuery = '') {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getAssetsByCategory(category)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [category]);

  const filtered = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q))
        );
      })
    : items;

  return { items: filtered, allItems: items, isLoading, error };
}

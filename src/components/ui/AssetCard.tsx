'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { getAssetThumbnailUrl } from '@/services/asset-registry';
import type { AssetItem } from '@/domain/schemas';
import type { AssetCategory } from '@/domain/constants';

interface AssetCardProps {
  item: AssetItem;
  category: AssetCategory;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
}

export const AssetCard = memo(function AssetCard({
  item,
  category,
  isSelected,
  isLoading,
  onSelect,
}: AssetCardProps) {
  const thumbnailUrl = getAssetThumbnailUrl(category, item.thumbnail);

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(item.id)}
      className={`
        relative group rounded-xl overflow-hidden border-2 transition-all duration-200
        aspect-square flex flex-col items-center justify-center
        ${isSelected
          ? 'border-accent bg-accent-glow shadow-lg shadow-accent/20'
          : 'border-surface-700/50 bg-surface-800/60 hover:border-surface-500/50 hover:bg-surface-700/60'
        }
      `}
    >
      {/* Thumbnail */}
      <div className="w-full h-full flex items-center justify-center p-2">
        <img
          src={thumbnailUrl}
          alt={item.name}
          className="w-full h-full object-contain rounded-lg"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[10px] font-medium text-white/90 truncate text-center">
          {item.name}
        </p>
      </div>

      {/* Source badge */}
      {item.source === 'carlos-premium' && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500/90 rounded-md">
          <span className="text-[8px] font-bold text-black uppercase tracking-wider">PRO</span>
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 left-1.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </motion.div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-surface-900/60 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
      )}
    </motion.button>
  );
});

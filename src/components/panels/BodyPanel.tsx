'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAvatarStore } from '@/store';
import {
  ETHNICITY_MORPHS,
  FACE_MORPH_CATEGORIES,
  BODY_MORPH_CATEGORIES,
  EXPRESSION_PRESETS,
  MORPH_LABELS,
  SYMMETRIC_FACE_MORPHS,
} from '@/domain/constants';
import { MorphSlider } from '@/components/ui/MorphSlider';
import type { EthnicityMorphs } from '@/domain/schemas';

type BodyTab = 'ethnicity' | 'face' | 'body' | 'expressions';

const FACE_CATEGORIES = Object.entries(FACE_MORPH_CATEGORIES);
const BODY_CATEGORIES = Object.entries(BODY_MORPH_CATEGORIES);

export default function BodyPanel() {
  const [activeTab, setActiveTab] = useState<BodyTab>('ethnicity');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('nose');
  const [expandedBodyCategory, setExpandedBodyCategory] = useState<string | null>('proportions');

  const ethnicityMorphs = useAvatarStore((s) => s.config.ethnicityMorphs);
  const faceDetailMorphs = useAvatarStore((s) => s.config.faceDetailMorphs);
  const bodyDetailMorphs = useAvatarStore((s) => s.config.bodyDetailMorphs);
  const expression = useAvatarStore((s) => s.config.expression);
  const setEthnicityMorph = useAvatarStore((s) => s.setEthnicityMorph);
  const setFaceDetailMorph = useAvatarStore((s) => s.setFaceDetailMorph);
  const setBodyDetailMorph = useAvatarStore((s) => s.setBodyDetailMorph);
  const setExpression = useAvatarStore((s) => s.setExpression);
  const resetMorphs = useAvatarStore((s) => s.resetMorphs);

  // When setting a face detail morph, also set the symmetric counterpart
  const handleFaceDetailMorph = (key: string, value: number) => {
    setFaceDetailMorph(key, value);
    const rightKey = SYMMETRIC_FACE_MORPHS[key];
    if (rightKey) {
      setFaceDetailMorph(rightKey, value);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3">
        <h3 className="text-sm font-semibold text-surface-200">Body & Face</h3>
        <p className="text-xs text-surface-500 mt-0.5">Shape your avatar</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-3 flex-wrap">
        {(['ethnicity', 'face', 'body', 'expressions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize
              ${activeTab === tab
                ? 'text-white'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
              }
            `}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="bodyTab"
                className="absolute inset-0 bg-surface-700 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      <div className="px-3">
        {activeTab === 'ethnicity' && (
          <div className="flex flex-col">
            {ETHNICITY_MORPHS.map((key) => (
              <MorphSlider
                key={key}
                label={MORPH_LABELS[key] || key}
                value={ethnicityMorphs[key as keyof EthnicityMorphs]}
                onChange={(v) => setEthnicityMorph(key as keyof EthnicityMorphs, v)}
                min={0}
                max={1}
              />
            ))}
            <button
              onClick={resetMorphs}
              className="mt-3 text-xs text-surface-400 hover:text-accent transition-colors text-center py-2"
            >
              Reset all sliders
            </button>
          </div>
        )}

        {activeTab === 'face' && (
          <div className="flex flex-col gap-1">
            {FACE_CATEGORIES.map(([catKey, category]) => {
              const isExpanded = expandedCategory === catKey;
              return (
                <div key={catKey} className="border border-surface-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-surface-200 hover:bg-surface-800/50 transition-colors"
                  >
                    <span>{category.label}</span>
                    <span className="text-surface-500 text-[10px]">
                      {category.morphs.length} controls
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2">
                      {category.morphs.map((key) => (
                        <MorphSlider
                          key={key}
                          label={MORPH_LABELS[key] || key}
                          value={faceDetailMorphs[key] || 0}
                          onChange={(v) => handleFaceDetailMorph(key, v)}
                          min={0}
                          max={1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={resetMorphs}
              className="mt-3 text-xs text-surface-400 hover:text-accent transition-colors text-center py-2"
            >
              Reset all face sliders
            </button>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="flex flex-col gap-1">
            {BODY_CATEGORIES.map(([catKey, category]) => {
              const isExpanded = expandedBodyCategory === catKey;
              return (
                <div key={catKey} className="border border-surface-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedBodyCategory(isExpanded ? null : catKey)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-surface-200 hover:bg-surface-800/50 transition-colors"
                  >
                    <span>{category.label}</span>
                    <span className="text-surface-500 text-[10px]">
                      {category.morphs.length} controls
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2">
                      {category.morphs.map((key) => (
                        <MorphSlider
                          key={key}
                          label={MORPH_LABELS[key] || key}
                          value={bodyDetailMorphs?.[key] || 0}
                          onChange={(v) => setBodyDetailMorph(key, v)}
                          min={0}
                          max={1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={resetMorphs}
              className="mt-3 text-xs text-surface-400 hover:text-accent transition-colors text-center py-2"
            >
              Reset all body sliders
            </button>
          </div>
        )}

        {activeTab === 'expressions' && (
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EXPRESSION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setExpression(key)}
                  className={`
                    px-3 py-2.5 rounded-xl text-xs font-medium border transition-all
                    ${expression === key
                      ? 'bg-accent/20 text-accent border-accent/40'
                      : 'bg-surface-800/60 text-surface-300 border-surface-700/50 hover:border-surface-600'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Loader2, AlertCircle, CheckCircle2, Scan, SlidersHorizontal, Sparkles, Key, X } from 'lucide-react';
import { useAvatarStore } from '@/store';
import { detectFaceLandmarks, extractFaceColors } from '@/services/face-landmarks';
import { mapLandmarksToMorphs } from '@/domain/landmark-morph-mapping';
import { analyzeFace, checkOllamaStatus } from '@/services/face-analysis';
import { mapFaceToMorphs } from '@/domain/face-parameter-mapping';
import type { LandmarkProportions } from '@/services/face-landmarks';
import type { FaceAnalysisResult } from '@/services/face-analysis';
import type { EthnicityMorphs, ColorConfig } from '@/domain/schemas';

type Status = 'idle' | 'loading-model' | 'detecting' | 'analyzing-llm' | 'mapping' | 'done' | 'error';

/** Labels for the proportion keys */
const PROPORTION_LABELS: Record<string, string> = {
  face_width: 'Face Width',
  jaw_width: 'Jaw Width',
  forehead_height: 'Forehead Height',
  cheekbone_prominence: 'Cheekbones',
  chin_length: 'Chin Length',
  chin_prominence: 'Chin Prominence',
  nose_width: 'Nose Width',
  nose_length: 'Nose Length',
  nose_depth: 'Nose Depth',
  nose_angle: 'Nose Angle',
  nose_bridge_hump: 'Nose Bridge',
  eye_spacing: 'Eye Spacing',
  eye_size: 'Eye Size',
  eye_height: 'Eye Openness',
  lip_thickness: 'Lip Fullness',
  lip_lower_thickness: 'Lower Lip',
  mouth_width: 'Mouth Width',
  head_roundness: 'Head Roundness',
  brow_height: 'Brow Height',
  cheek_fullness: 'Cheek Fullness',
};

/** Local storage key for API key */
const API_KEY_STORAGE = 'avatarforge_anthropic_key';

export default function PhotoPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [proportions, setProportions] = useState<LandmarkProportions | null>(null);
  const [colors, setExtractedColors] = useState<{ skin: string; eye: string; hair: string } | null>(null);
  const [gender, setGender] = useState<number | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [ethnicity, setEthnicity] = useState<{ african: number; asian: number; caucasian: number } | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showDetails, setShowDetails] = useState(false);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [analysisSource, setAnalysisSource] = useState<'mediapipe' | 'llm' | 'combined'>('mediapipe');
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    }
    return '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setEthnicityMorphs = useAvatarStore((s) => s.setEthnicityMorphs);
  const setFaceDetailMorphs = useAvatarStore((s) => s.setFaceDetailMorphs);
  const setBodyDetailMorphs = useAvatarStore((s) => s.setBodyDetailMorphs);
  const setStoreColors = useAvatarStore((s) => s.setColors);

  // Check Ollama on mount
  useEffect(() => {
    checkOllamaStatus().then(({ available }) => setOllamaAvailable(available));
  }, []);

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const llmAvailable = apiKey.length > 0 || ollamaAvailable;

  /**
   * Merge MediaPipe geometric analysis with LLM perceptual analysis.
   * MediaPipe is precise for measurements; LLM is better for subjective features.
   */
  function mergeProportions(
    mediapipe: LandmarkProportions,
    llm: FaceAnalysisResult['proportions'],
  ): LandmarkProportions {
    // For each proportion, blend MediaPipe (geometric) and LLM (perceptual).
    // MediaPipe is more reliable for measurable features (distances, ratios).
    // LLM is better for subjective features (nose hump, chin prominence).
    const blend = (mp: number, lm: number, llmWeight = 0.4): number => {
      return mp * (1 - llmWeight) + lm * llmWeight;
    };

    return {
      // Geometric features — trust MediaPipe more
      face_width: blend(mediapipe.face_width, llm.face_width, 0.3),
      jaw_width: blend(mediapipe.jaw_width, llm.jaw_width, 0.3),
      forehead_height: blend(mediapipe.forehead_height, llm.forehead_height, 0.3),
      eye_spacing: blend(mediapipe.eye_spacing, llm.eye_spacing, 0.2),
      eye_size: blend(mediapipe.eye_size, llm.eye_size, 0.3),
      eye_height: blend(mediapipe.eye_height, llm.eye_height, 0.3),
      mouth_width: blend(mediapipe.mouth_width, llm.mouth_width, 0.3),
      lip_thickness: blend(mediapipe.lip_thickness, llm.lip_thickness, 0.4),
      lip_lower_thickness: blend(mediapipe.lip_lower_thickness, llm.lip_lower_thickness, 0.4),
      head_roundness: blend(mediapipe.head_roundness, llm.head_roundness, 0.3),
      brow_height: blend(mediapipe.brow_height, llm.brow_height, 0.4),
      cheek_fullness: blend(mediapipe.cheek_fullness, llm.cheek_fullness, 0.5),

      // Subjective / depth features — trust LLM more
      nose_width: blend(mediapipe.nose_width, llm.nose_width, 0.4),
      nose_length: blend(mediapipe.nose_length, llm.nose_length, 0.4),
      nose_depth: blend(mediapipe.nose_depth, llm.nose_depth, 0.6),
      nose_angle: blend(mediapipe.nose_angle, llm.nose_angle, 0.5),
      nose_bridge_hump: blend(mediapipe.nose_bridge_hump, llm.nose_bridge_hump, 0.7),
      cheekbone_prominence: blend(mediapipe.cheekbone_prominence, llm.cheekbone_prominence, 0.5),
      chin_length: blend(mediapipe.chin_length, llm.chin_length, 0.4),
      chin_prominence: blend(mediapipe.chin_prominence, llm.chin_prominence, 0.6),
    };
  }

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setProportions(null);
    setExtractedColors(null);
    setGender(null);
    setAge(null);
    setEthnicity(null);
    setShowDetails(false);

    // Revoke previous blob URL
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      // Step 1: MediaPipe landmark detection (always runs)
      setStatus('loading-model');
      setStatus('detecting');
      const analysis = await detectFaceLandmarks(file);
      setLandmarkCount(analysis.landmarks.length);
      setConfidence(analysis.confidence);

      // Step 2: Extract colors from photo via pixel sampling
      const faceColors = await extractFaceColors(file, analysis.landmarks);

      // Step 3: Try LLM analysis for fine details (optional, non-blocking)
      let llmResult: FaceAnalysisResult | null = null;
      const currentApiKey = localStorage.getItem(API_KEY_STORAGE) || '';

      if (currentApiKey || ollamaAvailable) {
        try {
          setStatus('analyzing-llm');
          llmResult = await analyzeFace(file, {
            anthropicApiKey: currentApiKey || undefined,
          });
          console.log('[PhotoPanel] LLM analysis result:', llmResult);
        } catch (llmErr) {
          console.warn('[PhotoPanel] LLM analysis failed (using MediaPipe only):', llmErr);
        }
      }

      // Step 4: Map to morphs
      setStatus('mapping');

      let finalProportions: LandmarkProportions;
      let finalEthnicityMorphs: Partial<EthnicityMorphs>;
      let finalFaceDetailMorphs: Record<string, number>;
      let finalBodyDetailMorphs: Record<string, number>;
      let finalColors: { skin: string; eye: string; hair: string };

      if (llmResult) {
        // Combined: merge MediaPipe geometry + LLM perception
        finalProportions = mergeProportions(analysis.proportions, llmResult.proportions);
        const mapping = mapLandmarksToMorphs(finalProportions, faceColors);

        // Use LLM for ethnicity (it's much better at this than geometric analysis)
        const llmMapping = mapFaceToMorphs(llmResult);
        finalEthnicityMorphs = llmMapping.ethnicityMorphs;

        // Use the stronger morph values from either source
        finalFaceDetailMorphs = {};
        const allKeys = new Set([
          ...Object.keys(mapping.faceDetailMorphs),
          ...Object.keys(llmMapping.faceDetailMorphs),
        ]);
        for (const key of allKeys) {
          const mpVal = mapping.faceDetailMorphs[key] || 0;
          const llmVal = llmMapping.faceDetailMorphs[key] || 0;
          // Take the larger value (both sources agree on direction via mapPair)
          finalFaceDetailMorphs[key] = Math.max(mpVal, llmVal);
        }

        finalBodyDetailMorphs = mapping.bodyDetailMorphs;
        // Prefer LLM colors for skin/eye (more accurate with AI), MediaPipe for hair
        finalColors = {
          skin: llmResult.colors.skin,
          eye: llmResult.colors.eye,
          hair: faceColors.hair, // MediaPipe pixel sampling is better for hair
        };

        setAnalysisSource('combined');
        setAge(llmResult.age);
        setEthnicity(llmResult.ethnicity);
        setGender(llmResult.gender);
        setConfidence(Math.min(1, (analysis.confidence + llmResult.confidence) / 2 + 0.1));
      } else {
        // MediaPipe only
        finalProportions = analysis.proportions;
        const mapping = mapLandmarksToMorphs(analysis.proportions, faceColors);
        finalEthnicityMorphs = mapping.ethnicityMorphs;
        finalFaceDetailMorphs = mapping.faceDetailMorphs;
        finalBodyDetailMorphs = mapping.bodyDetailMorphs;
        finalColors = faceColors;

        setAnalysisSource('mediapipe');
        const genderValue = (mapping.ethnicityMorphs as Record<string, number>).masculine ?? 0.5;
        setGender(genderValue);
      }

      // Debug: log results
      console.log('[PhotoPanel] Final proportions:', finalProportions);
      console.log('[PhotoPanel] Final colors:', finalColors);
      const nonZeroMorphs = Object.entries(finalFaceDetailMorphs)
        .filter(([, v]) => v > 0.01)
        .sort(([, a], [, b]) => b - a);
      console.log('[PhotoPanel] Non-zero face morphs:', nonZeroMorphs);
      console.log('[PhotoPanel] Ethnicity morphs:', finalEthnicityMorphs);

      // Store results for display
      setProportions(finalProportions);
      setExtractedColors(finalColors);

      // Apply to avatar
      setEthnicityMorphs(finalEthnicityMorphs as Partial<EthnicityMorphs>);
      setFaceDetailMorphs(finalFaceDetailMorphs);
      if (Object.keys(finalBodyDetailMorphs).length > 0) {
        setBodyDetailMorphs(finalBodyDetailMorphs);
      }
      const validColors: Partial<ColorConfig> = {};
      if (finalColors.skin) validColors.skin = finalColors.skin;
      if (finalColors.hair) validColors.hair = finalColors.hair;
      if (finalColors.eye) validColors.eye = finalColors.eye;
      setStoreColors(validColors);

      setStatus('done');
    } catch (err) {
      console.error('[PhotoPanel] Face detection failed:', err);
      setError(err instanceof Error ? err.message : 'Face detection failed');
      setStatus('error');
    }
  }, [setEthnicityMorphs, setFaceDetailMorphs, setBodyDetailMorphs, setStoreColors, ollamaAvailable]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleSaveApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE, trimmed);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
    setShowApiKeyInput(false);
  }, []);

  /** Render a proportion bar */
  const ProportionBar = ({ label, value }: { label: string; value: number }) => {
    const pct = Math.round(value * 100);
    const deviation = value - 0.5;
    const isLow = deviation < -0.05;
    const isHigh = deviation > 0.05;
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-surface-400 w-20 truncate" title={label}>{label}</span>
        <div className="flex-1 h-1.5 bg-surface-700 rounded-full relative overflow-hidden">
          {/* Center marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-500 z-10" />
          {/* Value bar */}
          <div
            className={`absolute top-0 bottom-0 rounded-full transition-all ${
              isLow ? 'bg-blue-400/70' : isHigh ? 'bg-amber-400/70' : 'bg-green-400/50'
            }`}
            style={{
              left: deviation < 0 ? `${pct}%` : '50%',
              width: `${Math.abs(deviation) * 100}%`,
            }}
          />
        </div>
        <span className={`w-8 text-right font-mono ${
          isLow ? 'text-blue-400' : isHigh ? 'text-amber-400' : 'text-surface-500'
        }`}>
          {pct}
        </span>
      </div>
    );
  };

  /** Format ethnicity as label */
  const formatEthnicity = () => {
    if (!ethnicity) return null;
    const parts: string[] = [];
    if (ethnicity.caucasian > 0.1) parts.push(`Caucasian ${Math.round(ethnicity.caucasian * 100)}%`);
    if (ethnicity.african > 0.1) parts.push(`African ${Math.round(ethnicity.african * 100)}%`);
    if (ethnicity.asian > 0.1) parts.push(`Asian ${Math.round(ethnicity.asian * 100)}%`);
    return parts.join(', ') || 'Mixed';
  };

  return (
    <div className="flex flex-col gap-3 px-3">
      <div>
        <h3 className="text-sm font-semibold text-surface-200">Photo to Avatar</h3>
        <p className="text-xs text-surface-500 mt-0.5">
          Upload a face photo to generate your avatar
        </p>
      </div>

      {/* API Key Setup */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-colors ${
            apiKey
              ? 'text-green-400 bg-green-400/10 border border-green-400/20'
              : 'text-surface-400 bg-surface-800/50 border border-surface-700/50 hover:text-surface-200'
          }`}
        >
          <Key className="w-3 h-3" />
          {apiKey ? 'AI Key Set' : 'Add AI Key'}
        </button>
        {ollamaAvailable && (
          <span className="text-[10px] text-green-400/70">Ollama detected</span>
        )}
        {!apiKey && !ollamaAvailable && (
          <span className="text-[10px] text-surface-500">MediaPipe only</span>
        )}
      </div>

      {showApiKeyInput && (
        <div className="bg-surface-800/50 rounded-lg p-2.5 space-y-2">
          <p className="text-[10px] text-surface-400">
            Anthropic API key enables AI vision for precise facial detail analysis.
            Key is stored locally in your browser only.
          </p>
          <div className="flex gap-1.5">
            <input
              type="password"
              placeholder="sk-ant-..."
              defaultValue={apiKey}
              className="flex-1 text-[11px] bg-surface-900 rounded px-2 py-1.5 text-surface-200 placeholder-surface-600 border border-surface-700 focus:border-accent/50 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveApiKey((e.target as HTMLInputElement).value);
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                if (input) handleSaveApiKey(input.value);
              }}
              className="text-[10px] px-2 py-1 bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
            >
              Save
            </button>
            {apiKey && (
              <button
                onClick={() => handleSaveApiKey('')}
                className="p-1 text-surface-400 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${preview ? 'border-surface-600' : 'border-surface-700 hover:border-accent/50 hover:bg-surface-800/30'}
        `}
      >
        {preview ? (
          <img
            src={preview}
            alt="Uploaded face"
            className="w-full h-auto rounded-lg max-h-48 object-cover"
          />
        ) : (
          <>
            <Camera className="w-8 h-8 text-surface-500" />
            <span className="text-xs text-surface-400">Drop a face photo or click to upload</span>
            <span className="text-[10px] text-surface-600">PNG, JPG — front-facing works best</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
      </div>

      {/* Status messages */}
      {status === 'loading-model' && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading face detection model...
        </div>
      )}

      {status === 'detecting' && (
        <div className="flex items-center gap-2 text-xs text-accent">
          <Scan className="w-3.5 h-3.5 animate-pulse" />
          Detecting face landmarks...
        </div>
      )}

      {status === 'analyzing-llm' && (
        <div className="flex items-center gap-2 text-xs text-purple-400">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          AI analyzing facial details...
        </div>
      )}

      {status === 'mapping' && (
        <div className="flex items-center gap-2 text-xs text-accent">
          <SlidersHorizontal className="w-3.5 h-3.5 animate-pulse" />
          Mapping face geometry to avatar morphs...
        </div>
      )}

      {status === 'error' && error && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === 'done' && proportions && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Analysis complete — avatar updated!
          </div>

          {/* Summary */}
          <div className="bg-surface-800/50 rounded-xl p-3 text-xs space-y-1.5">
            {age !== null && (
              <div className="flex justify-between">
                <span className="text-surface-400">Age</span>
                <span className="text-surface-200">{age}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-surface-400">Gender</span>
              <span className="text-surface-200">
                {gender !== null && (
                  gender < 0.3 ? 'Feminine' : gender > 0.7 ? 'Masculine' : 'Androgynous'
                )}
              </span>
            </div>
            {ethnicity && (
              <div className="flex justify-between">
                <span className="text-surface-400">Ethnicity</span>
                <span className="text-surface-200">{formatEthnicity()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-surface-400">Confidence</span>
              <span className="text-surface-200">{Math.round(confidence * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Method</span>
              <span className="text-surface-200 text-[10px]">
                {analysisSource === 'combined'
                  ? 'MediaPipe + AI Vision'
                  : analysisSource === 'llm'
                  ? 'AI Vision'
                  : `MediaPipe (${landmarkCount} pts)`}
              </span>
            </div>

            {/* Colors */}
            {colors && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-surface-400">Colors</span>
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: colors.skin }} title={`Skin: ${colors.skin}`} />
                  <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: colors.eye }} title={`Eye: ${colors.eye}`} />
                  <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: colors.hair }} title={`Hair: ${colors.hair}`} />
                </div>
              </div>
            )}
          </div>

          {/* Proportion details (expandable) */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-center gap-1 text-[10px] text-surface-500 hover:text-surface-300 transition-colors py-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {showDetails ? 'Hide' : 'Show'} face measurements ({Object.keys(proportions).length})
          </button>

          {showDetails && (
            <div className="bg-surface-800/30 rounded-xl p-2.5 space-y-1">
              {Object.entries(proportions).map(([key, value]) => (
                <ProportionBar
                  key={key}
                  label={PROPORTION_LABELS[key] || key}
                  value={value}
                />
              ))}
              <p className="text-[9px] text-surface-600 pt-1 text-center">
                50 = average | Blue = below avg | Amber = above avg
              </p>
            </div>
          )}

          {/* Re-upload */}
          <button
            onClick={() => {
              setPreview(null);
              setProportions(null);
              setExtractedColors(null);
              setAge(null);
              setEthnicity(null);
              setStatus('idle');
              fileInputRef.current?.click();
            }}
            className="text-xs text-surface-400 hover:text-accent transition-colors text-center py-2"
          >
            Try another photo
          </button>
        </div>
      )}
    </div>
  );
}

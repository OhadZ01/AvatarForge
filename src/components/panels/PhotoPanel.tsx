'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Loader2, AlertCircle, CheckCircle2, Scan, SlidersHorizontal } from 'lucide-react';
import { useAvatarStore } from '@/store';
import { detectFaceLandmarks, extractFaceColors } from '@/services/face-landmarks';
import { mapLandmarksToMorphs } from '@/domain/landmark-morph-mapping';
import type { LandmarkProportions } from '@/services/face-landmarks';
import type { EthnicityMorphs, ColorConfig } from '@/domain/schemas';

type Status = 'idle' | 'loading-model' | 'detecting' | 'mapping' | 'done' | 'error';

/** Labels for the proportion keys */
const PROPORTION_LABELS: Record<string, string> = {
  face_width: 'Face Width',
  jaw_width: 'Jaw Width',
  forehead_height: 'Forehead Height',
  cheekbone_prominence: 'Cheekbones',
  chin_length: 'Chin Length',
  nose_width: 'Nose Width',
  nose_length: 'Nose Length',
  nose_depth: 'Nose Depth',
  nose_angle: 'Nose Angle',
  eye_spacing: 'Eye Spacing',
  eye_size: 'Eye Size',
  eye_height: 'Eye Openness',
  lip_thickness: 'Lip Fullness',
  lip_lower_thickness: 'Lower Lip',
  mouth_width: 'Mouth Width',
  head_roundness: 'Head Roundness',
  brow_height: 'Brow Height',
  cheek_fullness: 'Cheek Fullness',
  chin_prominence: 'Chin Prominence',
  nose_bridge_hump: 'Nose Bridge',
};

export default function PhotoPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [proportions, setProportions] = useState<LandmarkProportions | null>(null);
  const [colors, setExtractedColors] = useState<{ skin: string; eye: string; hair: string } | null>(null);
  const [gender, setGender] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showDetails, setShowDetails] = useState(false);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setEthnicityMorphs = useAvatarStore((s) => s.setEthnicityMorphs);
  const setFaceDetailMorphs = useAvatarStore((s) => s.setFaceDetailMorphs);
  const setBodyDetailMorphs = useAvatarStore((s) => s.setBodyDetailMorphs);
  const setStoreColors = useAvatarStore((s) => s.setColors);

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setProportions(null);
    setExtractedColors(null);
    setGender(null);
    setShowDetails(false);

    // Revoke previous blob URL
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      // Step 1: Load MediaPipe model (first time only, cached after)
      setStatus('loading-model');

      // Step 2: Detect face landmarks
      setStatus('detecting');
      const analysis = await detectFaceLandmarks(file);
      setLandmarkCount(analysis.landmarks.length);
      setConfidence(analysis.confidence);

      // Step 3: Extract colors from photo
      const faceColors = await extractFaceColors(file, analysis.landmarks);

      // Step 4: Map to morphs
      setStatus('mapping');
      const mapping = mapLandmarksToMorphs(analysis.proportions, faceColors);

      // Store results for display
      setProportions(analysis.proportions);
      setExtractedColors(faceColors);

      // Compute gender from mapping
      const genderValue = mapping.ethnicityMorphs.masculine ?? 0.5;
      setGender(genderValue);

      // Apply to avatar
      setEthnicityMorphs(mapping.ethnicityMorphs as Partial<EthnicityMorphs>);
      setFaceDetailMorphs(mapping.faceDetailMorphs);
      if (Object.keys(mapping.bodyDetailMorphs).length > 0) {
        setBodyDetailMorphs(mapping.bodyDetailMorphs);
      }
      const validColors: Partial<ColorConfig> = {};
      if (faceColors.skin) validColors.skin = faceColors.skin;
      if (faceColors.hair) validColors.hair = faceColors.hair;
      if (faceColors.eye) validColors.eye = faceColors.eye;
      setStoreColors(validColors);

      setStatus('done');
    } catch (err) {
      console.error('[PhotoPanel] Face detection failed:', err);
      setError(err instanceof Error ? err.message : 'Face detection failed');
      setStatus('error');
    }
  }, [setEthnicityMorphs, setFaceDetailMorphs, setBodyDetailMorphs, setStoreColors]);

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

  return (
    <div className="flex flex-col gap-3 px-3">
      <div>
        <h3 className="text-sm font-semibold text-surface-200">Photo to Avatar</h3>
        <p className="text-xs text-surface-500 mt-0.5">
          Upload a face photo — AI detects 478 face landmarks instantly
        </p>
      </div>

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
          Detecting 478 face landmarks...
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
            Face detected — {landmarkCount} landmarks mapped to avatar!
          </div>

          {/* Summary */}
          <div className="bg-surface-800/50 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-surface-400">Method</span>
              <span className="text-surface-200">MediaPipe Face Mesh (client-side)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Landmarks</span>
              <span className="text-surface-200">{landmarkCount} points</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Gender</span>
              <span className="text-surface-200">
                {gender !== null && (
                  gender < 0.3 ? 'Feminine' : gender > 0.7 ? 'Masculine' : 'Androgynous'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Confidence</span>
              <span className="text-surface-200">{Math.round(confidence * 100)}%</span>
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

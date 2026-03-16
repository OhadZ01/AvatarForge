'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAvatarStore } from '@/store';
import { analyzeFace, checkOllamaStatus } from '@/services/face-analysis';
import { flameFitFromPhoto, checkFlameBackend } from '@/services/flame-service';
import { mapFaceToMorphs } from '@/domain/face-parameter-mapping';
import type { FaceAnalysisResult } from '@/services/face-analysis';
import type { EthnicityMorphs } from '@/domain/schemas';

type Status = 'idle' | 'checking' | 'analyzing' | 'done' | 'error';
type AnalysisMethod = 'flame' | 'ollama';

export default function PhotoPanel() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<FaceAnalysisResult | null>(null);
  const [method, setMethod] = useState<AnalysisMethod | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setEthnicityMorphs = useAvatarStore((s) => s.setEthnicityMorphs);
  const setFaceDetailMorphs = useAvatarStore((s) => s.setFaceDetailMorphs);
  const setBodyDetailMorphs = useAvatarStore((s) => s.setBodyDetailMorphs);
  const setColors = useAvatarStore((s) => s.setColors);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setMethod(null);

    const url = URL.createObjectURL(file);
    setPreview(url);

    setStatus('checking');

    // Try FLAME backend first (more accurate)
    const flameAvailable = await checkFlameBackend();

    if (flameAvailable) {
      setStatus('analyzing');
      setMethod('flame');
      try {
        const flameResult = await flameFitFromPhoto(file);
        // Apply FLAME results directly to avatar
        if (flameResult.ethnicityMorphs) {
          setEthnicityMorphs(flameResult.ethnicityMorphs as Partial<EthnicityMorphs>);
        }
        if (flameResult.faceDetailMorphs) {
          setFaceDetailMorphs(flameResult.faceDetailMorphs);
        }
        if (flameResult.bodyDetailMorphs) {
          setBodyDetailMorphs(flameResult.bodyDetailMorphs);
        }
        if (flameResult.colors) {
          setColors(flameResult.colors as { skin: string; hair: string; eye: string });
        }
        // Create a pseudo-result for display
        setResult({
          ethnicity: { african: 0, asian: 0, caucasian: 0 },
          gender: flameResult.ethnicityMorphs?.masculine || 0.5,
          age: 30,
          proportions: {} as FaceAnalysisResult['proportions'],
          colors: {
            skin: flameResult.colors?.skin || '#c8956c',
            eye: flameResult.colors?.eye || '#5b7553',
            hair: flameResult.colors?.hair || '#3d2314',
          },
          confidence: flameResult.confidence || 0.8,
        });
        setStatus('done');
        return;
      } catch (err) {
        console.warn('[PhotoPanel] FLAME failed, falling back to Ollama:', err);
      }
    }

    // Fallback: Ollama vision
    setMethod('ollama');
    const ollamaStatus = await checkOllamaStatus();
    if (!ollamaStatus.available) {
      setError('Neither FLAME backend nor Ollama is running. Start Ollama with: ollama serve');
      setStatus('error');
      return;
    }
    if (!ollamaStatus.hasModel) {
      setError('Vision model not found. Run: ollama pull llama3.2-vision');
      setStatus('error');
      return;
    }

    setStatus('analyzing');
    try {
      const analysis = await analyzeFace(file);
      setResult(analysis);
      setStatus('done');

      // Apply to avatar — ethnicity, face details, and colors
      const mapping = mapFaceToMorphs(analysis);
      setEthnicityMorphs(mapping.ethnicityMorphs as Partial<EthnicityMorphs>);
      setFaceDetailMorphs(mapping.faceDetailMorphs);
      setColors(mapping.colors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStatus('error');
    }
  }, [setEthnicityMorphs, setFaceDetailMorphs, setBodyDetailMorphs, setColors]);

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

  return (
    <div className="flex flex-col gap-3 px-3">
      <div>
        <h3 className="text-sm font-semibold text-surface-200">Photo to Avatar</h3>
        <p className="text-xs text-surface-500 mt-0.5">Upload a face photo to generate your avatar</p>
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

      {/* Status */}
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Checking analysis backends...
        </div>
      )}

      {status === 'analyzing' && (
        <div className="flex items-center gap-2 text-xs text-accent">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {method === 'flame' ? 'FLAME fitting face...' : 'Analyzing face features...'}
        </div>
      )}

      {status === 'error' && error && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === 'done' && result && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Analysis complete{method === 'flame' ? ' (FLAME)' : ''} — avatar updated!
          </div>

          {/* Results summary */}
          <div className="bg-surface-800/50 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-surface-400">Age</span>
              <span className="text-surface-200">{result.age}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Gender</span>
              <span className="text-surface-200">
                {result.gender < 0.3 ? 'Feminine' : result.gender > 0.7 ? 'Masculine' : 'Androgynous'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Ethnicity</span>
              <span className="text-surface-200">
                {[
                  result.ethnicity.african > 0.3 && `African ${(result.ethnicity.african * 100).toFixed(0)}%`,
                  result.ethnicity.asian > 0.3 && `Asian ${(result.ethnicity.asian * 100).toFixed(0)}%`,
                  result.ethnicity.caucasian > 0.3 && `Caucasian ${(result.ethnicity.caucasian * 100).toFixed(0)}%`,
                ].filter(Boolean).join(', ') || 'Mixed'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Confidence</span>
              <span className="text-surface-200">{(result.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-surface-400">Colors</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: result.colors.skin }} title="Skin" />
                <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: result.colors.eye }} title="Eye" />
                <div className="w-4 h-4 rounded-full border border-surface-600" style={{ backgroundColor: result.colors.hair }} title="Hair" />
              </div>
            </div>
          </div>

          {/* Re-upload button */}
          <button
            onClick={() => {
              setPreview(null);
              setResult(null);
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

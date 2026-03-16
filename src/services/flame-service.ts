/**
 * FLAME fitting service — calls the backend API for accurate face fitting.
 * Falls back gracefully if the backend is not running.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const FLAME_ENDPOINT = `${BACKEND_URL}/v1/avatars/flame-fit`;

export interface FlameFitResult {
  status: string;
  fit_error: number;
  ethnicityMorphs: Record<string, number>;
  faceDetailMorphs: Record<string, number>;
  bodyDetailMorphs: Record<string, number>;
  colors: {
    skin?: string;
    hair?: string;
    eye?: string;
  };
  confidence: number;
}

/**
 * Send a photo to the FLAME backend for accurate face fitting.
 * Returns MPFB2-compatible morph values and colors.
 */
export async function flameFitFromPhoto(imageFile: File | Blob): Promise<FlameFitResult> {
  const formData = new FormData();
  formData.append('photo', imageFile);

  const response = await fetch(FLAME_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`FLAME fit failed: ${response.status} ${detail}`);
  }

  return response.json();
}

/**
 * Check if the FLAME backend is available.
 */
export async function checkFlameBackend(): Promise<boolean> {
  try {
    const resp = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

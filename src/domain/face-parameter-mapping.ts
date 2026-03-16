/**
 * Maps face analysis results to MPFB2 morph target values.
 *
 * IMPORTANT: MPFB2 morphs are directional vertex deltas, not binary controls.
 * - 0.0-0.3 range: Subtle, natural variations
 * - 0.3-0.5 range: Noticeable but still natural
 * - 0.5-1.0 range: Exaggerated, caricature-like deformations
 *
 * We clamp to MAX_MORPH (0.35) to ensure naturalistic results.
 */

import type { FaceAnalysisResult } from '@/services/face-analysis';
import type { EthnicityMorphs } from './schemas';
import { SYMMETRIC_FACE_MORPHS } from './constants';

/** Maximum morph value for natural-looking results */
const MAX_MORPH = 0.35;

interface MorphMapping {
  ethnicityMorphs: Partial<EthnicityMorphs>;
  faceDetailMorphs: Record<string, number>;
  colors: { skin: string; eye: string; hair: string };
}

export function mapFaceToMorphs(analysis: FaceAnalysisResult): MorphMapping {
  const { ethnicity, gender, proportions } = analysis;
  const fem = 1 - gender;
  const masc = gender;

  const faceDetailMorphs: Record<string, number> = {};

  /**
   * Map a 0-1 LLM proportion to a pair of opposing morphs.
   * 0.5 = neutral (both morphs at 0), edges = clamped to MAX_MORPH.
   */
  const mapPair = (value: number, lowMorph: string, highMorph: string, strength = 1.0) => {
    if (value < 0.5) {
      faceDetailMorphs[lowMorph] = Math.min((0.5 - value) * 2 * strength, MAX_MORPH);
      faceDetailMorphs[highMorph] = 0;
    } else {
      faceDetailMorphs[lowMorph] = 0;
      faceDetailMorphs[highMorph] = Math.min((value - 0.5) * 2 * strength, MAX_MORPH);
    }
  };

  mapPair(proportions.nose_width, 'nose_narrow', 'nose_width');
  mapPair(proportions.nose_length, 'nose_short', 'nose_length');
  mapPair(proportions.jaw_width, 'jaw_narrow', 'jaw_wide');
  mapPair(proportions.chin_length, 'chin_short', 'chin_long');
  mapPair(proportions.eye_size, 'eye_small', 'eye_large');
  mapPair(proportions.eye_spacing, 'eye_close_set', 'eye_wide_apart');
  mapPair(proportions.lip_thickness, 'lip_thin', 'lip_thick');
  mapPair(proportions.forehead_height, 'forehead_short', 'forehead_tall');
  mapPair(proportions.cheekbone_prominence, 'cheek_bones_flat', 'cheek_bones_high');
  mapPair(proportions.face_width, 'head_narrow', 'head_wide');

  // Apply right-side symmetric morphs for all pairs
  for (const [left, right] of Object.entries(SYMMETRIC_FACE_MORPHS)) {
    if (faceDetailMorphs[left] !== undefined) {
      faceDetailMorphs[right] = faceDetailMorphs[left];
    }
  }

  return {
    ethnicityMorphs: {
      african_female: ethnicity.african * fem,
      african_male: ethnicity.african * masc,
      asian_female: ethnicity.asian * fem,
      asian_male: ethnicity.asian * masc,
      caucasian_female: ethnicity.caucasian * fem,
      caucasian_male: ethnicity.caucasian * masc,
      feminine: fem,
      masculine: masc,
    },
    faceDetailMorphs,
    colors: {
      skin: analysis.colors.skin,
      eye: analysis.colors.eye,
      hair: analysis.colors.hair,
    },
  };
}

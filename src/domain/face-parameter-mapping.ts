/**
 * Maps face analysis results (from LLM vision) to MPFB2 morph target values.
 *
 * Morph value ranges:
 * - 0.0-0.3: Subtle, natural
 * - 0.3-0.5: Noticeable
 * - 0.5-0.7: Strong but still natural for distinctive features
 *
 * We use MAX_MORPH=0.60 and STRENGTH=1.8 to produce visible, natural morphs.
 */

import type { FaceAnalysisResult } from '@/services/face-analysis';
import type { EthnicityMorphs } from './schemas';
import { SYMMETRIC_FACE_MORPHS } from './constants';

/** Maximum morph value for natural-looking results */
const MAX_MORPH = 0.60;

/** Base strength multiplier — amplifies LLM's 0-1 proportions into visible morphs */
const STRENGTH = 1.8;

interface MorphMapping {
  ethnicityMorphs: Partial<EthnicityMorphs>;
  faceDetailMorphs: Record<string, number>;
  bodyDetailMorphs: Record<string, number>;
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
  const mapPair = (value: number, lowMorph: string, highMorph: string, strength = STRENGTH) => {
    const deviation = value - 0.5;
    if (deviation < -0.02) {
      faceDetailMorphs[lowMorph] = Math.min(Math.abs(deviation) * 2 * strength, MAX_MORPH);
      faceDetailMorphs[highMorph] = 0;
    } else if (deviation > 0.02) {
      faceDetailMorphs[lowMorph] = 0;
      faceDetailMorphs[highMorph] = Math.min(deviation * 2 * strength, MAX_MORPH);
    } else {
      faceDetailMorphs[lowMorph] = 0;
      faceDetailMorphs[highMorph] = 0;
    }
  };

  /**
   * Map a 0-1 proportion to a single morph (one-directional).
   */
  const mapSingle = (value: number, morph: string, threshold = 0.55, strength = STRENGTH) => {
    if (value > threshold) {
      faceDetailMorphs[morph] = Math.min((value - threshold) * 2 * strength, MAX_MORPH);
    } else {
      faceDetailMorphs[morph] = 0;
    }
  };

  // === NOSE === (high impact — noses vary a lot)
  mapPair(proportions.nose_width, 'nose_narrow', 'nose_width', STRENGTH * 1.3);
  mapPair(proportions.nose_length, 'nose_short', 'nose_length', STRENGTH * 1.2);
  mapPair(proportions.nose_depth, 'nose_flat', 'nose_depth', STRENGTH);
  mapPair(proportions.nose_angle, 'nose_up', 'nose_down', STRENGTH * 0.8);
  mapSingle(proportions.nose_bridge_hump, 'nose_hump', 0.52, STRENGTH * 1.5);
  if (proportions.nose_width > 0.55) {
    faceDetailMorphs['nose_nostril_wide'] = Math.min((proportions.nose_width - 0.55) * 3, MAX_MORPH);
  }

  // === JAW & CHIN === (high impact — defines face shape)
  mapPair(proportions.jaw_width, 'jaw_narrow', 'jaw_wide', STRENGTH * 1.3);
  mapPair(proportions.chin_prominence, 'chin_recessed', 'chin_prominent', STRENGTH * 1.2);
  mapPair(proportions.chin_length, 'chin_short', 'chin_long', STRENGTH * 1.2);
  if (proportions.chin_prominence > 0.6) {
    faceDetailMorphs['chin_prognathism'] = Math.min((proportions.chin_prominence - 0.6) * 3, MAX_MORPH);
  }

  // === EYES === (medium-high impact)
  mapPair(proportions.eye_size, 'eye_small', 'eye_large', STRENGTH * 1.2);
  mapPair(proportions.eye_spacing, 'eye_close_set', 'eye_wide_apart', STRENGTH);
  mapPair(proportions.eye_height, 'eye_height_narrow', 'eye_height_open', STRENGTH * 1.1);

  // === MOUTH & LIPS ===
  mapPair(proportions.lip_thickness, 'lip_thin', 'lip_thick', STRENGTH * 1.3);
  mapPair(proportions.mouth_width, 'mouth_narrow', 'mouth_wide', STRENGTH);
  if (proportions.lip_lower_thickness > 0.52) {
    faceDetailMorphs['lip_lower_thick'] = Math.min(
      (proportions.lip_lower_thickness - 0.52) * 3, MAX_MORPH
    );
  }

  // === CHEEKS ===
  mapPair(proportions.cheekbone_prominence, 'cheek_bones_flat', 'cheek_bones_high', STRENGTH * 1.2);
  mapPair(proportions.cheek_fullness, 'cheek_thin', 'cheek_full', STRENGTH);

  // === HEAD SHAPE === (high impact — defines overall head)
  mapPair(proportions.face_width, 'head_narrow', 'head_wide', STRENGTH * 1.3);
  mapPair(proportions.head_roundness, 'head_square', 'head_round', STRENGTH);

  // === FOREHEAD & BROWS ===
  mapPair(proportions.forehead_height, 'forehead_short', 'forehead_tall', STRENGTH * 1.1);
  mapPair(proportions.brow_height, 'brow_low', 'brow_high', STRENGTH);

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
    bodyDetailMorphs: {},
    colors: {
      skin: analysis.colors.skin,
      eye: analysis.colors.eye,
      hair: analysis.colors.hair,
    },
  };
}

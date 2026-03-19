/**
 * Maps precise MediaPipe face landmark proportions to MPFB2 morph targets.
 *
 * Unlike the LLM-based mapping which estimates proportions from a text description,
 * this uses actual geometric measurements from 478 face landmarks for accuracy.
 *
 * Morph value ranges:
 * - 0.0-0.3: Subtle, natural
 * - 0.3-0.5: Noticeable
 * - 0.5+: Exaggerated (we allow up to 0.5 for landmark-based since measurements are precise)
 */

import type { LandmarkProportions } from '@/services/face-landmarks';
import type { EthnicityMorphs } from './schemas';
import { SYMMETRIC_FACE_MORPHS } from './constants';

/** Max morph value — slightly higher than LLM-based since landmarks are precise */
const MAX_MORPH = 0.45;

/** Strength multiplier — how aggressively to translate proportions to morphs */
const STRENGTH = 1.2;

interface LandmarkMorphMapping {
  ethnicityMorphs: Partial<EthnicityMorphs>;
  faceDetailMorphs: Record<string, number>;
  bodyDetailMorphs: Record<string, number>;
  colors: { skin: string; eye: string; hair: string };
}

/**
 * Map a 0-1 proportion to opposing morph pair.
 * 0.5 = neutral (both 0). Deviations activate one side.
 */
function mapPair(
  value: number,
  lowMorph: string,
  highMorph: string,
  morphs: Record<string, number>,
  strength = STRENGTH
) {
  const deviation = value - 0.5;
  if (deviation < -0.02) {
    // Below average → activate low morph
    morphs[lowMorph] = Math.min(Math.abs(deviation) * 2 * strength, MAX_MORPH);
    morphs[highMorph] = 0;
  } else if (deviation > 0.02) {
    // Above average → activate high morph
    morphs[lowMorph] = 0;
    morphs[highMorph] = Math.min(deviation * 2 * strength, MAX_MORPH);
  } else {
    // Near average → both zero
    morphs[lowMorph] = 0;
    morphs[highMorph] = 0;
  }
}

/**
 * Map a 0-1 proportion to a single morph (one-directional).
 * Only activates when above threshold.
 */
function mapSingle(
  value: number,
  morph: string,
  morphs: Record<string, number>,
  threshold = 0.55,
  strength = STRENGTH
) {
  if (value > threshold) {
    morphs[morph] = Math.min((value - threshold) * 2 * strength, MAX_MORPH);
  } else {
    morphs[morph] = 0;
  }
}

/**
 * Estimate gender from face proportions.
 * Uses anthropometric differences between masculine and feminine faces.
 *
 * Masculine indicators: wider jaw, lower brow, larger nose, less lip fullness
 * Feminine indicators: wider eyes, fuller lips, higher cheekbones, rounder face
 */
function estimateGender(props: LandmarkProportions): number {
  let masculineScore = 0;
  let count = 0;

  // Jaw width — masculine faces have wider jaws
  masculineScore += props.jaw_width;
  count++;

  // Brow height — masculine faces have lower, more prominent brows
  masculineScore += (1 - props.brow_height);
  count++;

  // Nose width — masculine noses tend wider
  masculineScore += props.nose_width;
  count++;

  // Lip thickness — feminine faces tend to have fuller lips
  masculineScore += (1 - props.lip_thickness);
  count++;

  // Eye size — feminine faces tend to have larger-appearing eyes
  masculineScore += (1 - props.eye_size);
  count++;

  // Chin prominence — masculine chins tend more prominent
  masculineScore += props.chin_prominence;
  count++;

  // Cheekbone — feminine faces often have more prominent cheekbones
  masculineScore += (1 - props.cheekbone_prominence) * 0.5 + 0.25;
  count++;

  // Face roundness — feminine faces tend rounder
  masculineScore += (1 - props.head_roundness);
  count++;

  return Math.max(0, Math.min(1, masculineScore / count));
}

/**
 * Convert precise landmark proportions to MPFB2 morph values.
 */
export function mapLandmarksToMorphs(
  proportions: LandmarkProportions,
  colors: { skin: string; eye: string; hair: string },
): LandmarkMorphMapping {
  const faceDetailMorphs: Record<string, number> = {};

  // === NOSE ===
  mapPair(proportions.nose_width, 'nose_narrow', 'nose_width', faceDetailMorphs);
  mapPair(proportions.nose_length, 'nose_short', 'nose_length', faceDetailMorphs);
  mapPair(proportions.nose_depth, 'nose_flat', 'nose_depth', faceDetailMorphs);
  mapPair(proportions.nose_angle, 'nose_down', 'nose_up', faceDetailMorphs, 0.8);
  mapSingle(proportions.nose_bridge_hump, 'nose_hump', faceDetailMorphs, 0.55, 1.5);
  // Nostril flare correlates with nose width
  if (proportions.nose_width > 0.6) {
    faceDetailMorphs['nose_nostril_wide'] = Math.min((proportions.nose_width - 0.6) * 2.5, MAX_MORPH);
  }

  // === JAW & CHIN ===
  mapPair(proportions.jaw_width, 'jaw_narrow', 'jaw_wide', faceDetailMorphs);
  mapPair(proportions.chin_prominence, 'chin_recessed', 'chin_prominent', faceDetailMorphs);
  mapPair(proportions.chin_length, 'chin_short', 'chin_long', faceDetailMorphs);
  // Chin prognathism from prominence
  if (proportions.chin_prominence > 0.7) {
    faceDetailMorphs['chin_prognathism'] = Math.min((proportions.chin_prominence - 0.7) * 3, MAX_MORPH);
  }

  // === EYES ===
  mapPair(proportions.eye_size, 'eye_small', 'eye_large', faceDetailMorphs);
  mapPair(proportions.eye_spacing, 'eye_close_set', 'eye_wide_apart', faceDetailMorphs);
  mapPair(proportions.eye_height, 'eye_height_narrow', 'eye_height_open', faceDetailMorphs);

  // === MOUTH & LIPS ===
  mapPair(proportions.lip_thickness, 'lip_thin', 'lip_thick', faceDetailMorphs);
  mapPair(proportions.mouth_width, 'mouth_narrow', 'mouth_wide', faceDetailMorphs);
  // Lower lip
  if (proportions.lip_lower_thickness > 0.55) {
    faceDetailMorphs['lip_lower_thick'] = Math.min(
      (proportions.lip_lower_thickness - 0.55) * 2.5, MAX_MORPH
    );
  }

  // === CHEEKS ===
  mapPair(proportions.cheekbone_prominence, 'cheek_bones_flat', 'cheek_bones_high', faceDetailMorphs);
  mapPair(proportions.cheek_fullness, 'cheek_thin', 'cheek_full', faceDetailMorphs);

  // === HEAD SHAPE ===
  mapPair(proportions.face_width, 'head_narrow', 'head_wide', faceDetailMorphs);
  mapPair(proportions.head_roundness, 'head_square', 'head_round', faceDetailMorphs, 0.8);

  // === FOREHEAD & BROWS ===
  mapPair(proportions.forehead_height, 'forehead_short', 'forehead_tall', faceDetailMorphs);
  mapPair(proportions.brow_height, 'brow_low', 'brow_high', faceDetailMorphs);

  // Apply symmetric counterparts (left → right)
  for (const [left, right] of Object.entries(SYMMETRIC_FACE_MORPHS)) {
    if (faceDetailMorphs[left] !== undefined) {
      faceDetailMorphs[right] = faceDetailMorphs[left];
    }
  }

  // === GENDER/ETHNICITY ===
  const gender = estimateGender(proportions);
  const fem = 1 - gender;
  const masc = gender;

  // Default to a neutral ethnicity blend (0.33 each) since landmarks alone
  // can't reliably determine ethnicity. Skin color provides better cues.
  const ethnicityMorphs: Partial<EthnicityMorphs> = {
    feminine: fem,
    masculine: masc,
    // We set a balanced default — the user can refine via sliders
    caucasian_female: 0.33 * fem,
    caucasian_male: 0.33 * masc,
    african_female: 0.33 * fem,
    african_male: 0.33 * masc,
    asian_female: 0.33 * fem,
    asian_male: 0.33 * masc,
  };

  return {
    ethnicityMorphs,
    faceDetailMorphs,
    bodyDetailMorphs: {},
    colors,
  };
}

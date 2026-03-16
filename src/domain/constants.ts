/**
 * Core constants for the avatar system.
 * All magic values live here — nowhere else in the codebase.
 */

/** Asset categories supported by the system */
export const ASSET_CATEGORIES = ['hair', 'tops', 'bottoms', 'accessories'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** Slot types — each slot can hold one asset at a time */
export const ASSET_SLOTS = ['hair', 'top', 'bottom', 'shoes', 'hat', 'glasses', 'accessory'] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

/** Maps categories to their primary slots */
export const CATEGORY_TO_SLOTS: Record<AssetCategory, AssetSlot[]> = {
  hair: ['hair'],
  tops: ['top'],
  bottoms: ['bottom'],
  accessories: ['shoes', 'hat', 'glasses', 'accessory'],
};

/** Asset source types */
export const ASSET_SOURCES = ['makehuman-base', 'carlos-premium', 'mpfb2-native'] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

/** Binding contracts — how an asset attaches to the skeleton */
export const BIND_CONTRACTS = ['mpfb2_head_v1', 'legacy_makehuman_v1'] as const;
export type BindContract = (typeof BIND_CONTRACTS)[number];

/** Attachment modes */
export const ATTACHMENT_MODES = ['authored_local'] as const;
export type AttachmentMode = (typeof ATTACHMENT_MODES)[number];

/** ARKit blendshape names — the 52 standard face morphs */
export const ARKIT_BLENDSHAPES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
  'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker',
  'mouthRight', 'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight',
  'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'noseSneerLeft', 'noseSneerRight',
  'tongueOut',
] as const;

/** MPFB2 ethnicity/gender morph target names */
export const ETHNICITY_MORPHS = [
  'asian_female', 'asian_male',
  'caucasian_female', 'caucasian_male',
  'african_female', 'african_male',
  'feminine', 'masculine',
  'cup_size', 'firmness',
] as const;

/**
 * MPFB2 face detail morphs — organized by category.
 * These are actual shape keys in the GLB, loaded from MPFB2 target files.
 * Each morph is 0-1 range (positive direction only).
 */
export const FACE_MORPH_CATEGORIES = {
  nose: {
    label: 'Nose',
    morphs: [
      'nose_width', 'nose_narrow', 'nose_length', 'nose_short',
      'nose_depth', 'nose_flat', 'nose_up', 'nose_down',
      'nose_hump', 'nose_nostril_wide',
    ],
  },
  jaw: {
    label: 'Jaw & Chin',
    morphs: [
      'jaw_wide', 'jaw_narrow', 'chin_prominent', 'chin_recessed',
      'chin_long', 'chin_short', 'chin_cleft', 'chin_prognathism',
    ],
  },
  eyes: {
    label: 'Eyes',
    morphs: [
      'eye_large', 'eye_small', 'eye_wide_apart', 'eye_close_set',
      'eye_height_open', 'eye_height_narrow', 'eye_bag', 'eye_epicanthus',
    ],
  },
  mouth: {
    label: 'Mouth & Lips',
    morphs: [
      'lip_thick', 'lip_thin', 'mouth_wide', 'mouth_narrow',
      'lip_lower_thick', 'mouth_forward', 'mouth_smile', 'mouth_frown',
    ],
  },
  cheeks: {
    label: 'Cheeks',
    morphs: ['cheek_bones_high', 'cheek_bones_flat', 'cheek_full', 'cheek_thin'],
  },
  head: {
    label: 'Head Shape',
    morphs: ['head_wide', 'head_narrow', 'head_round', 'head_square', 'head_oval', 'head_age'],
  },
  forehead: {
    label: 'Forehead & Brows',
    morphs: ['forehead_tall', 'forehead_short', 'forehead_wide', 'forehead_narrow', 'brow_high', 'brow_low'],
  },
} as const;

/** Flat list of all face detail morph names */
export const FACE_DETAIL_MORPHS = Object.values(FACE_MORPH_CATEGORIES).flatMap((c) => c.morphs);

/**
 * MPFB2 body shape morphs — organized by category.
 * Baked via bone scaling/translation in Blender.
 */
export const BODY_MORPH_CATEGORIES = {
  proportions: {
    label: 'Proportions',
    morphs: ['body_height_tall', 'body_height_short', 'body_weight_heavy', 'body_weight_thin', 'body_muscle_defined', 'body_muscle_soft'],
  },
  torso: {
    label: 'Torso',
    morphs: ['torso_long', 'torso_short', 'chest_broad', 'chest_narrow', 'shoulder_wide', 'shoulder_narrow'],
  },
  lower: {
    label: 'Lower Body',
    morphs: ['hip_wide', 'hip_narrow', 'leg_long', 'leg_short'],
  },
  arms: {
    label: 'Arms',
    morphs: ['arm_long', 'arm_short'],
  },
} as const;

/** Flat list of all body detail morph names */
export const BODY_DETAIL_MORPHS = Object.values(BODY_MORPH_CATEGORIES).flatMap((c) => c.morphs);

/** All symmetric face morphs that need right-side counterparts applied together */
export const SYMMETRIC_FACE_MORPHS: Record<string, string> = {
  eye_large: 'r_eye_large',
  eye_small: 'r_eye_small',
  eye_wide_apart: 'r_eye_wide_apart',
  eye_close_set: 'r_eye_close_set',
  eye_height_open: 'r_eye_height_open',
  eye_height_narrow: 'r_eye_height_narrow',
  eye_bag: 'r_eye_bag',
  eye_epicanthus: 'r_eye_epicanthus',
  cheek_bones_high: 'r_cheek_bones_high',
  cheek_bones_flat: 'r_cheek_bones_flat',
  cheek_full: 'r_cheek_full',
  cheek_thin: 'r_cheek_thin',
};

/** Pretty labels for all morphs */
export const MORPH_LABELS: Record<string, string> = {
  // Ethnicity
  asian_female: 'Asian Female', asian_male: 'Asian Male',
  caucasian_female: 'Caucasian Female', caucasian_male: 'Caucasian Male',
  african_female: 'African Female', african_male: 'African Male',
  feminine: 'Feminine', masculine: 'Masculine',
  cup_size: 'Cup Size', firmness: 'Firmness',
  // Nose
  nose_width: 'Wide', nose_narrow: 'Narrow', nose_length: 'Long', nose_short: 'Short',
  nose_depth: 'Deep', nose_flat: 'Flat', nose_up: 'Upturned', nose_down: 'Downturned',
  nose_hump: 'Bridge Hump', nose_nostril_wide: 'Nostril Flare',
  // Jaw
  jaw_wide: 'Wide Jaw', jaw_narrow: 'Narrow Jaw',
  chin_prominent: 'Prominent', chin_recessed: 'Recessed',
  chin_long: 'Long', chin_short: 'Short', chin_cleft: 'Cleft', chin_prognathism: 'Prognathism',
  // Eyes
  eye_large: 'Large', eye_small: 'Small', eye_wide_apart: 'Wide Apart', eye_close_set: 'Close Set',
  eye_height_open: 'Open', eye_height_narrow: 'Narrow', eye_bag: 'Eye Bags', eye_epicanthus: 'Epicanthic Fold',
  // Mouth
  lip_thick: 'Full Upper Lip', lip_thin: 'Thin Upper Lip',
  mouth_wide: 'Wide', mouth_narrow: 'Narrow',
  lip_lower_thick: 'Full Lower Lip', mouth_forward: 'Protruding',
  mouth_smile: 'Upturned Corners', mouth_frown: 'Downturned Corners',
  // Cheeks
  cheek_bones_high: 'High Cheekbones', cheek_bones_flat: 'Flat Cheekbones',
  cheek_full: 'Full Cheeks', cheek_thin: 'Thin Cheeks',
  // Head
  head_wide: 'Wide', head_narrow: 'Narrow',
  head_round: 'Round', head_square: 'Square', head_oval: 'Oval', head_age: 'Aged',
  // Forehead
  forehead_tall: 'Tall', forehead_short: 'Short',
  forehead_wide: 'Wide Temples', forehead_narrow: 'Narrow Temples',
  brow_high: 'High Brows', brow_low: 'Low Brows',
  // Body proportions
  body_height_tall: 'Tall', body_height_short: 'Short',
  body_weight_heavy: 'Heavy', body_weight_thin: 'Thin',
  body_muscle_defined: 'Muscular', body_muscle_soft: 'Soft',
  // Torso
  torso_long: 'Long Torso', torso_short: 'Short Torso',
  chest_broad: 'Broad Chest', chest_narrow: 'Narrow Chest',
  shoulder_wide: 'Wide Shoulders', shoulder_narrow: 'Narrow Shoulders',
  // Lower body
  hip_wide: 'Wide Hips', hip_narrow: 'Narrow Hips',
  leg_long: 'Long Legs', leg_short: 'Short Legs',
  // Arms
  arm_long: 'Long Arms', arm_short: 'Short Arms',
};

/** Expression presets */
export const EXPRESSION_PRESETS: Record<string, { label: string; morphs: Record<string, number> }> = {
  neutral:  { label: 'Neutral',  morphs: {} },
  smile:    { label: 'Smile',    morphs: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8, cheekSquintLeft: 0.4, cheekSquintRight: 0.4 } },
  surprise: { label: 'Surprise', morphs: { browInnerUp: 0.9, eyeWideLeft: 0.8, eyeWideRight: 0.8, jawOpen: 0.5 } },
  angry:    { label: 'Angry',    morphs: { browDownLeft: 0.9, browDownRight: 0.9, noseSneerLeft: 0.6, noseSneerRight: 0.6, mouthFrownLeft: 0.5, mouthFrownRight: 0.5 } },
  blink:    { label: 'Blink',    morphs: { eyeBlinkLeft: 1, eyeBlinkRight: 1 } },
  kiss:     { label: 'Kiss',     morphs: { mouthPucker: 0.9, mouthFunnel: 0.4, eyeSquintLeft: 0.3, eyeSquintRight: 0.3 } },
};

/** Default colors */
export const DEFAULT_COLORS = {
  skin: '#d4a574',  // Warm neutral skin — multiplies with baked texture
  hair: '#3d2314',
  eye: '#5b7553',
} as const;

/** Camera presets for quick views — adjusted for MPFB2 body (origin at feet, ~1.66m tall) */
export const CAMERA_PRESETS = {
  fullBody: { position: [0, 0.85, 3.2] as [number, number, number], target: [0, 0.8, 0] as [number, number, number] },
  face:     { position: [0, 1.5, 0.8] as [number, number, number], target: [0, 1.45, 0] as [number, number, number] },
  upper:    { position: [0, 1.2, 1.8] as [number, number, number], target: [0, 1.1, 0] as [number, number, number] },
} as const;

/** Morph value range */
export const MORPH_RANGE = { min: -1, max: 1 } as const;

/** Base asset path for public assets */
export const ASSET_BASE_PATH = '/assets';

/** Bones used for asset fitting — standard Mixamo bone names */
export const FITTING_BONES = {
  head: ['Head', 'head', 'mixamorigHead'],
  neck: ['Neck', 'neck', 'mixamorigNeck'],
  spine: ['Spine', 'spine', 'mixamorigSpine'],
  hips: ['Hips', 'hips', 'mixamorigHips'],
  leftFoot: ['LeftFoot', 'leftFoot', 'mixamorigLeftFoot'],
  rightFoot: ['RightFoot', 'rightFoot', 'mixamorigRightFoot'],
} as const;

import type { AvatarConfig, EthnicityMorphs, FaceDetailMorphs, BodyDetailMorphs, ColorConfig, SlotAssignments } from './schemas';
import { DEFAULT_COLORS, ETHNICITY_MORPHS, FACE_DETAIL_MORPHS, BODY_DETAIL_MORPHS, SYMMETRIC_FACE_MORPHS } from './constants';

export function createDefaultEthnicityMorphs(): EthnicityMorphs {
  return Object.fromEntries(ETHNICITY_MORPHS.map((k) => [k, 0])) as EthnicityMorphs;
}

export function createDefaultFaceDetailMorphs(): FaceDetailMorphs {
  // Include both left-side morphs and their right-side symmetric counterparts
  const entries: [string, number][] = FACE_DETAIL_MORPHS.map((k) => [k, 0]);
  for (const rightKey of Object.values(SYMMETRIC_FACE_MORPHS)) {
    entries.push([rightKey, 0]);
  }
  return Object.fromEntries(entries);
}

export function createDefaultBodyDetailMorphs(): BodyDetailMorphs {
  return Object.fromEntries(BODY_DETAIL_MORPHS.map((k) => [k, 0]));
}

export function createDefaultColors(): ColorConfig {
  return { ...DEFAULT_COLORS };
}

export function createDefaultSlots(): SlotAssignments {
  return {
    hair: null,
    top: null,
    bottom: null,
    shoes: null,
    hat: null,
    glasses: null,
    accessory: null,
  };
}

export function createDefaultAvatarConfig(name = 'My Avatar'): AvatarConfig {
  return {
    name,
    baseBodyId: 'mpfb2_v1',
    ethnicityMorphs: createDefaultEthnicityMorphs(),
    faceDetailMorphs: createDefaultFaceDetailMorphs(),
    bodyDetailMorphs: createDefaultBodyDetailMorphs(),
    colors: createDefaultColors(),
    slots: createDefaultSlots(),
    expression: 'neutral',
  };
}

import { z } from 'zod';
import {
  ASSET_CATEGORIES,
  ASSET_SOURCES,
  BIND_CONTRACTS,
  ATTACHMENT_MODES,
  ETHNICITY_MORPHS,
  FACE_DETAIL_MORPHS,
} from './constants';

// ─── Asset Schemas ────────────────────────────────────

export const AttachmentSchema = z.object({
  mode: z.enum(ATTACHMENT_MODES),
  target: z.string().optional(),
  anchor_local: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

export const AssetItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  file: z.string().min(1),
  thumbnail: z.string().min(1),
  source: z.enum(ASSET_SOURCES).optional().default('makehuman-base'),
  license: z.string().optional().default('CC0'),
  contract_id: z.enum(BIND_CONTRACTS).optional(),
  bind_pose: z.enum(['mpfb2_neutral', 'legacy_static'] as const).optional(),
  scalp_mask: z.string().optional(),
  lods: z.array(z.string()).optional(),
  mh_dir: z.string().optional(),
  attachment: AttachmentSchema.optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const AssetManifestSchema = z.object({
  category: z.enum(ASSET_CATEGORIES),
  items: z.array(AssetItemSchema),
});

// ─── Avatar Config Schemas ────────────────────────────

const morphValue01 = z.number().min(0).max(1);

export const EthnicityMorphsSchema = z.object(
  Object.fromEntries(ETHNICITY_MORPHS.map((k) => [k, morphValue01])) as Record<
    (typeof ETHNICITY_MORPHS)[number],
    z.ZodNumber
  >
);

/** Face detail morphs — all 0-1 range */
export const FaceDetailMorphsSchema = z.record(z.string(), morphValue01);

/** Body detail morphs — all 0-1 range */
export const BodyDetailMorphsSchema = z.record(z.string(), morphValue01);

export const ColorConfigSchema = z.object({
  skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hair: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  eye: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const SlotAssignmentsSchema = z.object({
  hair: z.string().nullable(),
  top: z.string().nullable(),
  bottom: z.string().nullable(),
  shoes: z.string().nullable(),
  hat: z.string().nullable(),
  glasses: z.string().nullable(),
  accessory: z.string().nullable(),
});

export const AvatarConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().default('My Avatar'),
  baseBodyId: z.string().default('mpfb2_v1'),
  ethnicityMorphs: EthnicityMorphsSchema,
  faceDetailMorphs: FaceDetailMorphsSchema,
  bodyDetailMorphs: BodyDetailMorphsSchema.optional().default({}),
  colors: ColorConfigSchema,
  slots: SlotAssignmentsSchema,
  expression: z.string().default('neutral'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const PresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  config: AvatarConfigSchema,
  thumbnail: z.string().optional(),
  createdAt: z.string().datetime(),
});

// ─── Inferred Types ───────────────────────────────────

export type AssetItem = z.infer<typeof AssetItemSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type EthnicityMorphs = z.infer<typeof EthnicityMorphsSchema>;
export type FaceDetailMorphs = z.infer<typeof FaceDetailMorphsSchema>;
export type BodyDetailMorphs = z.infer<typeof BodyDetailMorphsSchema>;
export type ColorConfig = z.infer<typeof ColorConfigSchema>;
export type SlotAssignments = z.infer<typeof SlotAssignmentsSchema>;
export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;
export type Preset = z.infer<typeof PresetSchema>;

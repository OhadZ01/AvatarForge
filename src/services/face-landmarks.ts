/**
 * Client-side face landmark detection using MediaPipe Face Mesh.
 * Extracts 478 3D facial landmarks and computes precise face proportions
 * for avatar morph mapping — runs entirely in the browser.
 */

// @ts-ignore — MediaPipe types exist but bundler resolution struggles with their exports map
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'; // eslint-disable-line

// Landmark indices (MediaPipe canonical 478-point mesh)
// Reference: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
const LM = {
  // Face contour
  FACE_TOP: 10,
  FACE_BOTTOM: 152,     // chin tip
  FACE_LEFT: 234,       // left temple (viewer's right)
  FACE_RIGHT: 454,      // right temple (viewer's left)

  // Jaw
  JAW_LEFT: 172,
  JAW_RIGHT: 397,
  JAW_ANGLE_LEFT: 132,
  JAW_ANGLE_RIGHT: 361,

  // Forehead
  FOREHEAD_TOP: 10,
  FOREHEAD_LEFT: 67,
  FOREHEAD_RIGHT: 297,
  HAIRLINE_CENTER: 10,

  // Eyebrows
  BROW_LEFT_INNER: 107,
  BROW_LEFT_OUTER: 70,
  BROW_LEFT_TOP: 105,
  BROW_RIGHT_INNER: 336,
  BROW_RIGHT_OUTER: 300,
  BROW_RIGHT_TOP: 334,

  // Eyes
  EYE_LEFT_INNER: 133,
  EYE_LEFT_OUTER: 33,
  EYE_LEFT_TOP: 159,
  EYE_LEFT_BOTTOM: 145,
  EYE_LEFT_CENTER: 468,  // iris center
  EYE_RIGHT_INNER: 362,
  EYE_RIGHT_OUTER: 263,
  EYE_RIGHT_TOP: 386,
  EYE_RIGHT_BOTTOM: 374,
  EYE_RIGHT_CENTER: 473, // iris center

  // Nose
  NOSE_TIP: 1,
  NOSE_BRIDGE_TOP: 6,
  NOSE_BRIDGE_MID: 197,
  NOSE_LEFT: 48,
  NOSE_RIGHT: 278,
  NOSE_BOTTOM: 2,
  NOSTRIL_LEFT: 94,
  NOSTRIL_RIGHT: 323,

  // Mouth
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  UPPER_LIP_TOP: 0,
  UPPER_LIP_BOTTOM: 13,
  LOWER_LIP_TOP: 14,
  LOWER_LIP_BOTTOM: 17,

  // Cheeks
  CHEEK_LEFT: 123,
  CHEEK_RIGHT: 352,
  CHEEK_BONE_LEFT: 116,
  CHEEK_BONE_RIGHT: 345,
};

/** Extracted proportions from landmarks (all 0-1, 0.5 = average) */
export interface LandmarkProportions {
  face_width: number;
  jaw_width: number;
  forehead_height: number;
  cheekbone_prominence: number;
  chin_length: number;
  nose_width: number;
  nose_length: number;
  nose_depth: number;
  nose_angle: number;
  eye_spacing: number;
  eye_size: number;
  eye_height: number;
  lip_thickness: number;
  lip_lower_thickness: number;
  mouth_width: number;
  head_roundness: number;
  brow_height: number;
  cheek_fullness: number;
  chin_prominence: number;
  nose_bridge_hump: number;
}

export interface FaceLandmarkAnalysis {
  proportions: LandmarkProportions;
  landmarks: { x: number; y: number; z: number }[];
  faceOvalLandmarks: { x: number; y: number }[];
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

let faceLandmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

/**
 * Initialize MediaPipe Face Landmarker (lazy singleton).
 */
async function getOrCreateLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    return faceLandmarker;
  })();

  return initPromise;
}

/**
 * Helper: Euclidean distance between two landmarks.
 */
function dist(
  landmarks: { x: number; y: number; z: number }[],
  a: number,
  b: number
): number {
  const la = landmarks[a];
  const lb = landmarks[b];
  return Math.sqrt((la.x - lb.x) ** 2 + (la.y - lb.y) ** 2 + (la.z - lb.z) ** 2);
}

/**
 * Helper: Euclidean distance in 2D only (x, y).
 */
function dist2d(
  landmarks: { x: number; y: number; z: number }[],
  a: number,
  b: number
): number {
  const la = landmarks[a];
  const lb = landmarks[b];
  return Math.sqrt((la.x - lb.x) ** 2 + (la.y - lb.y) ** 2);
}

/**
 * Normalize a raw ratio to 0-1 scale based on expected average and range.
 * avg = expected average ratio for that feature
 * range = how much deviation from avg maps to 0 or 1
 */
function normalizeRatio(value: number, avg: number, range: number): number {
  const normalized = 0.5 + (value - avg) / (2 * range);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Compute face proportions from 478 MediaPipe landmarks.
 *
 * All measurements are ratios relative to face height/width to be
 * scale-invariant. Then normalized to 0-1 where 0.5 = average.
 *
 * Reference averages are from anthropometric face studies.
 */
function computeProportions(landmarks: { x: number; y: number; z: number }[]): LandmarkProportions {
  // Fundamental face measurements
  const faceHeight = dist2d(landmarks, LM.FACE_TOP, LM.FACE_BOTTOM);
  const faceWidth = dist2d(landmarks, LM.FACE_LEFT, LM.FACE_RIGHT);

  // Face width/height ratio (average ~0.75-0.80)
  const faceWidthRatio = faceWidth / faceHeight;

  // Jaw width relative to face width (average ~0.85)
  const jawWidth = dist2d(landmarks, LM.JAW_ANGLE_LEFT, LM.JAW_ANGLE_RIGHT);
  const jawWidthRatio = jawWidth / faceWidth;

  // Forehead height: top of face to brow center, relative to face height (average ~0.33)
  const browCenter = {
    x: (landmarks[LM.BROW_LEFT_INNER].x + landmarks[LM.BROW_RIGHT_INNER].x) / 2,
    y: (landmarks[LM.BROW_LEFT_INNER].y + landmarks[LM.BROW_RIGHT_INNER].y) / 2,
  };
  const foreheadHeight = Math.abs(landmarks[LM.FOREHEAD_TOP].y - browCenter.y) / faceHeight;

  // Cheekbone width relative to face width (average ~0.95)
  const cheekboneWidth = dist2d(landmarks, LM.CHEEK_BONE_LEFT, LM.CHEEK_BONE_RIGHT);
  const cheekboneRatio = cheekboneWidth / faceWidth;

  // Chin length: mouth bottom to chin tip, relative to face height (average ~0.20)
  const chinLength = dist2d(landmarks, LM.LOWER_LIP_BOTTOM, LM.FACE_BOTTOM) / faceHeight;

  // Nose width relative to face width (average ~0.25)
  const noseWidth = dist2d(landmarks, LM.NOSE_LEFT, LM.NOSE_RIGHT);
  const noseWidthRatio = noseWidth / faceWidth;

  // Nose length: bridge top to tip, relative to face height (average ~0.30)
  const noseLength = dist2d(landmarks, LM.NOSE_BRIDGE_TOP, LM.NOSE_TIP);
  const noseLengthRatio = noseLength / faceHeight;

  // Nose depth (protrusion from face plane via z-coordinate)
  const noseTipZ = landmarks[LM.NOSE_TIP].z;
  const faceAvgZ = (landmarks[LM.FACE_LEFT].z + landmarks[LM.FACE_RIGHT].z) / 2;
  const noseDepthRatio = Math.abs(noseTipZ - faceAvgZ) / faceWidth;

  // Nose angle: angle of nose tip relative to bridge
  const noseBridgeTop = landmarks[LM.NOSE_BRIDGE_TOP];
  const noseTip = landmarks[LM.NOSE_TIP];
  const noseAngle = Math.atan2(noseTip.y - noseBridgeTop.y, Math.abs(noseTip.z - noseBridgeTop.z));

  // Nose bridge hump - deviation of mid-bridge from straight line between top and tip
  const noseMid = landmarks[LM.NOSE_BRIDGE_MID];
  const expectedMidZ = (noseBridgeTop.z + noseTip.z) / 2;
  const noseHump = (noseMid.z - expectedMidZ) / faceWidth;

  // Eye spacing: distance between inner eye corners, relative to face width (average ~0.28)
  const eyeSpacing = dist2d(landmarks, LM.EYE_LEFT_INNER, LM.EYE_RIGHT_INNER);
  const eyeSpacingRatio = eyeSpacing / faceWidth;

  // Eye size: average eye width relative to face width (average ~0.22)
  const leftEyeWidth = dist2d(landmarks, LM.EYE_LEFT_INNER, LM.EYE_LEFT_OUTER);
  const rightEyeWidth = dist2d(landmarks, LM.EYE_RIGHT_INNER, LM.EYE_RIGHT_OUTER);
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
  const eyeSizeRatio = avgEyeWidth / faceWidth;

  // Eye height (openness): average eye height relative to eye width (average ~0.35)
  const leftEyeHeight = dist2d(landmarks, LM.EYE_LEFT_TOP, LM.EYE_LEFT_BOTTOM);
  const rightEyeHeight = dist2d(landmarks, LM.EYE_RIGHT_TOP, LM.EYE_RIGHT_BOTTOM);
  const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
  const eyeHeightRatio = avgEyeHeight / avgEyeWidth;

  // Lip thickness: total lip height relative to face height (average ~0.085)
  const upperLipThickness = dist2d(landmarks, LM.UPPER_LIP_TOP, LM.UPPER_LIP_BOTTOM);
  const lowerLipThickness = dist2d(landmarks, LM.LOWER_LIP_TOP, LM.LOWER_LIP_BOTTOM);
  const totalLipThickness = (upperLipThickness + lowerLipThickness) / faceHeight;
  const lowerLipRatio = lowerLipThickness / faceHeight;

  // Mouth width relative to face width (average ~0.38)
  const mouthWidth = dist2d(landmarks, LM.MOUTH_LEFT, LM.MOUTH_RIGHT);
  const mouthWidthRatio = mouthWidth / faceWidth;

  // Head roundness: face width / height ratio (round > 0.85, long < 0.75)
  const headRoundness = faceWidthRatio;

  // Brow height: brow to eye top, relative to eye height (average ~1.5)
  const leftBrowHeight = dist2d(landmarks, LM.BROW_LEFT_TOP, LM.EYE_LEFT_TOP);
  const rightBrowHeight = dist2d(landmarks, LM.BROW_RIGHT_TOP, LM.EYE_RIGHT_TOP);
  const avgBrowHeight = (leftBrowHeight + rightBrowHeight) / 2;
  const browHeightRatio = avgBrowHeight / avgEyeHeight;

  // Cheek fullness: distance from cheekbone to jaw relative to face height (average ~0.20)
  const leftCheekFullness = dist2d(landmarks, LM.CHEEK_LEFT, LM.JAW_LEFT);
  const rightCheekFullness = dist2d(landmarks, LM.CHEEK_RIGHT, LM.JAW_RIGHT);
  const cheekFullnessRatio = ((leftCheekFullness + rightCheekFullness) / 2) / faceHeight;

  // Chin prominence (z-depth of chin relative to mouth)
  const chinZ = landmarks[LM.FACE_BOTTOM].z;
  const mouthZ = (landmarks[LM.MOUTH_LEFT].z + landmarks[LM.MOUTH_RIGHT].z) / 2;
  const chinProminence = (chinZ - mouthZ) / faceWidth;

  // Normalize all ratios to 0-1 scale (0.5 = average)
  return {
    face_width:            normalizeRatio(faceWidthRatio, 0.78, 0.15),
    jaw_width:             normalizeRatio(jawWidthRatio, 0.85, 0.15),
    forehead_height:       normalizeRatio(foreheadHeight, 0.33, 0.10),
    cheekbone_prominence:  normalizeRatio(cheekboneRatio, 0.95, 0.10),
    chin_length:           normalizeRatio(chinLength, 0.20, 0.08),
    nose_width:            normalizeRatio(noseWidthRatio, 0.25, 0.08),
    nose_length:           normalizeRatio(noseLengthRatio, 0.30, 0.08),
    nose_depth:            normalizeRatio(noseDepthRatio, 0.12, 0.06),
    nose_angle:            normalizeRatio(noseAngle, 1.1, 0.4),
    eye_spacing:           normalizeRatio(eyeSpacingRatio, 0.28, 0.06),
    eye_size:              normalizeRatio(eyeSizeRatio, 0.22, 0.05),
    eye_height:            normalizeRatio(eyeHeightRatio, 0.35, 0.12),
    lip_thickness:         normalizeRatio(totalLipThickness, 0.085, 0.04),
    lip_lower_thickness:   normalizeRatio(lowerLipRatio, 0.05, 0.025),
    mouth_width:           normalizeRatio(mouthWidthRatio, 0.38, 0.08),
    head_roundness:        normalizeRatio(headRoundness, 0.78, 0.12),
    brow_height:           normalizeRatio(browHeightRatio, 1.5, 0.6),
    cheek_fullness:        normalizeRatio(cheekFullnessRatio, 0.20, 0.06),
    chin_prominence:       normalizeRatio(chinProminence, -0.02, 0.04),
    nose_bridge_hump:      normalizeRatio(noseHump, 0, 0.03),
  };
}

/**
 * Detect face landmarks from an image file.
 * Returns precise face proportions computed from 478 landmarks.
 */
export async function detectFaceLandmarks(imageFile: File | Blob): Promise<FaceLandmarkAnalysis> {
  const landmarker = await getOrCreateLandmarker();

  // Load image into an HTMLImageElement
  const bitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  // Create image element for MediaPipe
  const img = document.createElement('img');
  const loadPromise = new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });
  img.src = canvas.toDataURL();
  await loadPromise;

  // Run detection
  const result: FaceLandmarkerResult = landmarker.detect(img);

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    throw new Error('No face detected in the image. Please upload a clear, front-facing photo.');
  }

  const landmarks = result.faceLandmarks[0];

  // Get face oval landmarks for visualization
  const faceOvalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
  const faceOvalLandmarks = faceOvalIndices.map(i => ({
    x: landmarks[i].x,
    y: landmarks[i].y,
  }));

  // Compute proportions
  const proportions = computeProportions(landmarks);

  // Confidence from face detection score
  const confidence = 0.85; // MediaPipe doesn't expose per-face confidence easily

  // Cleanup
  bitmap.close();

  return {
    proportions,
    landmarks: landmarks.map((l: { x: number; y: number; z: number }) => ({ x: l.x, y: l.y, z: l.z })),
    faceOvalLandmarks,
    confidence,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  };
}

/**
 * Extract dominant colors from the image at specific facial regions.
 * Uses canvas pixel sampling at landmark positions.
 */
export async function extractFaceColors(
  imageFile: File | Blob,
  landmarks: { x: number; y: number; z: number }[]
): Promise<{ skin: string; eye: string; hair: string }> {
  const bitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  const getPixelColor = (landmarkIdx: number): [number, number, number] => {
    const lm = landmarks[landmarkIdx];
    const x = Math.round(lm.x * canvas.width);
    const y = Math.round(lm.y * canvas.height);
    const data = ctx.getImageData(
      Math.max(0, x - 2), Math.max(0, y - 2), 5, 5
    ).data;

    // Average the 5x5 region
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
  };

  const avgColor = (indices: number[]): [number, number, number] => {
    let r = 0, g = 0, b = 0;
    for (const idx of indices) {
      const [cr, cg, cb] = getPixelColor(idx);
      r += cr; g += cg; b += cb;
    }
    const n = indices.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  };

  const toHex = ([r, g, b]: [number, number, number]): string =>
    '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');

  // Sample skin from multiple cheek/forehead regions for accuracy
  const skinColor = avgColor([LM.CHEEK_LEFT, LM.CHEEK_RIGHT, LM.FOREHEAD_LEFT, LM.FOREHEAD_RIGHT]);

  // Sample eye color from iris centers
  const eyeColor = avgColor([LM.EYE_LEFT_CENTER, LM.EYE_RIGHT_CENTER]);

  // Sample hair from above the forehead (above landmark 10)
  // Use a point above the hairline
  const hairlineY = landmarks[LM.HAIRLINE_CENTER].y;
  const hairSampleY = Math.max(0, hairlineY - 0.05); // 5% above hairline
  const hairX = landmarks[LM.HAIRLINE_CENTER].x;
  const hx = Math.round(hairX * canvas.width);
  const hy = Math.round(hairSampleY * canvas.height);
  const hairData = ctx.getImageData(
    Math.max(0, hx - 5), Math.max(0, hy - 5), 11, 11
  ).data;
  let hr = 0, hg = 0, hb = 0, hcount = 0;
  for (let i = 0; i < hairData.length; i += 4) {
    hr += hairData[i]; hg += hairData[i + 1]; hb += hairData[i + 2]; hcount++;
  }
  const hairColor: [number, number, number] = [
    Math.round(hr / hcount), Math.round(hg / hcount), Math.round(hb / hcount)
  ];

  bitmap.close();

  return {
    skin: toHex(skinColor),
    eye: toHex(eyeColor),
    hair: toHex(hairColor),
  };
}

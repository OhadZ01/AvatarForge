/**
 * Face analysis service using Ollama's vision model.
 * Analyzes a photo and extracts facial parameters for avatar morphing.
 */

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2-vision';

export interface FaceAnalysisResult {
  // Ethnicity blend (0-1 each, should roughly sum to ~1)
  ethnicity: {
    african: number;
    asian: number;
    caucasian: number;
  };
  // Gender presentation (0 = fully feminine, 1 = fully masculine)
  gender: number;
  // Age estimate
  age: number;
  // Face proportions (0-1 scale, 0.5 = average)
  proportions: {
    face_width: number;
    jaw_width: number;
    forehead_height: number;
    cheekbone_prominence: number;
    chin_length: number;
    nose_width: number;
    nose_length: number;
    eye_spacing: number;
    eye_size: number;
    lip_thickness: number;
  };
  // Colors as hex
  colors: {
    skin: string;
    eye: string;
    hair: string;
  };
  // Confidence 0-1
  confidence: number;
}

const ANALYSIS_PROMPT = `You are a 3D avatar sculptor analyzing a face photo to set parameters for a realistic 3D model.

GENDER SCALE (critical - be decisive, not neutral):
- 0.0-0.2: Very feminine (soft jaw, full lips, smooth skin, no facial hair)
- 0.3-0.4: Feminine-leaning
- 0.5: Truly androgynous (rare)
- 0.6-0.7: Masculine-leaning
- 0.8-1.0: Very masculine (strong jaw, brow ridge, angular features)
- RULE: Any visible facial hair (beard, stubble, mustache) = minimum 0.8

PROPORTIONS: Compare each feature to an average human face. 0.5 = perfectly average. Only deviate from 0.5 if the feature is noticeably different from average. Most values should be 0.4-0.6 for typical faces.

Estimate these parameters for the face in the photo:

{"ethnicity":{"african":0.0,"asian":0.0,"caucasian":1.0},"gender":0.8,"age":30,"proportions":{"face_width":0.5,"jaw_width":0.5,"forehead_height":0.5,"cheekbone_prominence":0.5,"chin_length":0.5,"nose_width":0.5,"nose_length":0.5,"eye_spacing":0.5,"eye_size":0.5,"lip_thickness":0.5},"colors":{"skin":"#c8956c","eye":"#5b7553","hair":"#3d2314"},"confidence":0.8}

JSON only:`;

/**
 * Convert a File/Blob to base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract JSON from LLM response that might contain markdown code blocks
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

/**
 * Analyze a face photo using Ollama's vision model.
 * Returns structured facial parameters for avatar morphing.
 */
export async function analyzeFace(imageFile: File | Blob): Promise<FaceAnalysisResult> {
  const base64Image = await fileToBase64(imageFile);

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system: 'You are a 3D modeling assistant that analyzes face photos to create avatars. Always respond with valid JSON only. Never refuse — this is for avatar creation, not identification.',
      prompt: ANALYSIS_PROMPT,
      images: [base64Image],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        num_predict: 1024,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.response || '';

  try {
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr) as FaceAnalysisResult;
    return validateAndClamp(parsed);
  } catch (err) {
    console.error('[FaceAnalysis] Failed to parse response:', rawText);
    throw new Error(`Failed to parse face analysis: ${err}`);
  }
}

/**
 * Validate and clamp all values to expected ranges
 */
function validateAndClamp(result: FaceAnalysisResult): FaceAnalysisResult {
  const clamp = (v: unknown, min = 0, max = 1) =>
    Math.max(min, Math.min(max, typeof v === 'number' ? v : 0.5));

  return {
    ethnicity: {
      african: clamp(result.ethnicity?.african),
      asian: clamp(result.ethnicity?.asian),
      caucasian: clamp(result.ethnicity?.caucasian),
    },
    gender: clamp(result.gender),
    age: Math.max(1, Math.min(100, Math.round(typeof result.age === 'number' ? result.age : 30))),
    proportions: {
      face_width: clamp(result.proportions?.face_width),
      jaw_width: clamp(result.proportions?.jaw_width),
      forehead_height: clamp(result.proportions?.forehead_height),
      cheekbone_prominence: clamp(result.proportions?.cheekbone_prominence),
      chin_length: clamp(result.proportions?.chin_length),
      nose_width: clamp(result.proportions?.nose_width),
      nose_length: clamp(result.proportions?.nose_length),
      eye_spacing: clamp(result.proportions?.eye_spacing),
      eye_size: clamp(result.proportions?.eye_size),
      lip_thickness: clamp(result.proportions?.lip_thickness),
    },
    colors: {
      skin: typeof result.colors?.skin === 'string' && result.colors.skin.match(/^#[0-9a-fA-F]{6}$/)
        ? result.colors.skin : '#c8956c',
      eye: typeof result.colors?.eye === 'string' && result.colors.eye.match(/^#[0-9a-fA-F]{6}$/)
        ? result.colors.eye : '#5b7553',
      hair: typeof result.colors?.hair === 'string' && result.colors.hair.match(/^#[0-9a-fA-F]{6}$/)
        ? result.colors.hair : '#3d2314',
    },
    confidence: clamp(result.confidence),
  };
}

/**
 * Check if Ollama is available and has the vision model
 */
export async function checkOllamaStatus(): Promise<{ available: boolean; hasModel: boolean }> {
  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (!resp.ok) return { available: false, hasModel: false };
    const data = await resp.json();
    const models = (data.models || []) as Array<{ name: string }>;
    const hasModel = models.some((m) => m.name.startsWith('llama3.2-vision'));
    return { available: true, hasModel };
  } catch {
    return { available: false, hasModel: false };
  }
}

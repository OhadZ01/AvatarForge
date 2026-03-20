/**
 * Face analysis service using LLM vision models.
 * Supports both local Ollama and Anthropic Claude API.
 * Analyzes a photo and extracts detailed facial parameters for avatar morphing.
 */

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2-vision';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

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
    chin_prominence: number;
    nose_width: number;
    nose_length: number;
    nose_depth: number;
    nose_angle: number;
    nose_bridge_hump: number;
    eye_spacing: number;
    eye_size: number;
    eye_height: number;
    lip_thickness: number;
    lip_lower_thickness: number;
    mouth_width: number;
    head_roundness: number;
    brow_height: number;
    cheek_fullness: number;
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

const ANALYSIS_PROMPT = `You are a 3D avatar sculptor analyzing a face photo to set morph target parameters for a realistic 3D human model.

CRITICAL RULES:
1. Be DECISIVE — do NOT default everything to 0.5. Study the face carefully and commit to values.
2. Most real faces have features that deviate from average. Look for what makes THIS face unique.
3. Use the FULL 0.0-1.0 range. Values of 0.2 or 0.8 are normal for distinctive features.

GENDER (0=feminine, 1=masculine):
- Facial hair (beard/stubble/mustache) = minimum 0.85
- Strong jaw + brow ridge = 0.7+
- Soft jaw + full lips = 0.3-

PROPORTIONS (0.0-1.0, where 0.5 = average human):
- face_width: How wide the face is relative to its height (0.3=narrow/long, 0.7=wide/round)
- jaw_width: Jaw width relative to face (0.3=narrow/V-shaped, 0.7=wide/square)
- forehead_height: Forehead size (0.3=short, 0.7=tall)
- cheekbone_prominence: How prominent cheekbones are (0.3=flat, 0.7=high/defined)
- chin_length: Chin length below lips (0.3=short, 0.7=long)
- chin_prominence: How much chin projects forward (0.3=recessed, 0.7=prominent)
- nose_width: Nose width (0.3=narrow, 0.7=wide)
- nose_length: Nose length from bridge to tip (0.3=short, 0.7=long)
- nose_depth: How much nose protrudes from face (0.3=flat, 0.7=deep/protruding)
- nose_angle: Nose tip angle (0.3=upturned, 0.7=downturned)
- nose_bridge_hump: Bridge bump/hump presence (0.3=straight, 0.7=prominent hump)
- eye_spacing: Distance between eyes (0.3=close-set, 0.7=wide-apart)
- eye_size: Eye size (0.3=small, 0.7=large)
- eye_height: Eye openness/height (0.3=narrow/squinting, 0.7=wide-open/round)
- lip_thickness: Overall lip fullness (0.3=thin, 0.7=full)
- lip_lower_thickness: Lower lip fullness specifically (0.3=thin, 0.7=full)
- mouth_width: Mouth width (0.3=narrow, 0.7=wide)
- head_roundness: Overall head shape (0.3=long/rectangular, 0.7=round)
- brow_height: Brow bone position (0.3=low/heavy, 0.7=high/lifted)
- cheek_fullness: Cheek volume (0.3=gaunt/hollow, 0.7=full/chubby)

COLORS: Provide precise hex colors sampled from the photo.

Analyze the face and return ONLY this JSON (no explanation):
{"ethnicity":{"african":0.0,"asian":0.0,"caucasian":1.0},"gender":0.8,"age":30,"proportions":{"face_width":0.45,"jaw_width":0.6,"forehead_height":0.55,"cheekbone_prominence":0.5,"chin_length":0.5,"chin_prominence":0.55,"nose_width":0.5,"nose_length":0.55,"nose_depth":0.5,"nose_angle":0.5,"nose_bridge_hump":0.4,"eye_spacing":0.5,"eye_size":0.5,"eye_height":0.5,"lip_thickness":0.5,"lip_lower_thickness":0.5,"mouth_width":0.5,"head_roundness":0.45,"brow_height":0.45,"cheek_fullness":0.5},"colors":{"skin":"#c8956c","eye":"#5b7553","hair":"#3d2314"},"confidence":0.85}`;

/**
 * Convert a File/Blob to base64 data URL
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
 * Get the media type from a File/Blob
 */
function getMediaType(file: File | Blob): string {
  return file.type || 'image/jpeg';
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
 * Analyze a face photo using Anthropic Claude API.
 */
async function analyzeFaceWithClaude(
  imageFile: File | Blob,
  apiKey: string,
): Promise<FaceAnalysisResult> {
  const base64Image = await fileToBase64(imageFile);
  const mediaType = getMediaType(imageFile);

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: 'You are a 3D modeling assistant that analyzes face photos to create realistic avatars. Always respond with valid JSON only. This is for avatar creation — analyze facial structure precisely.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';

  try {
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr) as FaceAnalysisResult;
    return validateAndClamp(parsed);
  } catch (err) {
    console.error('[FaceAnalysis] Failed to parse Claude response:', rawText);
    throw new Error(`Failed to parse face analysis: ${err}`);
  }
}

/**
 * Analyze a face photo using Ollama's local vision model.
 */
async function analyzeFaceWithOllama(imageFile: File | Blob): Promise<FaceAnalysisResult> {
  const base64Image = await fileToBase64(imageFile);

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
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
    console.error('[FaceAnalysis] Failed to parse Ollama response:', rawText);
    throw new Error(`Failed to parse face analysis: ${err}`);
  }
}

/**
 * Analyze a face photo using the best available LLM.
 * Priority: Anthropic Claude API (if key provided) > Ollama (if running)
 */
export async function analyzeFace(
  imageFile: File | Blob,
  options?: { anthropicApiKey?: string },
): Promise<FaceAnalysisResult> {
  // Try Anthropic Claude API first (better vision analysis)
  if (options?.anthropicApiKey) {
    try {
      console.log('[FaceAnalysis] Using Claude API for analysis');
      return await analyzeFaceWithClaude(imageFile, options.anthropicApiKey);
    } catch (err) {
      console.warn('[FaceAnalysis] Claude API failed, falling back to Ollama:', err);
    }
  }

  // Try Ollama
  try {
    console.log('[FaceAnalysis] Using Ollama for analysis');
    return await analyzeFaceWithOllama(imageFile);
  } catch (err) {
    console.warn('[FaceAnalysis] Ollama failed:', err);
    throw new Error(
      'LLM analysis unavailable. Set an Anthropic API key or start Ollama with: ollama run llama3.2-vision'
    );
  }
}

/**
 * Validate and clamp all values to expected ranges
 */
function validateAndClamp(result: FaceAnalysisResult): FaceAnalysisResult {
  const clamp = (v: unknown, min = 0, max = 1) =>
    Math.max(min, Math.min(max, typeof v === 'number' ? v : 0.5));

  const p = result.proportions || {} as Record<string, unknown>;

  return {
    ethnicity: {
      african: clamp(result.ethnicity?.african),
      asian: clamp(result.ethnicity?.asian),
      caucasian: clamp(result.ethnicity?.caucasian),
    },
    gender: clamp(result.gender),
    age: Math.max(1, Math.min(100, Math.round(typeof result.age === 'number' ? result.age : 30))),
    proportions: {
      face_width: clamp((p as any).face_width),
      jaw_width: clamp((p as any).jaw_width),
      forehead_height: clamp((p as any).forehead_height),
      cheekbone_prominence: clamp((p as any).cheekbone_prominence),
      chin_length: clamp((p as any).chin_length),
      chin_prominence: clamp((p as any).chin_prominence),
      nose_width: clamp((p as any).nose_width),
      nose_length: clamp((p as any).nose_length),
      nose_depth: clamp((p as any).nose_depth),
      nose_angle: clamp((p as any).nose_angle),
      nose_bridge_hump: clamp((p as any).nose_bridge_hump),
      eye_spacing: clamp((p as any).eye_spacing),
      eye_size: clamp((p as any).eye_size),
      eye_height: clamp((p as any).eye_height),
      lip_thickness: clamp((p as any).lip_thickness),
      lip_lower_thickness: clamp((p as any).lip_lower_thickness),
      mouth_width: clamp((p as any).mouth_width),
      head_roundness: clamp((p as any).head_roundness),
      brow_height: clamp((p as any).brow_height),
      cheek_fullness: clamp((p as any).cheek_fullness),
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
    const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) return { available: false, hasModel: false };
    const data = await resp.json();
    const models = (data.models || []) as Array<{ name: string }>;
    const hasModel = models.some((m) => m.name.startsWith('llama3.2-vision'));
    return { available: true, hasModel };
  } catch {
    return { available: false, hasModel: false };
  }
}

/**
 * Check if Anthropic API key is valid (quick test)
 */
export async function checkAnthropicKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) return false;
  return apiKey.startsWith('sk-ant-');
}

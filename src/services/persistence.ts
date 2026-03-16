import { AvatarConfigSchema, PresetSchema, type AvatarConfig, type Preset } from '@/domain/schemas';

const STORAGE_KEYS = {
  DRAFT: 'avatarforge:draft',
  PRESETS: 'avatarforge:presets',
} as const;

function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ─── Draft Autosave ───────────────────────────────────

export function saveDraft(config: AvatarConfig): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(config));
  } catch (err) {
    console.warn('[Persistence] Failed to save draft:', err);
  }
}

export function loadDraft(): AvatarConfig | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (!raw) return null;
    const parsed = AvatarConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(STORAGE_KEYS.DRAFT);
}

// ─── Presets ──────────────────────────────────────────

export function loadPresets(): Preset[] {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESETS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const results = arr.map((item: unknown) => PresetSchema.safeParse(item));
    return results
      .filter((r): r is { success: true; data: Preset } => r.success)
      .map((r) => r.data);
  } catch {
    return [];
  }
}

export function savePreset(preset: Preset): void {
  if (!isLocalStorageAvailable()) return;
  const presets = loadPresets();
  const existingIndex = presets.findIndex((p) => p.id === preset.id);
  if (existingIndex >= 0) {
    presets[existingIndex] = preset;
  } else {
    presets.push(preset);
  }
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
}

export function deletePreset(id: string): void {
  if (!isLocalStorageAvailable()) return;
  const presets = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
}

// ─── Config Export/Import ─────────────────────────────

export function exportConfigAsJson(config: AvatarConfig): void {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `avatar-${config.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfigFromJson(file: File): Promise<AvatarConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const parsed = AvatarConfigSchema.safeParse(raw);
        if (parsed.success) {
          resolve(parsed.data);
        } else {
          reject(new Error('Invalid avatar configuration file'));
        }
      } catch {
        reject(new Error('Failed to parse configuration file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

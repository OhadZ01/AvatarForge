import type { RootState } from '@react-three/fiber';

/**
 * Screenshot capture from the R3F canvas.
 * Cleanly isolated from UI code — takes a gl context and returns a blob.
 */

export function captureScreenshot(gl: RootState['gl']): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = gl.domElement;
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture screenshot: toBlob returned null'));
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

export function downloadScreenshot(blob: Blob, filename = 'avatar-screenshot.png'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

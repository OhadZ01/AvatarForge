import type { RootState } from '@react-three/fiber';

/**
 * Screenshot capture from the R3F canvas.
 * Cleanly isolated from UI code — takes a gl context and returns a blob.
 */

export function captureScreenshot(gl: RootState['gl'], width = 1920, height = 1080): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Force a render at the desired resolution
      const canvas = gl.domElement;
      const dataUrl = canvas.toDataURL('image/png');

      // Convert data URL to blob
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      resolve(new Blob([ab], { type: mimeString }));
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

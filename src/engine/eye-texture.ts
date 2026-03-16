import * as THREE from 'three';

/**
 * Generates a procedural eye texture with realistic iris fibers,
 * limbal ring, pupil, and sclera with blood vessels.
 *
 * Isolated from the component tree — pure function, no React dependencies.
 * This prevents the old pattern of regenerating textures on every render.
 */
export function generateEyeTexture(irisColorHex: string, size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const maxDist = size * 0.5;

  const irisColor = new THREE.Color(irisColorHex);
  const iR = Math.round(irisColor.r * 255);
  const iG = Math.round(irisColor.g * 255);
  const iB = Math.round(irisColor.b * 255);

  // Iris proportions tuned for MPFB2 spherical eye meshes (UVs span full [0,1])
  const irisRadius = size * 0.22;
  const pupilRadius = irisRadius * 0.35;
  const limbalRadius = irisRadius * 1.10;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      if (dist < pupilRadius) {
        const t = dist / pupilRadius;
        if (t > 0.8) {
          const blend = (t - 0.8) / 0.2;
          const v = Math.round(8 + blend * 25);
          data[idx] = v; data[idx + 1] = v; data[idx + 2] = v;
        } else {
          data[idx] = 8; data[idx + 1] = 8; data[idx + 2] = 8;
        }
      } else if (dist < irisRadius) {
        const t = (dist - pupilRadius) / (irisRadius - pupilRadius);
        const fiber1 = 0.5 + 0.5 * Math.sin(angle * 37.0);
        const fiber2 = 0.5 + 0.5 * Math.sin(angle * 23.0 + 1.5);
        const fiber3 = 0.5 + 0.5 * Math.sin(angle * 53.0 + 0.7);
        const fiberMix = 0.65 + 0.35 * (fiber1 * 0.45 + fiber2 * 0.35 + fiber3 * 0.2);
        let collarette = 1.0;
        if (t > 0.3 && t < 0.5) {
          collarette = 1.0 + 0.15 * Math.sin((t - 0.3) / 0.2 * Math.PI);
        }
        let darken = (1.0 - t * 0.4) * fiberMix * collarette;
        if (t > 0.85) {
          const ringBlend = (t - 0.85) / 0.15;
          darken *= (1.0 - ringBlend * 0.45);
        }
        data[idx] = Math.max(0, Math.min(255, Math.round(iR * darken)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(iG * darken)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(iB * darken)));
      } else if (dist < limbalRadius) {
        const t = (dist - irisRadius) / (limbalRadius - irisRadius);
        const fade = 1.0 - t * 0.6;
        data[idx] = Math.round(iR * 0.2 * fade + 230 * (1 - fade));
        data[idx + 1] = Math.round(iG * 0.2 * fade + 228 * (1 - fade));
        data[idx + 2] = Math.round(iB * 0.2 * fade + 226 * (1 - fade));
      } else {
        // Sclera with blood vessels and edge shadow
        let sR = 238, sG = 236, sB = 232;
        const vesselAngle = angle + dist * 0.02;
        const v1 = Math.max(0, Math.sin(vesselAngle * 7.0 + dist * 0.15) - 0.7) / 0.3;
        const v2 = Math.max(0, Math.sin(vesselAngle * 11.0 - dist * 0.1 + 2.0) - 0.75) / 0.25;
        const vesselIntensity = (v1 * 0.6 + v2 * 0.4) * 0.12;
        sR = Math.min(255, Math.round(sR + vesselIntensity * 40));
        sG = Math.round(sG - vesselIntensity * 20);
        sB = Math.round(sB - vesselIntensity * 25);
        const edgeT = dist / maxDist;
        if (edgeT > 0.85) {
          const shadow = 1.0 - (edgeT - 0.85) / 0.15 * 0.55;
          sR = Math.round(sR * shadow);
          sG = Math.round(sG * shadow);
          sB = Math.round(sB * shadow);
        }
        data[idx] = sR; data[idx + 1] = sG; data[idx + 2] = sB;
      }
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

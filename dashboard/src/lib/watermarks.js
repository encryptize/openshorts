// Watermark preset persistence (localStorage).
//
// Follows the same browser-local pattern as the API keys (elevenLabsKey_v1,
// os_* keys): presets don't sync across devices, and the uploaded PNG persists
// server-side — only the preset config (offsets + which PNG) lives here.

const STORAGE_KEY = 'watermarkPresets_v1';

export function getWatermarkPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveWatermarkPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function addWatermarkPreset(preset) {
  const presets = getWatermarkPresets();
  presets.push(preset);
  saveWatermarkPresets(presets);
  return presets;
}

export function removeWatermarkPreset(id) {
  const presets = getWatermarkPresets().filter((p) => p.id !== id);
  saveWatermarkPresets(presets);
  return presets;
}
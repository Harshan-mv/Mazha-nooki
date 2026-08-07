// Kept in sync with backend/src/utils/rainfall.js — IMD-style 24hr rainfall categories.
window.RAINFALL_LEVELS = [
  { key: 'no_rain', label: 'No rain', max: 0.0, color: '#d8dee2' },
  { key: 'very_light', label: 'Very light (0.1–2.5mm)', max: 2.5, color: '#a9d6a5' },
  { key: 'light', label: 'Light (2.5–15.5mm)', max: 15.5, color: '#4f9d5a' },
  { key: 'moderate', label: 'Moderate (15.6–64.4mm)', max: 64.4, color: '#f2c94c' },
  { key: 'heavy', label: 'Heavy (64.5–115.5mm)', max: 115.5, color: '#f2994a' },
  { key: 'very_heavy', label: 'Very heavy (115.6–204.4mm)', max: 204.4, color: '#eb5757' },
  { key: 'extremely_heavy', label: 'Extremely heavy (>204.4mm)', max: Infinity, color: '#8e2de2' }
];

window.classifyRainfall = function classifyRainfall(mm) {
  if (mm === null || mm === undefined || Number.isNaN(mm)) return null;
  for (const level of window.RAINFALL_LEVELS) {
    if (mm <= level.max) return level;
  }
  return window.RAINFALL_LEVELS[window.RAINFALL_LEVELS.length - 1];
};

/**
 * Rainfall intensity classification for a 24-hour total, following the
 * India Meteorological Department's standard categories. Used to decide
 * the alert colour/level shown on the map.
 */
const LEVELS = [
  { key: 'no_rain', label: 'No rain', max: 0.0, color: '#d8dee2' },
  { key: 'very_light', label: 'Very light rain', max: 2.5, color: '#a9d6a5' },
  { key: 'light', label: 'Light rain', max: 15.5, color: '#4f9d5a' },
  { key: 'moderate', label: 'Moderate rain', max: 64.4, color: '#f2c94c' },
  { key: 'heavy', label: 'Heavy rain', max: 115.5, color: '#f2994a' },
  { key: 'very_heavy', label: 'Very heavy rain', max: 204.4, color: '#eb5757' },
  { key: 'extremely_heavy', label: 'Extremely heavy rain', max: Infinity, color: '#8e2de2' }
];

function classify(mm) {
  if (mm == null || Number.isNaN(mm)) return null;
  for (const level of LEVELS) {
    if (mm <= level.max) return level;
  }
  return LEVELS[LEVELS.length - 1];
}

module.exports = { LEVELS, classify };

export const GAME_IDS = ['name-part','find-part','match','build','defect','bending','loading','stability','ship-type','watertight'];
export const PROGRESS_KEY = 'shipstruct-minigames-v1';

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function normalizeAnswer(value) {
  return String(value ?? '').toLowerCase().normalize('NFKC').replace(/centre/g, 'center')
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export function matchesAnswer(value, aliases) {
  const normalized = normalizeAnswer(value);
  return normalized.length > 0 && aliases.some(alias => normalizeAnswer(alias) === normalized);
}
export function scorePercent(earned, possible) {
  if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return 0;
  return Math.round(Math.max(0, Math.min(1, earned / possible)) * 100);
}
export function blankProgress() { return { version: 1, games: {} }; }
export function readProgress(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.games || typeof value.games !== 'object') return blankProgress();
    const clean = blankProgress();
    for (const id of GAME_IDS) {
      const entry = value.games[id];
      if (!entry || typeof entry !== 'object') continue;
      const modes = {};
      for (const mode of ['practice','challenge']) {
        const stat = entry[mode];
        if (!stat || !Number.isFinite(stat.best) || !Number.isInteger(stat.runs) || stat.runs < 1) continue;
        modes[mode] = { best: Math.max(0, Math.min(100, Math.round(stat.best))), runs: Math.min(stat.runs, 100000), last: typeof stat.last === 'string' ? stat.last.slice(0,30) : '' };
      }
      if (Object.keys(modes).length) clean.games[id] = modes;
    }
    return clean;
  } catch { return blankProgress(); }
}
export function recordResult(progress, id, mode, earned, possible, now = new Date().toISOString()) {
  if (!GAME_IDS.includes(id) || !['practice','challenge'].includes(mode)) throw new Error('Unknown game or mode');
  const clean = readProgress(JSON.stringify(progress));
  const previous = clean.games[id]?.[mode];
  clean.games[id] = { ...clean.games[id], [mode]: { best: Math.max(previous?.best ?? 0, scorePercent(earned, possible)), runs: (previous?.runs ?? 0) + 1, last: now } };
  return clean;
}
export function markFirstAttempt(state, key, correct) {
  if (Object.hasOwn(state.attempts, key)) return false;
  state.attempts[key] = Boolean(correct);
  if (correct) state.earned++;
  return true;
}
// Coordinates are signed station distances in metres. These are cargo moments,
// not an approved loading computer or a shear-force / bending-moment model.
export const LOAD_CELLS = Array.from({ length: 9 }, (_, i) => ({
  id: String(i), row: Math.floor(i / 3), col: i % 3,
  longitudinal: [10,0,-10][Math.floor(i / 3)], transverse: [-5,0,5][i % 3]
}));
export function loadingBalance(weights, placements, capacity = Infinity) {
  let longitudinal = 0, transverse = 0, total = 0;
  const seen = new Set();
  const valid = placements.length === weights.length && placements.every((cellId, index) => {
    const cell = LOAD_CELLS.find(cell => cell.id === cellId);
    if (!cell || seen.has(cellId) || !Number.isFinite(weights[index]) || weights[index] <= 0 || weights[index] > capacity) return false;
    seen.add(cellId); total += weights[index];
    longitudinal += weights[index] * cell.longitudinal;
    transverse += weights[index] * cell.transverse;
    return true;
  });
  return { valid, total, longitudinal, transverse, balanced: valid && longitudinal === 0 && transverse === 0 };
}
export function partialMoments(weights, placements) {
  return placements.reduce((sum, cellId, index) => {
    const cell = LOAD_CELLS.find(cell => cell.id === cellId);
    if (cell) { sum.longitudinal += weights[index] * cell.longitudinal; sum.transverse += weights[index] * cell.transverse; }
    return sum;
  }, { longitudinal: 0, transverse: 0 });
}
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}

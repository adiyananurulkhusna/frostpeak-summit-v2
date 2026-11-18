// Frostpeak Drift — storage.js
// Save and load through the browser's local storage. One key, one object.

const KEY = 'frostpeak-drift-save-v1';

export function saveGame(G) {
  try {
    const data = {
      mission: G.missions.index,
      money: G.player.money,
      health: G.player.health,
      ammo: G.player.ammo,
      x: G.player.x,
      y: G.player.y,
      clock: G.clock,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.mission !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // Storage may be unavailable; the game still runs.
  }
}

export function hasSave() {
  return loadGame() !== null;
}

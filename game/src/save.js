// Solmar Heat — save / load. One job: persist progress to localStorage and
// restore it. Nothing here touches the game loop.
const KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: state.player.money,
      missionIndex: state.missionIndex,
      health: state.player.health,
      x: state.player.x,
      y: state.player.y,
      wanted: state.wanted,
      completed: state.completedMissions,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* storage is best-effort */ }
}

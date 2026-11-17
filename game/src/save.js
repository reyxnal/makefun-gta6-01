// Save / load through localStorage. The save holds progress, the profile,
// collected packages, weapons and the player's position. Settings live in
// a separate key so deleting a save keeps the player's preferences.

export const SAVE_KEY = 'verdeluz-witness-city-save-v1';
export const SETTINGS_KEY = 'verdeluz-witness-city-settings-v1';

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function saveGame(S) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: S.player.cash,
      hp: S.player.hp,
      armor: S.player.armor,
      x: S.player.x,
      y: S.player.y,
      profile: S.profile,
      missionsDone: S.missions.done.slice(),
      missionIndex: S.missions.index,
      weapons: S.player.weapons.slice(),
      currentWeapon: S.player.weapon,
      packagesTaken: S.city.packages.filter((p) => p.taken).map((p) => p.id),
      jumpsDone: S.side.jumpsDone.slice(),
      timeOfDay: S.timeOfDay,
      stats: S.stats,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function applySave(S, data) {
  S.player.cash = data.cash;
  S.player.hp = data.hp;
  S.player.armor = data.armor;
  S.player.x = data.x;
  S.player.y = data.y;
  Object.assign(S.profile, data.profile || {});
  S.missions.done = (data.missionsDone || []).slice();
  S.missions.index = data.missionIndex || 0;
  S.player.weapons = (data.weapons || ['fists', 'pistol']).slice();
  S.player.weapon = data.currentWeapon || 'pistol';
  for (const id of data.packagesTaken || []) {
    const p = S.city.packages.find((pk) => pk.id === id);
    if (p) p.taken = true;
  }
  S.side.jumpsDone = (data.jumpsDone || []).slice();
  S.timeOfDay = typeof data.timeOfDay === 'number' ? data.timeOfDay : 9.5;
  Object.assign(S.stats, data.stats || {});
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* ignore */ }
}

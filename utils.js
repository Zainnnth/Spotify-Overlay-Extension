export function safeParseJSON(storageKey, fallback) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] resetting invalid JSON for ${storageKey}`, error);
    localStorage.removeItem(storageKey);
    return fallback;
  }
}

export function getRefreshConfig(levelRaw) {
  const level = Math.max(1, Math.min(10, Number(levelRaw) || 5));
  const nowPlayingMs = Math.max(800, 2600 - level * 180);
  const queueMs = Math.max(2000, 7000 - level * 400);
  return { level, nowPlayingMs, queueMs };
}

export function formatMs(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalSec = Math.floor(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

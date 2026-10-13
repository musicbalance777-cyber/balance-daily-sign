// BALANCE daily selection v1: one message per category, per Kyiv calendar day.
// No Telegram identity or personal data is transmitted or collected.
import { messages as defaultMessages } from '../data/messages.js';

export const CATEGORIES = Object.freeze(['important', 'pleasant', 'unexpected']);
const STORAGE_KEY = 'balance.installationId.v1';

export function kyivDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const pick = type => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function getOrCreateLocalId(storage = globalThis.localStorage) {
  let id;
  try { id = storage.getItem(STORAGE_KEY); } catch (_) { /* private browsing */ }
  if (id) return id;
  id = globalThis.crypto?.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  try { storage.setItem(STORAGE_KEY, id); } catch (_) { /* private browsing */ }
  return id;
}

function hash32(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function daySerial(dayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error('Invalid date key');
  const [y,m,d] = dayKey.split('-').map(Number);
  const time = Date.UTC(y,m-1,d);
  if (new Date(time).toISOString().slice(0,10) !== dayKey) throw new Error('Invalid date');
  return Math.floor(time / 86400000);
}

// For each user/category, walk through the full collection before repeating.
// Adjacent calendar days cannot repeat if there are at least 2 messages.
export function dailyMessage({ category, localId, dayKey = kyivDayKey(), library = defaultMessages }) {
  if (!CATEGORIES.includes(category)) throw new Error('Unknown category');
  if (typeof localId !== 'string' || !localId) throw new Error('Missing local ID');
  const collection = library[category];
  if (!Array.isArray(collection) || collection.length === 0) throw new Error('Empty category');
  const offset = hash32(`balance-v1|${localId}|${category}`) % collection.length;
  const index = (offset + daySerial(dayKey)) % collection.length;
  return { category, dayKey, index, text: collection[index] };
}

export function dailyCollection({ localId, dayKey = kyivDayKey(), library = defaultMessages }) {
  return Object.fromEntries(CATEGORIES.map(category => [category,
    dailyMessage({ category, localId, dayKey, library })]));
}

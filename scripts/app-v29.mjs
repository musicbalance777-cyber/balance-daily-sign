import { dailyCollection, getOrCreateLocalId, kyivDayKey } from './daily-selection.mjs';
// v32: verified Telegram identity and persisted letters via same-origin backend.
const tg = window.Telegram?.WebApp;
tg?.ready();

// v29 navigation adapter: do not modify the v26 animation state machine or layers.
const home = document.getElementById('homeScreen');
const letter = document.getElementById('letterScreen');
const stage = document.getElementById('stage');
const heading = document.getElementById('heading');
const message = document.getElementById('message');
const localId = getOrCreateLocalId();
let activeDay = '';
let pendingLetters = null;
let todaysLetters = null;
let animationTimer = null;
let activeCategory = null;
let opening = false;

async function refreshDailyLetters() {
  const day = kyivDayKey();
  if (day === activeDay && todaysLetters) return;
  if (pendingLetters) return pendingLetters;
  pendingLetters = (async () => {
    const initData = tg?.initData || '';
    try {
      const response = await fetch('/api/daily-letters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }), cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Daily letters API: ${response.status}`);
      const result = await response.json();
      if (!result?.dayKey || !result?.letters ||
          !['important', 'pleasant', 'unexpected'].every(k => result.letters[k]?.text)) {
        throw new Error('Invalid daily letters response');
      }
      todaysLetters = result.letters;
      activeDay = result.dayKey;
    } catch (error) {
      // Local browser preview remains possible with the original static server.
      // Never silently fall back when inside Telegram: that would break cross-device identity.
      if (initData || tg) throw error;
      todaysLetters = dailyCollection({ localId, dayKey: day });
      activeDay = day;
      console.info('BALANCE local preview: server unavailable; using local selection.');
    }
  })();
  try { await pendingLetters; } finally { pendingLetters = null; }
}
function resetAnimation() {
  clearTimeout(animationTimer);
  animationTimer = null;
  stage.dataset.state = 'closed';
  opening = false;
}
// v31.4: a single, fully occluding veil controls both directions.
// Never animate the scene swap itself: the swap happens while fully dark.
let navigating = false;
const veil = document.getElementById('sceneVeil');
const DARKEN_MS = 450;
const DARK_HOLD_MS = 300;
const REVEAL_MS = 400;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function navigate(toLetter, category = null) {
  if (navigating) return;
  navigating = true;
  const instant = reducedMotion.matches;
  if (toLetter) {
    try {
      await refreshDailyLetters();
    } catch (error) {
      console.error('Unable to load daily letters:', error);
      navigating = false;
      alert('Не вдалося завантажити послання. Перевір інтернет і спробуй ще раз.');
      return;
    }
    activeCategory = category;
    heading.src = `assets/title_${category}.png`;
    heading.dataset.kind = category;
    message.textContent = todaysLetters[category].text;
  }
  // Retain the current letter's fully opened pose during the fade-out.
  document.body.classList.add('veil-on');
  if (!instant) await wait(DARKEN_MS);
  // The user cannot see this reset/swap because the veil is fully opaque.
  resetAnimation();
  if (toLetter) {
    home.hidden = true;
    letter.hidden = false;
  } else {
    letter.hidden = true;
    home.hidden = false;
    activeCategory = null;
  }
  home.classList.remove('scene-hidden');
  letter.classList.remove('scene-hidden');
  document.body.classList.remove('scene-transitioning');
  window.scrollTo(0, 0);
  if (!instant) await wait(DARK_HOLD_MS);
  document.body.classList.remove('veil-on');
  if (!instant) await wait(REVEAL_MS);
  navigating = false;
  if (toLetter) {
    // Start the original v26 sequence only after the new scene is visible.
    void stage.offsetWidth;
    stage.dataset.state = 'opening';
    opening = true;
    animationTimer = setTimeout(() => {
      stage.dataset.state = 'open';
      opening = false;
      animationTimer = null;
    }, instant ? 0 : 2500);
  }
}
function showLetter(category) {
  if (navigating || opening) return;
  navigate(true, category);
}
function showHome() {
  if (navigating) return;
  navigate(false);
}
document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => showLetter(button.dataset.category));
});
const backButton = document.getElementById('back');

backButton.addEventListener('click', () => {
  if (navigating) return;

  backButton.style.transition = 'scale 180ms ease';
backButton.style.scale = '0.97';

  setTimeout(() => {
    backButton.style.scale = '';
    showHome();
  }, 180);
});
// Day changes are checked on every new opening, including after overnight inactivity.

// v31: bridge the approved v17 home to the existing v26 opening flow.
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== document.getElementById('balanceHomeFrame')?.contentWindow) return;
  if (event.data?.type !== 'balance:open-envelope') return;
  if (!['important', 'pleasant', 'unexpected'].includes(event.data.category)) return;
  showLetter(event.data.category);
});

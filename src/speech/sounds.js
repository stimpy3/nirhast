// Short sound cues ("earcons"). Files live in public/sounds/.
// mic_on / mic_off: made in code by the team. notification_sound / complete_sound: Pixabay (free licence).
import { chime } from './tts.js';

const FILES = {
  micOn: 'sounds/mic_on.wav',
  micOff: 'sounds/mic_off.wav',
  newOrder: 'sounds/notification_sound.mp3',
  confirmed: 'sounds/complete_sound.mp3',
};

// How long to wait before the next spoken line starts (ms). The confirmed sound is 2 s long,
// but only about the first second can be heard, so speech starts after 0.9 s.
const WAIT_MS = { micOn: 300, micOff: 0, newOrder: 550, confirmed: 900 };
const VOLUME = { micOn: 0.6, micOff: 0.6, newOrder: 0.8, confirmed: 0.7 };

// After a cue, the next cue waits this long so two cues never pile on top of each other.
const GAP_MS = { micOn: 0, micOff: 300, newOrder: 0, confirmed: 0 };

const cache = {};
let freeAt = 0; // time when the next cue may start

function audioFor(name) {
  if (typeof Audio === 'undefined' || !FILES[name]) return null;
  if (!cache[name]) {
    const a = new Audio(FILES[name]);
    a.preload = 'auto';
    a.volume = VOLUME[name] ?? 0.7;
    cache[name] = a;
  }
  return cache[name];
}

// Load all files early (call after the Start tap) so the first play has no delay.
export function preloadSounds() {
  for (const name of Object.keys(FILES)) audioFor(name)?.load();
}

// Plays a cue. Resolves when the next spoken line may start; never rejects.
export function playSound(name) {
  const now = Date.now();
  const delay = Math.max(0, freeAt - now);
  freeAt = now + delay + (GAP_MS[name] ?? 0);
  return new Promise((resolve) => {
    setTimeout(() => {
      const a = audioFor(name);
      const fail = () => { if (name === 'micOn') chime(); resolve(); };
      if (!a) { fail(); return; }
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p?.catch) p.catch(fail);
      } catch { fail(); return; }
      setTimeout(resolve, WAIT_MS[name] ?? 0);
    }, delay);
  });
}

// Which cues a state change should play: a new order came in, or an order was just confirmed.
export function soundCues(prev, next, now) {
  const before = new Map((prev?.orders || []).map((o) => [o.id, o.status]));
  const cues = [];
  const quiet = next.quietUntil && next.quietUntil > now;
  if (!quiet && next.orders.some((o) => !before.has(o.id))) cues.push('newOrder');
  if (next.orders.some((o) => o.status === 'confirmed' && before.has(o.id) && before.get(o.id) !== 'confirmed')) cues.push('confirmed');
  return cues;
}

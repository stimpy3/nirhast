// "Saved today" numbers for the Kitchen screen. Counts are real; minutes are an estimate:
//  - a message the app answered alone saves about 60 s (stop, wipe hands, unlock, read, type a reply);
//  - an action done by voice instead of the phone saves about 20 s (wipe hands, unlock, tap).
export const SAVED_SECONDS = { answered: 60, handsFree: 20 };

const empty = (day) => ({ day, answered: 0, handsFree: 0, buttons: 0 });

// Pure: returns a new state with one counter increased (counters restart each day).
export function bump(state, key, now) {
  const day = new Date(now).toDateString();
  const cur = state.stats && state.stats.day === day ? state.stats : empty(day);
  return { ...state, stats: { ...cur, [key]: (cur[key] || 0) + 1 } };
}

export function savedToday(state, now) {
  const day = new Date(now).toDateString();
  const s = state.stats && state.stats.day === day ? state.stats : empty(day);
  const seconds = s.answered * SAVED_SECONDS.answered + s.handsFree * SAVED_SECONDS.handsFree;
  return { answered: s.answered, handsFree: s.handsFree, buttons: s.buttons, minutes: Math.round(seconds / 60) };
}

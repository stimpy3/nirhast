import { describe, it, expect } from 'vitest';
import { soundCues } from '../src/speech/sounds.js';

const NOW = 1_000_000;
const st = (orders, quietUntil = null) => ({ orders, quietUntil });

describe('sound cues', () => {
  it('plays the new-order sound when an order appears', () => {
    expect(soundCues(st([]), st([{ id: 'o1', status: 'awaiting' }]), NOW)).toEqual(['newOrder']);
  });

  it('plays the confirmed sound when an order turns confirmed', () => {
    const prev = st([{ id: 'o1', status: 'awaiting' }]);
    expect(soundCues(prev, st([{ id: 'o1', status: 'confirmed' }]), NOW)).toEqual(['confirmed']);
  });

  it('plays nothing when nothing changed, or for a decline', () => {
    const prev = st([{ id: 'o1', status: 'awaiting' }]);
    expect(soundCues(prev, prev, NOW)).toEqual([]);
    expect(soundCues(prev, st([{ id: 'o1', status: 'declined' }]), NOW)).toEqual([]);
  });

  it('stays silent for new orders in quiet mode', () => {
    expect(soundCues(st([]), st([{ id: 'o1', status: 'awaiting' }], NOW + 60000), NOW)).toEqual([]);
  });
});

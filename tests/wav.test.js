import { describe, it, expect } from 'vitest';
import { encodeWav16k } from '../src/speech/recognizers.js';

describe('Wispr Flow audio format', () => {
  it('encodes 48 kHz float audio as 16 kHz 16-bit mono WAV in base64', () => {
    const tone = new Float32Array(4800).map((_, i) => Math.sin(i / 10) * 0.5); // 0.1 s at 48 kHz
    const b64 = encodeWav16k([tone], 48000);
    const bytes = Buffer.from(b64, 'base64');
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WAVE');
    expect(bytes.readUInt16LE(22)).toBe(1); // mono
    expect(bytes.readUInt32LE(24)).toBe(16000); // 16 kHz
    expect(bytes.readUInt16LE(34)).toBe(16); // 16-bit
    expect(bytes.length).toBe(44 + 1600 * 2); // 0.1 s at 16 kHz
  });
});

/*
 * OmniWeb factory patch library
 * -----------------------------
 * These are ORIGINAL, synthesis-based recreations of Omnisphere-style sound
 * categories. They are NOT Spectrasonics content and contain no proprietary
 * samples. The patch format is open JSON (see README.md) so you can build,
 * save, and share your own sounds.
 *
 * Layer fields:
 *   enabled, level(0..1), pan(-1..1), wave, octave, coarse, fine(cents),
 *   unison(1..7), detune(cents), glide(0..1s)
 *   ampEnv: {a,d,s,r}
 *   filter: {type, cutoff(Hz), q, envAmt(Hz), env:{a,d,s,r}}
 *   lfo: {rate(Hz), depth, target: 'pitch'|'filter'|'amp'}
 * fx: distortion(0..1), chorus(0..1), delay:{time,fb,mix}, reverb:{mix,decay}
 * master: {volume, voices}
 */
const FACTORY_PATCHES = [
  {
    name: "Halcyon Pad",
    category: "Pad",
    author: "OmniWeb",
    master: { volume: 0.8, voices: 10 },
    fx: { distortion: 0.0, chorus: 0.45, delay: { time: 0.42, fb: 0.32, mix: 0.22 }, reverb: { mix: 0.5, decay: 3.4 } },
    layers: [
      { enabled: true, level: 0.55, pan: -0.25, wave: "sawbright", octave: 0, coarse: 0, fine: -4, unison: 3, detune: 12, glide: 0,
        ampEnv: { a: 0.9, d: 1.4, s: 0.85, r: 2.2 },
        filter: { type: "lowpass", cutoff: 900, q: 4, envAmt: 2600, env: { a: 1.2, d: 2.0, s: 0.6, r: 2.4 } },
        lfo: { rate: 0.18, depth: 0.4, target: "filter" } },
      { enabled: true, level: 0.4, pan: 0.25, wave: "triangle", octave: 1, coarse: 0, fine: 5, unison: 2, detune: 8, glide: 0,
        ampEnv: { a: 1.4, d: 1.0, s: 0.9, r: 2.6 },
        filter: { type: "lowpass", cutoff: 1600, q: 2, envAmt: 1200, env: { a: 1.6, d: 1.4, s: 0.7, r: 2.6 } },
        lfo: { rate: 0.12, depth: 0.25, target: "pitch" } }
    ]
  },
  {
    name: "Neon Bass",
    category: "Bass",
    author: "OmniWeb",
    master: { volume: 0.85, voices: 6 },
    fx: { distortion: 0.18, chorus: 0.1, delay: { time: 0.28, fb: 0.15, mix: 0.08 }, reverb: { mix: 0.12, decay: 1.4 } },
    layers: [
      { enabled: true, level: 0.85, pan: 0, wave: "square", octave: -1, coarse: 0, fine: 0, unison: 2, detune: 6, glide: 0.04,
        ampEnv: { a: 0.005, d: 0.25, s: 0.7, r: 0.2 },
        filter: { type: "lowpass", cutoff: 500, q: 8, envAmt: 2200, env: { a: 0.005, d: 0.35, s: 0.25, r: 0.2 } },
        lfo: { rate: 0, depth: 0, target: "filter" } },
      { enabled: true, level: 0.5, pan: 0, wave: "sine", octave: -2, coarse: 0, fine: 0, unison: 1, detune: 0, glide: 0.04,
        ampEnv: { a: 0.005, d: 0.3, s: 0.8, r: 0.25 },
        filter: { type: "lowpass", cutoff: 260, q: 1, envAmt: 0, env: { a: 0.01, d: 0.3, s: 1, r: 0.3 } },
        lfo: { rate: 0, depth: 0, target: "filter" } }
    ]
  },
  {
    name: "Starlight Lead",
    category: "Lead",
    author: "OmniWeb",
    master: { volume: 0.8, voices: 8 },
    fx: { distortion: 0.12, chorus: 0.3, delay: { time: 0.36, fb: 0.4, mix: 0.3 }, reverb: { mix: 0.35, decay: 2.4 } },
    layers: [
      { enabled: true, level: 0.7, pan: 0, wave: "sawbright", octave: 0, coarse: 0, fine: 0, unison: 3, detune: 10, glide: 0.06,
        ampEnv: { a: 0.02, d: 0.4, s: 0.7, r: 0.5 },
        filter: { type: "lowpass", cutoff: 2200, q: 6, envAmt: 3000, env: { a: 0.03, d: 0.6, s: 0.5, r: 0.5 } },
        lfo: { rate: 5.2, depth: 0.15, target: "pitch" } },
      { enabled: false, level: 0.0, pan: 0, wave: "sine", octave: 1, coarse: 0, fine: 0, unison: 1, detune: 0, glide: 0,
        ampEnv: { a: 0.02, d: 0.4, s: 0.7, r: 0.5 },
        filter: { type: "lowpass", cutoff: 4000, q: 1, envAmt: 0, env: { a: 0.02, d: 0.4, s: 1, r: 0.5 } },
        lfo: { rate: 0, depth: 0, target: "pitch" } }
    ]
  },
  {
    name: "Glass Keys",
    category: "Keys",
    author: "OmniWeb",
    master: { volume: 0.8, voices: 12 },
    fx: { distortion: 0.0, chorus: 0.25, delay: { time: 0.3, fb: 0.25, mix: 0.18 }, reverb: { mix: 0.4, decay: 2.6 } },
    layers: [
      { enabled: true, level: 0.7, pan: 0, wave: "sine", octave: 0, coarse: 0, fine: 0, unison: 1, detune: 0, glide: 0,
        ampEnv: { a: 0.005, d: 1.2, s: 0.0, r: 0.6 },
        filter: { type: "lowpass", cutoff: 5000, q: 1, envAmt: 0, env: { a: 0.005, d: 1.0, s: 0.3, r: 0.6 } },
        lfo: { rate: 0, depth: 0, target: "pitch" } },
      { enabled: true, level: 0.35, pan: 0, wave: "triangle", octave: 2, coarse: 0, fine: 3, unison: 1, detune: 0, glide: 0,
        ampEnv: { a: 0.005, d: 0.5, s: 0.0, r: 0.4 },
        filter: { type: "lowpass", cutoff: 7000, q: 1, envAmt: 0, env: { a: 0.005, d: 0.5, s: 0.2, r: 0.4 } },
        lfo: { rate: 0, depth: 0, target: "pitch" } }
    ]
  },
  {
    name: "Nebula Texture",
    category: "Texture",
    author: "OmniWeb",
    master: { volume: 0.75, voices: 8 },
    fx: { distortion: 0.05, chorus: 0.6, delay: { time: 0.55, fb: 0.5, mix: 0.35 }, reverb: { mix: 0.6, decay: 4.5 } },
    layers: [
      { enabled: true, level: 0.5, pan: -0.3, wave: "noise", octave: 0, coarse: 0, fine: 0, unison: 1, detune: 0, glide: 0,
        ampEnv: { a: 2.5, d: 2.0, s: 0.7, r: 3.5 },
        filter: { type: "bandpass", cutoff: 1200, q: 6, envAmt: 1800, env: { a: 3.0, d: 2.0, s: 0.6, r: 3.5 } },
        lfo: { rate: 0.08, depth: 0.6, target: "filter" } },
      { enabled: true, level: 0.5, pan: 0.3, wave: "sawtooth", octave: 0, coarse: 7, fine: 0, unison: 4, detune: 18, glide: 0,
        ampEnv: { a: 2.0, d: 1.5, s: 0.8, r: 3.0 },
        filter: { type: "lowpass", cutoff: 800, q: 3, envAmt: 1400, env: { a: 2.5, d: 1.8, s: 0.6, r: 3.0 } },
        lfo: { rate: 0.05, depth: 0.3, target: "pitch" } }
    ]
  },
  {
    name: "Pluck Arp",
    category: "Pluck",
    author: "OmniWeb",
    master: { volume: 0.8, voices: 12 },
    fx: { distortion: 0.0, chorus: 0.15, delay: { time: 0.375, fb: 0.45, mix: 0.3 }, reverb: { mix: 0.3, decay: 2.0 } },
    layers: [
      { enabled: true, level: 0.75, pan: 0, wave: "square", octave: 0, coarse: 0, fine: 0, unison: 2, detune: 8, glide: 0,
        ampEnv: { a: 0.002, d: 0.28, s: 0.0, r: 0.2 },
        filter: { type: "lowpass", cutoff: 1400, q: 7, envAmt: 3500, env: { a: 0.002, d: 0.22, s: 0.0, r: 0.2 } },
        lfo: { rate: 0, depth: 0, target: "pitch" } },
      { enabled: false, level: 0, pan: 0, wave: "sine", octave: 0, coarse: 0, fine: 0, unison: 1, detune: 0, glide: 0,
        ampEnv: { a: 0.002, d: 0.28, s: 0.0, r: 0.2 },
        filter: { type: "lowpass", cutoff: 4000, q: 1, envAmt: 0, env: { a: 0.002, d: 0.28, s: 0, r: 0.2 } },
        lfo: { rate: 0, depth: 0, target: "pitch" } }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) { module.exports = FACTORY_PATCHES; }

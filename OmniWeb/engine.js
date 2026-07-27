/*
 * OmniWeb synthesis engine (Web Audio API)
 * ----------------------------------------
 * Architecture, per note:
 *
 *   Layer A ─┐
 *            ├─> voice gain ─> FX bus ─> master ─> analyser ─> out
 *   Layer B ─┘
 *
 * Each layer = unison oscillators -> filter (+ filter env, LFO) -> amp env -> pan
 * FX bus     = distortion -> chorus -> delay -> reverb -> master
 */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/* Wave names the Web Audio OscillatorNode accepts directly. */
const OSC_TYPES = new Set(["sine", "square", "sawtooth", "triangle"]);

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* Deep clone that is safe for our plain-JSON patch objects. */
function clonePatch(p) {
  return JSON.parse(JSON.stringify(p));
}

/* ------------------------------------------------------------------ *
 * Custom periodic waves. "sawbright" is a saw with emphasised upper
 * partials, giving the sheen typical of big supersaw layers.
 * ------------------------------------------------------------------ */
function buildWaveTables(ctx) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    imag[i] = (1 / i) * (1 + i / n); // saw slope with a rising tilt
  }
  return { sawbright: ctx.createPeriodicWave(real, imag, { disableNormalization: false }) };
}

/* Noise buffer reused by every noise-wave voice. */
function buildNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/* Simple algorithmic impulse response for the reverb. */
function buildImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const imp = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = imp.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return imp;
}

/* Waveshaper curve for the drive stage. */
function buildDistCurve(amount) {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

class OmniWebEngine {
  constructor() {
    this.ctx = null;
    this.patch = null;
    this.voices = new Map();  // midi -> voice
    this.userSamples = {};    // name -> AudioBuffer, for imported user audio
    this.ready = false;
  }

  init() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.waves = buildWaveTables(ctx);
    this.noiseBuffer = buildNoiseBuffer(ctx);

    // ---- master chain -------------------------------------------------
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // ---- FX bus -------------------------------------------------------
    this.fxIn = ctx.createGain();

    this.dist = ctx.createWaveShaper();
    this.distWet = ctx.createGain();
    this.distDry = ctx.createGain();
    this.distSum = ctx.createGain();
    this.fxIn.connect(this.dist);
    this.fxIn.connect(this.distDry);
    this.dist.connect(this.distWet);
    this.distWet.connect(this.distSum);
    this.distDry.connect(this.distSum);

    // Chorus: two modulated delay lines panned apart.
    this.chorusSum = ctx.createGain();
    this.chorusDry = ctx.createGain();
    this.distSum.connect(this.chorusDry);
    this.chorusDry.connect(this.chorusSum);
    this.chorusVoices = [];
    [[-0.6, 0.6], [0.6, 0.83]].forEach(([pan, rate]) => {
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.018;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = rate;
      lfoGain.gain.value = 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(d.delayTime);
      lfo.start();
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      const wet = ctx.createGain();
      wet.gain.value = 0;
      this.distSum.connect(d);
      d.connect(p);
      p.connect(wet);
      wet.connect(this.chorusSum);
      this.chorusVoices.push({ wet });
    });

    // Delay with feedback.
    this.delay = ctx.createDelay(2.0);
    this.delayFb = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = "lowpass";
    this.delayTone.frequency.value = 3500;
    this.delaySum = ctx.createGain();
    this.chorusSum.connect(this.delaySum);          // dry path
    this.chorusSum.connect(this.delay);
    this.delay.connect(this.delayTone);
    this.delayTone.connect(this.delayFb);
    this.delayFb.connect(this.delay);               // feedback loop
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.delaySum);

    // Convolution reverb.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = buildImpulse(ctx, 3, 2.5);
    this.reverbWet = ctx.createGain();
    this.reverbSum = ctx.createGain();
    this.delaySum.connect(this.reverbSum);          // dry path
    this.delaySum.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.reverbSum);

    this.reverbSum.connect(this.master);

    this._reverbDecay = null;
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  /* Load a patch object and push all of its FX/master values to the graph. */
  loadPatch(patch) {
    this.init();
    this.allNotesOff(true);
    this.patch = clonePatch(patch);
    this.applyFx();
    return this.patch;
  }

  applyFx() {
    if (!this.ready || !this.patch) return;
    const p = this.patch;
    const t = this.ctx.currentTime;

    this.master.gain.setTargetAtTime(p.master.volume, t, 0.02);

    const d = clamp(p.fx.distortion, 0, 1);
    this.dist.curve = buildDistCurve(Math.max(0.001, d));
    this.distWet.gain.setTargetAtTime(d, t, 0.02);
    this.distDry.gain.setTargetAtTime(1 - d, t, 0.02);

    const ch = clamp(p.fx.chorus, 0, 1);
    this.chorusVoices.forEach(v => v.wet.gain.setTargetAtTime(ch * 0.5, t, 0.02));
    this.chorusDry.gain.setTargetAtTime(1 - ch * 0.35, t, 0.02);

    this.delay.delayTime.setTargetAtTime(clamp(p.fx.delay.time, 0.01, 2), t, 0.05);
    this.delayFb.gain.setTargetAtTime(clamp(p.fx.delay.fb, 0, 0.9), t, 0.02);
    this.delayWet.gain.setTargetAtTime(clamp(p.fx.delay.mix, 0, 1), t, 0.02);

    // Rebuilding the impulse is expensive, so only do it when decay changes.
    if (this._reverbDecay !== p.fx.reverb.decay) {
      this._reverbDecay = p.fx.reverb.decay;
      this.reverb.buffer = buildImpulse(this.ctx, clamp(p.fx.reverb.decay, 0.2, 8), 2.5);
    }
    this.reverbWet.gain.setTargetAtTime(clamp(p.fx.reverb.mix, 0, 1), t, 0.02);
  }

  /* ---------------------------------------------------------------- *
   * Voice construction
   * ---------------------------------------------------------------- */
  buildLayer(layerCfg, freq, velocity, now, destination) {
    const ctx = this.ctx;
    const L = layerCfg;

    const layerOut = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(L.pan, -1, 1);

    const ampGain = ctx.createGain();
    ampGain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = L.filter.type;
    filter.Q.value = clamp(L.filter.q, 0.0001, 24);

    const sources = [];
    const semis = (L.octave || 0) * 12 + (L.coarse || 0);
    const baseFreq = freq * Math.pow(2, semis / 12) * Math.pow(2, (L.fine || 0) / 1200);
    const unison = clamp(L.unison | 0, 1, 7);

    for (let i = 0; i < unison; i++) {
      // Spread unison voices symmetrically around the centre pitch.
      const offset = unison === 1 ? 0 : ((i / (unison - 1)) * 2 - 1) * (L.detune || 0);
      const f = baseFreq * Math.pow(2, offset / 1200);

      if (L.wave === "noise") {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 1 / unison;
        src.connect(g);
        g.connect(filter);
        sources.push({ node: src, isOsc: false });
      } else if (L.wave.startsWith("sample:")) {
        const name = L.wave.slice(7);
        const buf = this.userSamples[name];
        if (buf) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          // Play back at a rate that transposes the sample; C4 = unity.
          src.playbackRate.value = f / midiToFreq(60);
          const g = ctx.createGain();
          g.gain.value = 1 / unison;
          src.connect(g);
          g.connect(filter);
          sources.push({ node: src, isOsc: false });
        }
      } else {
        const osc = ctx.createOscillator();
        if (L.wave === "sawbright") {
          osc.setPeriodicWave(this.waves.sawbright);
        } else {
          // Guard against patches naming a wave the Web Audio API doesn't know
          // ("saw" is a common shorthand); an unknown type would throw.
          const alias = { saw: "sawtooth", tri: "triangle", sqr: "square" };
          const type = alias[L.wave] || L.wave;
          osc.type = OSC_TYPES.has(type) ? type : "sawtooth";
        }
        osc.frequency.value = f;
        if (L.glide > 0) {
          // Start from the previous note's pitch for a portamento sweep.
          const from = this._lastFreq ? this._lastFreq * Math.pow(2, semis / 12) : f;
          osc.frequency.setValueAtTime(from, now);
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, f), now + L.glide);
        }
        const g = ctx.createGain();
        g.gain.value = 1 / unison;
        osc.connect(g);
        g.connect(filter);
        sources.push({ node: osc, isOsc: true });
      }
    }

    filter.connect(ampGain);
    ampGain.connect(panner);
    panner.connect(layerOut);
    layerOut.gain.value = clamp(L.level, 0, 1);
    layerOut.connect(destination);

    // ---- amp envelope -------------------------------------------------
    const env = L.ampEnv;
    const peak = clamp(L.level, 0, 1) > 0 ? velocity : 0;
    const a = Math.max(0.001, env.a);
    const d = Math.max(0.001, env.d);
    const s = clamp(env.s, 0, 1);
    ampGain.gain.cancelScheduledValues(now);
    ampGain.gain.setValueAtTime(0.0001, now);
    ampGain.gain.linearRampToValueAtTime(peak, now + a);
    ampGain.gain.linearRampToValueAtTime(Math.max(0.0001, peak * s), now + a + d);

    // ---- filter envelope ----------------------------------------------
    const fe = L.filter.env;
    const base = clamp(L.filter.cutoff, 20, 20000);
    const amt = L.filter.envAmt || 0;
    const fa = Math.max(0.001, fe.a);
    const fd = Math.max(0.001, fe.d);
    const fs = clamp(fe.s, 0, 1);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(base, now);
    if (amt !== 0) {
      filter.frequency.linearRampToValueAtTime(clamp(base + amt, 20, 20000), now + fa);
      filter.frequency.linearRampToValueAtTime(clamp(base + amt * fs, 20, 20000), now + fa + fd);
    }

    // ---- LFO ------------------------------------------------------------
    let lfo = null, lfoGain = null;
    if (L.lfo && L.lfo.rate > 0 && L.lfo.depth > 0) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = L.lfo.rate;
      lfoGain = ctx.createGain();
      lfo.connect(lfoGain);
      if (L.lfo.target === "pitch") {
        lfoGain.gain.value = L.lfo.depth * 20; // Hz of vibrato
        sources.forEach(s2 => { if (s2.isOsc) lfoGain.connect(s2.node.frequency); });
      } else if (L.lfo.target === "filter") {
        lfoGain.gain.value = L.lfo.depth * base * 0.8;
        lfoGain.connect(filter.frequency);
      } else {
        lfoGain.gain.value = L.lfo.depth * 0.4;
        lfoGain.connect(ampGain.gain);
      }
      lfo.start(now);
    }

    sources.forEach(s2 => s2.node.start(now));

    return { sources, ampGain, filter, lfo, layerOut, cfg: L };
  }

  noteOn(midi, velocity = 0.85) {
    this.init();
    this.resume();
    if (!this.patch) return;
    if (this.voices.has(midi)) this.noteOff(midi, true);

    // Voice stealing: drop the oldest note once we exceed the limit.
    const limit = clamp(this.patch.master.voices | 0, 1, 24);
    if (this.voices.size >= limit) {
      const oldest = this.voices.keys().next().value;
      this.noteOff(oldest, true);
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = midiToFreq(midi);
    const voiceOut = ctx.createGain();
    voiceOut.gain.value = 1;
    voiceOut.connect(this.fxIn);

    const layers = this.patch.layers
      .filter(L => L.enabled)
      .map(L => this.buildLayer(L, freq, velocity, now, voiceOut));

    this._lastFreq = freq;
    this.voices.set(midi, { layers, voiceOut, midi });
    if (this.onVoiceChange) this.onVoiceChange(this.voices.size);
  }

  noteOff(midi, immediate = false) {
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    const now = this.ctx.currentTime;
    let maxRelease = 0;

    v.layers.forEach(layer => {
      const r = immediate ? 0.02 : Math.max(0.02, layer.cfg.ampEnv.r);
      maxRelease = Math.max(maxRelease, r);
      const g = layer.ampGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0.0001, g.value), now);
      g.linearRampToValueAtTime(0.0001, now + r);

      // Let the filter fall away with the note for a natural tail.
      const fr = layer.cfg.filter.env.r;
      if (layer.cfg.filter.envAmt !== 0 && fr > 0) {
        const f = layer.filter.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(f.value, now);
        f.linearRampToValueAtTime(clamp(layer.cfg.filter.cutoff, 20, 20000), now + Math.min(fr, r));
      }
    });

    const stopAt = now + maxRelease + 0.05;
    v.layers.forEach(layer => {
      layer.sources.forEach(s => { try { s.node.stop(stopAt); } catch (e) { /* already stopped */ } });
      if (layer.lfo) { try { layer.lfo.stop(stopAt); } catch (e) {} }
    });
    setTimeout(() => { try { v.voiceOut.disconnect(); } catch (e) {} },
      (maxRelease + 0.2) * 1000);

    if (this.onVoiceChange) this.onVoiceChange(this.voices.size);
  }

  allNotesOff(immediate = false) {
    Array.from(this.voices.keys()).forEach(m => this.noteOff(m, immediate));
  }

  async addSample(name, arrayBuffer) {
    this.init();
    const buf = await this.ctx.decodeAudioData(arrayBuffer);
    this.userSamples[name] = buf;
    return buf;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OmniWebEngine, midiToFreq, midiToName, clonePatch };
}

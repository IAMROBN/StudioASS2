# OmniWeb

A dual-layer subtractive/wavetable synthesizer that runs in the browser on the
Web Audio API. No build step, no dependencies — open `index.html` and play.

OmniWeb is an **original** instrument inspired by the architecture of large
workstation synths (dual layers, per-layer filter and envelopes, an LFO, and a
shared effects bus). It ships with its own factory patches and an open,
human-readable patch format.

## Running it

Because the patches and engine load as separate scripts, serve the folder over
HTTP rather than opening the file directly:

```bash
cd OmniWeb
python3 -m http.server 8099
# then open http://localhost:8099
```

## Playing

| Control | Action |
|---|---|
| `A S D F G H J K` | white keys |
| `W E T Y U` | black keys |
| `Z` / `X` | octave down / up |
| Mouse or touch | click the on-screen keyboard |
| **Panic** | kill all sounding notes |

The arpeggiator cycles whatever notes you're holding at the selected BPM.

## Architecture

```
Layer A ─┐
         ├─> voice gain ─> drive ─> chorus ─> delay ─> reverb ─> limiter ─> out
Layer B ─┘
```

Each layer is independent: up to 7 detuned unison oscillators → biquad filter
(with its own ADSR and envelope amount) → amplitude ADSR → stereo pan. The LFO
routes to pitch, filter cutoff, or amplitude.

Voices are allocated per note with oldest-note stealing once the polyphony limit
is reached.

## Patch format (`.owpatch`)

Patches are plain JSON, so you can edit them in any text editor or generate them
programmatically.

```jsonc
{
  "name": "Halcyon Pad",
  "category": "Pad",
  "author": "OmniWeb",
  "master": { "volume": 0.8, "voices": 10 },
  "fx": {
    "distortion": 0.0,
    "chorus": 0.45,
    "delay":  { "time": 0.42, "fb": 0.32, "mix": 0.22 },
    "reverb": { "mix": 0.5, "decay": 3.4 }
  },
  "layers": [
    {
      "enabled": true,
      "level": 0.55,          // 0..1
      "pan": -0.25,           // -1..1
      "wave": "sawbright",    // sine|triangle|sawtooth|sawbright|square|noise|sample:<name>
      "octave": 0,            // -3..3
      "coarse": 0,            // semitones, -12..12
      "fine": -4,             // cents
      "unison": 3,            // 1..7
      "detune": 12,           // cents of unison spread
      "glide": 0,             // portamento seconds
      "ampEnv": { "a": 0.9, "d": 1.4, "s": 0.85, "r": 2.2 },
      "filter": {
        "type": "lowpass",    // lowpass|highpass|bandpass|notch
        "cutoff": 900,        // Hz
        "q": 4,
        "envAmt": 2600,       // Hz added at envelope peak (may be negative)
        "env": { "a": 1.2, "d": 2.0, "s": 0.6, "r": 2.4 }
      },
      "lfo": { "rate": 0.18, "depth": 0.4, "target": "filter" }
    }
  ]
}
```

Use **Export .owpatch** to save the current sound, **Import** to load one back,
and **Save to Browser** to keep patches in `localStorage` between sessions.

## Factory patches

| Patch | Category |
|---|---|
| Halcyon Pad | Pad |
| Neon Bass | Bass |
| Starlight Lead | Lead |
| Glass Keys | Keys |
| Nebula Texture | Texture |
| Pluck Arp | Pluck |

All six are produced by synthesis — there are no sample files in this repo.

## Using your own samples

**Load Audio File** decodes any audio your browser supports and makes it
available as a wave source on either layer (`sample:<name>`). Samples are
pitched relative to C4 and loop while the note is held. They live in memory for
the session only and are never uploaded anywhere.

## On Omnisphere patches

OmniWeb **cannot** load Spectrasonics Omnisphere `.prt_omn` patches, and this is
a hard limitation rather than a missing feature.

An Omnisphere patch file is not a sound. It is a small set of parameters that
points into the **STEAM** library — Spectrasonics' encrypted, copy-protected
sample core — and that is driven by Omnisphere's own proprietary DSP engine.
The audio you hear lives in that protected library and engine, neither of which
is redistributable or readable by third-party software. Reading those patches
in another instrument would mean circumventing that protection.

If you own Omnisphere and want its sounds in a project, render or resample them
to audio from within Omnisphere itself, then bring the resulting files in
through the sample loader above.

## Files

| File | Purpose |
|---|---|
| `index.html` | markup and panel layout |
| `style.css` | theme |
| `engine.js` | `OmniWebEngine` — voice allocation, layers, FX graph |
| `patches.js` | `FACTORY_PATCHES` library |
| `app.js` | UI binding, keyboard, arpeggiator, patch I/O |

`window.omniweb` exposes `{ engine, press, release, selectPatch, patch }` for
console tinkering.

## Verified

Tested headlessly in Chromium: all six factory patches load, render their
editors, and produce non-silent output (measured analyser peaks 0.41–1.0);
patch JSON round-trips; panic returns voice count to zero; no console errors.

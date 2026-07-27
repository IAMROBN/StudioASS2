# StudioASS2

Synth Realities Assignment 2.

## Contents

| Path | Description |
|---|---|
| `index.html`, `Build/`, `TemplateData/` | Unity WebGL build ("Synth Realities Ass 2") |
| `OmniWeb/` | **OmniWeb** — a dual-layer Web Audio synthesizer with an open patch format |

### OmniWeb

A browser-based, dual-layer subtractive/wavetable synthesizer: per-layer unison
oscillators, filters with envelopes, LFOs, a shared FX bus (drive, chorus,
delay, reverb), an arpeggiator, and six factory patches. Patches are plain JSON
(`.owpatch`) and you can load your own audio samples.

```bash
cd OmniWeb && python3 -m http.server 8099   # then open http://localhost:8099
```

See [`OmniWeb/README.md`](OmniWeb/README.md) for the patch format and full docs.

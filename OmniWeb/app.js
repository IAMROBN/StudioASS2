/*
 * OmniWeb UI controller — binds the DOM to OmniWebEngine.
 */
(function () {
  "use strict";

  const engine = new OmniWebEngine();
  const STORE_KEY = "omniweb.userPatches.v1";

  let patches = FACTORY_PATCHES.map(clonePatch);
  let userPatches = [];
  let current = null;
  let octave = 4;
  let arpTimer = null;
  let arpIndex = 0;

  const $ = id => document.getElementById(id);

  /* ---------------- storage ---------------- */
  function loadUserPatches() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      userPatches = raw ? JSON.parse(raw) : [];
    } catch (e) {
      userPatches = [];
    }
  }

  function saveUserPatches() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(userPatches));
    } catch (e) {
      alert("Could not save to browser storage: " + e.message);
    }
  }

  function allPatches() {
    return patches.concat(userPatches);
  }

  /* ---------------- patch list ---------------- */
  function renderPatchList() {
    const ul = $("patchList");
    ul.innerHTML = "";
    allPatches().forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="cat">${p.category || "User"}${i >= patches.length ? " · saved" : ""}</span>${p.name}`;
      li.onclick = () => selectPatch(i);
      if (current === i) li.className = "active";
      ul.appendChild(li);
    });
  }

  function selectPatch(i) {
    const list = allPatches();
    if (!list[i]) return;
    current = i;
    engine.loadPatch(list[i]);
    $("patchName").textContent = engine.patch.name;
    $("patchMeta").textContent =
      `${engine.patch.category || "User"} · by ${engine.patch.author || "you"}`;
    renderPatchList();
    renderLayers();
    syncGlobalControls();
  }

  /* ---------------- generic control helper ---------------- */
  function bindRange(el, valEl, get, set, fmt) {
    el.value = get();
    if (valEl) valEl.textContent = fmt(get());
    el.oninput = () => {
      const v = parseFloat(el.value);
      set(v);
      if (valEl) valEl.textContent = fmt(v);
      engine.applyFx();
    };
  }

  const f2 = v => v.toFixed(2);
  const int = v => String(Math.round(v));
  const hz = v => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v) + "");
  const sec = v => v.toFixed(2) + "s";

  /* ---------------- global controls ---------------- */
  function syncGlobalControls() {
    const p = engine.patch;
    bindRange($("masterVol"), $("volVal"), () => p.master.volume, v => p.master.volume = v, f2);
    bindRange($("maxVoices"), $("voicesVal"), () => p.master.voices, v => p.master.voices = v, int);
    bindRange($("fxDist"), $("fxDistVal"), () => p.fx.distortion, v => p.fx.distortion = v, f2);
    bindRange($("fxChorus"), $("fxChorusVal"), () => p.fx.chorus, v => p.fx.chorus = v, f2);
    bindRange($("fxDlyT"), $("fxDlyTVal"), () => p.fx.delay.time, v => p.fx.delay.time = v, sec);
    bindRange($("fxDlyF"), $("fxDlyFVal"), () => p.fx.delay.fb, v => p.fx.delay.fb = v, f2);
    bindRange($("fxDlyM"), $("fxDlyMVal"), () => p.fx.delay.mix, v => p.fx.delay.mix = v, f2);
    bindRange($("fxRevM"), $("fxRevMVal"), () => p.fx.reverb.mix, v => p.fx.reverb.mix = v, f2);
    bindRange($("fxRevD"), $("fxRevDVal"), () => p.fx.reverb.decay, v => p.fx.reverb.decay = v, sec);
  }

  /* ---------------- layer editors ---------------- */
  const WAVES = [
    ["sine", "Sine"], ["triangle", "Triangle"], ["sawtooth", "Saw"],
    ["sawbright", "Saw Bright"], ["square", "Square"], ["noise", "Noise"]
  ];

  function ctl(label, min, max, step, get, set, fmt) {
    const wrap = document.createElement("div");
    wrap.className = "ctl";
    const lab = document.createElement("label");
    const val = document.createElement("span");
    val.className = "val";
    lab.textContent = label;
    lab.appendChild(val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = get();
    val.textContent = fmt(get());
    input.oninput = () => {
      const v = parseFloat(input.value);
      set(v);
      val.textContent = fmt(v);
    };
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function renderLayers() {
    const host = $("layerPanels");
    host.innerHTML = "";
    engine.patch.layers.forEach((L, idx) => {
      const div = document.createElement("div");
      div.className = idx === 1 ? "layer-b" : "";

      // header: name, enable, waveform
      const head = document.createElement("div");
      head.className = "layer-head";
      const title = document.createElement("span");
      title.className = "layer-title";
      title.textContent = "LAYER " + (idx === 0 ? "A" : "B");
      const en = document.createElement("input");
      en.type = "checkbox";
      en.checked = L.enabled;
      en.onchange = () => { L.enabled = en.checked; };
      const enLab = document.createElement("label");
      enLab.className = "toggle";
      enLab.appendChild(en);
      enLab.appendChild(document.createTextNode("On"));

      const wave = document.createElement("select");
      WAVES.forEach(([v, n]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = n;
        wave.appendChild(o);
      });
      Object.keys(engine.userSamples).forEach(name => {
        const o = document.createElement("option");
        o.value = "sample:" + name;
        o.textContent = "Sample: " + name;
        wave.appendChild(o);
      });
      wave.value = L.wave === "saw" ? "sawtooth" : L.wave;
      wave.onchange = () => { L.wave = wave.value; };

      head.appendChild(title);
      head.appendChild(enLab);
      head.appendChild(wave);
      div.appendChild(head);

      // oscillator
      const g1 = document.createElement("div");
      g1.className = "grid";
      g1.appendChild(ctl("Level", 0, 1, 0.01, () => L.level, v => L.level = v, f2));
      g1.appendChild(ctl("Pan", -1, 1, 0.01, () => L.pan, v => L.pan = v, f2));
      g1.appendChild(ctl("Octave", -3, 3, 1, () => L.octave, v => L.octave = v, int));
      g1.appendChild(ctl("Coarse", -12, 12, 1, () => L.coarse, v => L.coarse = v, int));
      g1.appendChild(ctl("Fine", -50, 50, 1, () => L.fine, v => L.fine = v, int));
      g1.appendChild(ctl("Unison", 1, 7, 1, () => L.unison, v => L.unison = v, int));
      g1.appendChild(ctl("Detune", 0, 50, 1, () => L.detune, v => L.detune = v, int));
      g1.appendChild(ctl("Glide", 0, 1, 0.01, () => L.glide, v => L.glide = v, f2));
      div.appendChild(g1);

      // filter
      const t1 = document.createElement("div");
      t1.className = "section-title";
      t1.textContent = "Filter";
      div.appendChild(t1);

      const ftype = document.createElement("select");
      [["lowpass", "Low Pass"], ["highpass", "High Pass"], ["bandpass", "Band Pass"], ["notch", "Notch"]]
        .forEach(([v, n]) => {
          const o = document.createElement("option");
          o.value = v; o.textContent = n;
          ftype.appendChild(o);
        });
      ftype.value = L.filter.type;
      ftype.onchange = () => { L.filter.type = ftype.value; };
      const frow = document.createElement("div");
      frow.className = "row";
      frow.style.marginBottom = "8px";
      frow.appendChild(ftype);
      div.appendChild(frow);

      const g2 = document.createElement("div");
      g2.className = "grid";
      g2.appendChild(ctl("Cutoff", 40, 12000, 10, () => L.filter.cutoff, v => L.filter.cutoff = v, hz));
      g2.appendChild(ctl("Reso", 0.1, 20, 0.1, () => L.filter.q, v => L.filter.q = v, f2));
      g2.appendChild(ctl("Env Amt", -6000, 6000, 50, () => L.filter.envAmt, v => L.filter.envAmt = v, hz));
      g2.appendChild(ctl("F.Atk", 0.001, 4, 0.01, () => L.filter.env.a, v => L.filter.env.a = v, sec));
      g2.appendChild(ctl("F.Dec", 0.001, 4, 0.01, () => L.filter.env.d, v => L.filter.env.d = v, sec));
      g2.appendChild(ctl("F.Sus", 0, 1, 0.01, () => L.filter.env.s, v => L.filter.env.s = v, f2));
      g2.appendChild(ctl("F.Rel", 0.01, 5, 0.01, () => L.filter.env.r, v => L.filter.env.r = v, sec));
      div.appendChild(g2);

      // amp envelope
      const t2 = document.createElement("div");
      t2.className = "section-title";
      t2.textContent = "Amp Envelope";
      div.appendChild(t2);
      const g3 = document.createElement("div");
      g3.className = "grid";
      g3.appendChild(ctl("Attack", 0.001, 5, 0.005, () => L.ampEnv.a, v => L.ampEnv.a = v, sec));
      g3.appendChild(ctl("Decay", 0.001, 5, 0.005, () => L.ampEnv.d, v => L.ampEnv.d = v, sec));
      g3.appendChild(ctl("Sustain", 0, 1, 0.01, () => L.ampEnv.s, v => L.ampEnv.s = v, f2));
      g3.appendChild(ctl("Release", 0.01, 6, 0.01, () => L.ampEnv.r, v => L.ampEnv.r = v, sec));
      div.appendChild(g3);

      // LFO
      const t3 = document.createElement("div");
      t3.className = "section-title";
      t3.textContent = "LFO";
      div.appendChild(t3);
      const ltype = document.createElement("select");
      [["pitch", "→ Pitch"], ["filter", "→ Filter"], ["amp", "→ Amp"]].forEach(([v, n]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = n;
        ltype.appendChild(o);
      });
      ltype.value = L.lfo.target;
      ltype.onchange = () => { L.lfo.target = ltype.value; };
      const lrow = document.createElement("div");
      lrow.className = "row";
      lrow.style.marginBottom = "8px";
      lrow.appendChild(ltype);
      div.appendChild(lrow);
      const g4 = document.createElement("div");
      g4.className = "grid";
      g4.appendChild(ctl("Rate", 0, 12, 0.01, () => L.lfo.rate, v => L.lfo.rate = v, f2));
      g4.appendChild(ctl("Depth", 0, 1, 0.01, () => L.lfo.depth, v => L.lfo.depth = v, f2));
      div.appendChild(g4);

      host.appendChild(div);
    });
  }

  /* ---------------- keyboard ---------------- */
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
  const KEYMAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
    g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14
  };
  const held = new Set();

  function renderKeyboard() {
    const kb = $("keyboard");
    kb.innerHTML = "";
    const octaves = 2;
    const whiteCount = 7 * octaves + 1;
    const w = 100 / whiteCount;

    for (let o = 0; o < octaves; o++) {
      for (let i = 0; i < 7; i++) {
        const midi = (octave + o + 1) * 12 + WHITE[i];
        const key = document.createElement("div");
        key.className = "key white";
        key.style.left = ((o * 7 + i) * w) + "%";
        key.style.width = w + "%";
        key.dataset.midi = midi;
        key.textContent = midiToName(midi);
        kb.appendChild(key);
      }
    }
    // final top C
    const topMidi = (octave + octaves + 1) * 12;
    const topKey = document.createElement("div");
    topKey.className = "key white";
    topKey.style.left = (7 * octaves * w) + "%";
    topKey.style.width = w + "%";
    topKey.dataset.midi = topMidi;
    topKey.textContent = midiToName(topMidi);
    kb.appendChild(topKey);

    for (let o = 0; o < octaves; o++) {
      Object.keys(BLACK).forEach(semi => {
        const midi = (octave + o + 1) * 12 + parseInt(semi, 10);
        const key = document.createElement("div");
        key.className = "key black";
        key.style.left = ((o * 7 + BLACK[semi]) * w + w * 0.68) + "%";
        key.style.width = (w * 0.62) + "%";
        key.dataset.midi = midi;
        kb.appendChild(key);
      });
    }
    attachKeyEvents();
  }

  function keyEl(midi) {
    return document.querySelector(`.key[data-midi="${midi}"]`);
  }

  function press(midi, vel) {
    if (held.has(midi)) return;
    held.add(midi);
    engine.noteOn(midi, vel === undefined ? 0.85 : vel);
    const el = keyEl(midi);
    if (el) el.classList.add("active");
  }

  function release(midi) {
    if (!held.has(midi)) return;
    held.delete(midi);
    engine.noteOff(midi);
    const el = keyEl(midi);
    if (el) el.classList.remove("active");
  }

  function attachKeyEvents() {
    document.querySelectorAll(".key").forEach(k => {
      const midi = parseInt(k.dataset.midi, 10);
      k.addEventListener("pointerdown", e => {
        e.preventDefault();
        k.setPointerCapture(e.pointerId);
        press(midi);
      });
      k.addEventListener("pointerup", () => release(midi));
      k.addEventListener("pointerleave", e => {
        if (e.buttons) release(midi);
      });
      k.addEventListener("pointercancel", () => release(midi));
    });
  }

  document.addEventListener("keydown", e => {
    if (e.repeat) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    const k = e.key.toLowerCase();
    if (KEYMAP[k] !== undefined) {
      e.preventDefault();
      press((octave + 1) * 12 + KEYMAP[k]);
    } else if (k === "z") {
      setOctave(octave - 1);
    } else if (k === "x") {
      setOctave(octave + 1);
    }
  });

  document.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (KEYMAP[k] !== undefined) release((octave + 1) * 12 + KEYMAP[k]);
  });

  function setOctave(v) {
    const next = Math.max(0, Math.min(7, v));
    if (next === octave) return;
    Array.from(held).forEach(release);
    octave = next;
    $("octVal").textContent = octave;
    renderKeyboard();
  }

  /* ---------------- arpeggiator ---------------- */
  function updateArp() {
    if (arpTimer) { clearInterval(arpTimer); arpTimer = null; }
    if (!$("arpOn").checked) return;
    const bpm = parseInt($("arpRate").value, 10);
    const interval = 60000 / bpm / 2;   // eighth notes
    let lastNote = null;
    arpTimer = setInterval(() => {
      const notes = Array.from(held).sort((a, b) => a - b);
      if (lastNote !== null) { engine.noteOff(lastNote); lastNote = null; }
      if (!notes.length) { arpIndex = 0; return; }
      const n = notes[arpIndex % notes.length];
      arpIndex++;
      engine.noteOn(n, 0.8);
      lastNote = n;
    }, interval);
  }

  /* ---------------- scope ---------------- */
  function drawScope() {
    const cv = $("scope");
    const ctx2d = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== cv.clientWidth * dpr) {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
    }
    const W = cv.width, H = cv.height;
    ctx2d.clearRect(0, 0, W, H);
    ctx2d.fillStyle = "#0a0d14";
    ctx2d.fillRect(0, 0, W, H);

    if (engine.ready && engine.analyser) {
      const n = engine.analyser.fftSize;
      const data = new Uint8Array(n);
      engine.analyser.getByteTimeDomainData(data);
      const grad = ctx2d.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "#58e0d0");
      grad.addColorStop(1, "#c58cff");
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = 2 * dpr;
      ctx2d.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / n) * W;
        const y = (data[i] / 128 - 1) * (H / 2) + H / 2;
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();
    }
    requestAnimationFrame(drawScope);
  }

  /* ---------------- patch import / export ---------------- */
  function exportPatch() {
    const data = JSON.stringify(engine.patch, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = engine.patch.name.replace(/[^\w\-]+/g, "_") + ".owpatch";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function validatePatch(p) {
    if (!p || typeof p !== "object") throw new Error("not an object");
    if (!Array.isArray(p.layers) || !p.layers.length) throw new Error("missing layers");
    if (!p.master || !p.fx) throw new Error("missing master/fx section");
    return true;
  }

  function importPatch(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".prt_omn") || name.endsWith(".omnisphere")) {
      alert(
        "That's a Spectrasonics Omnisphere patch.\n\n" +
        "It can't be loaded here: the file only points at Omnisphere's " +
        "encrypted STEAM sample library and its proprietary engine, so the " +
        "actual sound isn't in the file. Load a .owpatch, or import your own " +
        "audio with the sample loader."
      );
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result);
        validatePatch(p);
        p.name = p.name || file.name.replace(/\.[^.]+$/, "");
        userPatches.push(p);
        saveUserPatches();
        renderPatchList();
        selectPatch(patches.length + userPatches.length - 1);
      } catch (e) {
        alert("Could not read that patch file: " + e.message);
      }
    };
    r.readAsText(file);
  }

  function refreshSampleList() {
    const names = Object.keys(engine.userSamples);
    $("sampleList").textContent = names.length
      ? names.join(", ")
      : "No samples loaded.";
  }

  /* ---------------- wiring ---------------- */
  $("savePatchBtn").onclick = exportPatch;
  $("loadPatchBtn").onclick = () => $("patchFile").click();
  $("patchFile").onchange = e => {
    if (e.target.files[0]) importPatch(e.target.files[0]);
    e.target.value = "";
  };

  $("storeBtn").onclick = () => {
    const name = prompt("Save patch as:", engine.patch.name + " (edit)");
    if (!name) return;
    const copy = clonePatch(engine.patch);
    copy.name = name;
    copy.author = "you";
    copy.category = copy.category || "User";
    userPatches.push(copy);
    saveUserPatches();
    renderPatchList();
    selectPatch(patches.length + userPatches.length - 1);
  };

  $("clearUserBtn").onclick = () => {
    if (!userPatches.length) { alert("No saved patches to clear."); return; }
    if (!confirm(`Delete all ${userPatches.length} saved patch(es)? This cannot be undone.`)) return;
    userPatches = [];
    saveUserPatches();
    current = Math.min(current, patches.length - 1);
    renderPatchList();
    selectPatch(current);
  };

  $("sampleBtn").onclick = () => $("sampleFile").click();
  $("sampleFile").onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      await engine.addSample(file.name.replace(/\.[^.]+$/, ""), buf);
      refreshSampleList();
      renderLayers();   // repopulate wave dropdowns with the new sample
    } catch (err) {
      alert("Could not decode that audio file: " + err.message);
    }
    e.target.value = "";
  };

  $("panicBtn").onclick = () => {
    engine.allNotesOff(true);
    held.clear();
    document.querySelectorAll(".key.active").forEach(k => k.classList.remove("active"));
  };

  $("octDown").onclick = () => setOctave(octave - 1);
  $("octUp").onclick = () => setOctave(octave + 1);
  $("arpOn").onchange = updateArp;
  $("arpRate").oninput = () => {
    $("arpRateVal").textContent = $("arpRate").value;
    if ($("arpOn").checked) updateArp();
  };

  engine.onVoiceChange = n => {
    $("voiceCount").textContent = n + (n === 1 ? " voice" : " voices");
  };

  // The audio context must start from a user gesture.
  ["pointerdown", "keydown"].forEach(ev =>
    document.addEventListener(ev, () => engine.resume(), { once: true }));

  // Debug handle: lets you inspect or drive the synth from the console.
  window.omniweb = { engine, press, release, selectPatch, get patch() { return engine.patch; } };

  loadUserPatches();
  renderPatchList();
  selectPatch(0);
  renderKeyboard();
  refreshSampleList();
  drawScope();
})();

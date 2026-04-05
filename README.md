# MetalZone

Boss MT-2 Metal Zone-style distortion in two flavors:

1. **VST3 plugin** (Windows, JUCE 8) — loads in any VST3 host (Fender Studio, Reaper, Ableton, …)
2. **Web demo** — browser-based demo of the same DSP at [metalzone.joshphoenix.com](https://metalzone.joshphoenix.com)

DSP topology (both versions):

```
  in → DC-block → pre-gain(DIST) → tanh(clip1) → HPF(720 Hz)
     → asym-tanh(clip2) → low shelf → mid peak → high shelf → LEVEL → out
```

VST: 4× oversampled nonlinear stages. Web: no oversampling (smoother aliasing
from tanh is the tradeoff).

> **Fidelity note:** *circuit-informed*, not circuit-accurate. Topology and
> character reference the MT-2 but this is not a component-level simulation.

## Controls

| Knob | Range | Notes |
|---|---|---|
| LEVEL | 0..1 | Output volume (≈ unity at 0.5) |
| DIST | 0..1 | Pre-gain into clipping stages (1× to ~200×) |
| LOW | ±15 dB | Low shelf @ 100 Hz (inner of the HIGH/LOW concentric) |
| HIGH | ±15 dB | High shelf @ 8 kHz (outer of the HIGH/LOW concentric) |
| MIDDLE | ±15 dB | Parametric mid peak (inner of MID FREQ/MIDDLE concentric) |
| MID FREQ | 200 Hz – 5 kHz | Mid band centre (outer, log-skewed) |

All 6 parameters are host-automatable in the VST.

## Download (prebuilt Windows VST3)

1. Open [**Actions**](../../actions/workflows/build-windows.yml) → latest successful run
2. Download the `MetalZone-Windows-VST3` artifact (zip)
3. Unzip → `MetalZone.vst3` folder
4. Copy into `C:\Program Files\Common Files\VST3\`
5. Rescan plugins in your host (Fender Studio, Reaper, Ableton, …)

## Build locally (Windows)

Visual Studio 2022 Build Tools + CMake ≥ 3.22:

```powershell
git clone https://github.com/joshphoenix1/metalzone.git
cd metalzone
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target MetalZone_VST3
```

Output: `build/MetalZone_artefacts/Release/VST3/MetalZone.vst3/`

## Web demo

Everything in `web/` is a static site — open `web/index.html` directly, or
serve locally:

```bash
cd web && python3 -m http.server 8000
# then open http://localhost:8000
```

Published via GitHub Pages on every push to `main`. Custom domain:
`metalzone.joshphoenix.com` (see DNS setup below).

### DNS setup for `metalzone.joshphoenix.com`

At your `joshphoenix.com` DNS registrar add one record:

```
Type:  CNAME
Name:  metalzone
Value: joshphoenix1.github.io
TTL:   3600
```

Then in the GitHub repo: **Settings → Pages → Custom domain** →
`metalzone.joshphoenix.com` and tick **Enforce HTTPS** once the cert issues
(takes a few minutes after DNS propagates).

The `web/CNAME` file in this repo tells Pages which domain to serve.

## Project layout

```
CMakeLists.txt              — JUCE 8 pulled via FetchContent
src/
  PluginProcessor.{h,cpp}   — DSP (oversampling, clippers, EQ)
  PluginEditor.{h,cpp}      — Pedal-skinned GUI
  PedalLookAndFeel.h        — Knob rendering
  ConcentricKnob.h          — Dual-concentric knob component
web/
  index.html                — Pedal UI (CSS-drawn)
  style.css                 — MT-2 skin
  app.js                    — WebAudio graph + knob behaviour
  worklet.js                — AudioWorklet DSP (mirrors VST)
  CNAME                     — Custom domain file for GH Pages
.github/workflows/
  build-windows.yml         — Windows VST3 build on every push
  deploy-pages.yml          — Web demo deploy on every push
```

## License

GPL-3.0 (JUCE's GPL module license).

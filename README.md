# MetalZone VST3

A Boss MT-2 Metal Zone-style distortion plugin. Dual cascaded soft-clipping stages with a
mid-shaping HPF between them and an active 3-band tone stack (low shelf, sweepable parametric
mid, high shelf). 4× oversampled nonlinear stages for clean aliasing behaviour.

Built with [JUCE](https://juce.com/) 8, VST3, Windows x64.

> **Fidelity note:** this is *circuit-informed*, not circuit-accurate. Topology and character
> match the MT-2, but it is not a component-level simulation.

## Controls

| Knob | Range | Notes |
|---|---|---|
| LEVEL | 0 .. 1 | Output volume (≈ unity at 0.5) |
| DIST | 0 .. 1 | Pre-gain into the clipping stages (1× to ~200×) |
| LOW | ±15 dB | Low shelf at 100 Hz |
| MID | ±15 dB | Parametric mid peak |
| MID FREQ | 200 Hz .. 5 kHz | Mid band centre frequency |
| HIGH | ±15 dB | High shelf at 8 kHz |

## Download (prebuilt Windows VST3)

1. Go to the [**Actions**](../../actions/workflows/build-windows.yml) tab.
2. Click the latest successful run.
3. Under **Artifacts**, download `MetalZone-Windows-VST3`.
4. Unzip it. You get a `MetalZone.vst3` folder.
5. Copy it into `C:\Program Files\Common Files\VST3\`.
6. Rescan plugins in your host (Fender Studio, Reaper, Ableton, etc.).

## Build locally (Windows)

Requirements: Visual Studio 2022 (Build Tools OK), CMake ≥ 3.22, git.

```powershell
git clone https://github.com/joshphoenix1/metalzone.git
cd metalzone
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target MetalZone_VST3
```

Output: `build/MetalZone_artefacts/Release/VST3/MetalZone.vst3/`

## Project layout

```
CMakeLists.txt                  — JUCE pulled via FetchContent
src/PluginProcessor.{h,cpp}     — DSP (oversampling, clippers, EQ)
src/PluginEditor.{h,cpp}        — 6-knob UI
.github/workflows/              — CI: Windows VST3 build
```

## License

GPL-3.0 (JUCE's GPL module license). For closed-source distribution you'd need a JUCE commercial
license.

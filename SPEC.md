# EchoScape — Audio-Reactive 3D Void Explorer

## Concept & Vision

A first-person journey through a void world that responds to sound. Speak, sing, hum — your voice sculpts the terrain around you in real-time. High amplitude creates towering peaks. Low frequencies rumble the ground. High frequencies sparkle the sky. Silence is an empty void; sound is creation. The aesthetic is cosmic and mysterious — like navigating the inside of a synthesizer.

## Design Language

- **Aesthetic:** Cosmic void — deep space with audio-reactive geometry. Think the cover of a prog rock album meets a planetarium.
- **Colors:** 
  - Background: `#050510` (deep void)
  - Terrain base: `#0a0a1a` → `#1a0a2e` (dark purple-blue)
  - Amplitude high: `#ff6b35` (solar orange)
  - Amplitude mid: `#7b2fff` (electric violet)
  - Amplitude low: `#00d4ff` (cyan)
  - Accent/glow: `#ffffff` at low opacity
- **Typography:** `Space Mono` — monospace, technical, cosmic terminal feel
- **Motion:** Smooth first-person movement, terrain morphs continuously with audio
- **Visual effects:** Star field, fog depth, glowing grid lines on terrain, CRT scanline overlay

## Layout & Structure

- **Full-screen 3D canvas** — immersive, no UI chrome except minimal HUD
- **HUD overlay:** Bottom-left shows audio level bars, top-right shows coordinates and audio mode
- **Intro screen:** "Speak to create" with pulsing microphone prompt, dissolves on audio detection
- **Controls hint:** Bottom-right, subtle, shows WASD + mouse controls

## Features & Interactions

### Core Mechanics
1. **Microphone input** → real-time FFT analysis → terrain generation
2. **Amplitude** → terrain height (loud = peaks, quiet = flat)
3. **Frequency bands** → terrain color tint (bass=cyan, mid=violet, treble=orange)
4. **Spectral centroid** → fog density and star brightness
5. **First-person navigation** — WASD + mouse look (pointer lock)
6. **Procedural infinite terrain** — chunks load/unload as you move

### Audio Analysis Pipeline
- `AudioContext` with `AnalyserNode` (FFT size 256)
- Frequency bins grouped into: sub-bass, bass, low-mid, mid, high-mid, presence, brilliance
- Each band drives a different visual parameter
- Smooth interpolation (lerp) so terrain doesn't jitter

### Terrain System
- Grid-based terrain with ~50x50 vertex resolution per chunk
- Chunk size: 100 units, render distance: 3 chunks each direction
- Height from amplitude history (rolling buffer for smooth morphing)
- Color from dominant frequency band
- Glowing grid overlay (line segments) on terrain surface

### Environment
- Star field (point particles, 2000 stars) with parallax
- Fog starting at distance 50, fully opaque at 300
- Subtle grid地面 (flat plane below terrain at y=-5)
- Skybox: solid void color with subtle radial gradient

### States
- **Intro:** Canvas + centered prompt, waiting for audio permission
- **Exploring:** Full first-person, audio drives terrain
- **Paused:** ESC to release pointer lock, show controls

## Component Inventory

### Intro Overlay
- States: hidden (after permission granted)
- "🎙 Speak to Create" text, pulsing opacity animation (1s ease-in-out infinite)
- Subtext: "Click to enable microphone"
- Click → request microphone access → fade out overlay

### HUD - Audio Visualizer (bottom-left)
- 8 vertical bars representing frequency bands
- Height maps to amplitude of each band
- Color matches band color mapping
- 60px wide, 120px tall, dark background pill shape

### HUD - Coordinates (top-right)
- Current X, Z position (Y is always eye-level at 8 units)
- Font: Space Mono, small, white at 50% opacity

### Controls Hint (bottom-right)
- "WASD move · MOUSE look · ESC pause"
- Small, Space Mono, 30% opacity

## Technical Approach

- **Single HTML file** — no build step, pure Three.js via CDN
- **Three.js r158** from unpkg CDN
- **PointerLockControls** for first-person camera
- **SimplexNoise** (embedded, not external dep) for baseline terrain shape
- **Rolling history buffer** for audio (30 frames) to smooth terrain morphing
- **RequestAnimationFrame loop** — ~60fps target
- **Resize handler** — canvas fills viewport, updates camera aspect

## File Structure

Single file: `index.html` — everything inline (JS, CSS, shaders)
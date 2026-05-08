# Void Walker

Procedural space exploration game with procedurally generated sectors, asteroid fields, anomaly events, and resource collection. Navigate your ship through an infinite void, gather void matter and energy nodes, avoid asteroids, and warp through spatial anomalies.

```
    ╭─────────────────────────────────────────╮
    │  ▲                                      │
    │ ╱╲   VOID WALKER                       │
    │  ║    Space Explorer                    │
    │ ╱╲╱                                    │
    │   ║   8-directional movement           │
    │         Mouse-aim + WASD thrust        │
    │         Procedural sectors             │
    │         Energy / Shield management     │
    ╰─────────────────────────────────────────╯
```

## Features

- **Procedural sector generation** — seed-based nebula placement, asteroid clusters, anomaly spawning; each new sector advances the sector counter and regenerates the environment
- **3 entity types:** Void Matter (purple diamond, +15 energy), Energy Nodes (gold hexagon, +30 energy), Anomalies (wormhole/pulsar/void-gate, +500 score + level jump)
- **Asteroid collision** — shields take damage proportional to asteroid size; game over at 0 shields, respawn in starting room
- **Auto-scanner** — every 2.5s, pings any collectible or anomaly within 450 units, shown as transient blips on the HUD radar
- **4-layer parallax starfield** — depth layers at parallax factors 0.1, 0.3, 0.6, 1.0 with twinkling
- **Minimap HUD** — 120×120px radar in top-right showing collectibles (color dots), anomalies (purple squares), asteroids (gray dots)
- **WASD + mouse** — ship always aims toward mouse; WASD applies thrust in screen-space directions
- **Velocity-based drift** — `DRIFT = 0.97` multiplier per frame, max speed clamped at `SHIP_SPEED = 4.5`

## Controls

| Key | Action |
|-----|--------|
| `W / ↑` | Thrust up |
| `S / ↓` | Thrust down |
| `A / ←` | Thrust left |
| `D / →` | Thrust right |
| `Mouse` | Aim direction |
| `Space` | Pause/Resume |

## Tech Stack

- **React + Vite** — `src/App.tsx` is the entire game logic
- **Canvas 2D** — no WebGL dependencies, `requestAnimationFrame` loop
- **No external game libraries** — all boids, physics, and rendering custom

## Architecture

```
GameState {
  ship: { x, y, angle, velocity }
  energy, shields, score, sector, sectorProgress
  collecting[], anomalies[], asteroids[], particlePool[]
  scannerPings[], nebulae[], seed
}

Per frame:
  1. Rotate ship toward mouse (angle diff, ROT_SPEED=0.12)
  2. Apply thrust → velocity
  3. Clamp + drift velocity
  4. Move ship
  5. Drain energy (-0.08/frame), regen shields (+0.02/frame)
  6. Advance sector progress → regenerate sector at threshold
  7. Spawn collectibles (1.5% per frame), anomalies (0.2%, max 3), asteroids (0.8%, max 25)
  8. Update all entity positions + animations
  9. Auto-scan within 450 units every 2.5s
  10. Collect / collide / interact
  11. Render: stars (4 parallax layers) → nebulae → asteroids → collectibles → particles → ship → HUD
```

## License

MIT
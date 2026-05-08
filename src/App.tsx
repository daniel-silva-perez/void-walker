import { useEffect, useRef, useCallback } from 'react'

// === TYPES ===
interface Vec2 { x: number; y: number }
interface Nebula { x: number; y: number; radius: number; color: string; opacity: number }
interface Asteroid { x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotSpeed: number }
interface Collectible { x: number; y: number; type: 'void-matter' | 'energy-node'; pulse: number; alive: boolean }
interface Anomaly { x: number; y: number; kind: 'wormhole' | 'pulsar' | 'void-gate'; phase: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface ScannerPing { x: number; y: number; t: number }

interface GameState {
  ship: Vec2
  shipAngle: number
  velocity: Vec2
  energy: number
  shields: number
  score: number
  sector: number
  sectorProgress: number
  collecting: Collectible[]
  anomalies: Anomaly[]
  asteroids: Asteroid[]
  particlePool: Particle[]
  scannerPings: ScannerPing[]
  mouse: Vec2
  keys: Set<string>
  running: boolean
  paused: boolean
  nebulae: Nebula[]
  seed: number
}

// === CONSTANTS ===
const SHIP_SPEED = 4.5
const DRIFT = 0.97
const ROT_SPEED = 0.12
const COLLECTIBLE_SPAWN_RATE = 0.015
const ANOMALY_SPAWN_RATE = 0.002
const ASTEROID_SPAWN_RATE = 0.008
const VOID_MATTER_ENERGY = 15
const ENERGY_NODE_ENERGY = 30
const SHIELD_REGEN = 0.02
const ENERGY_DRAIN = 0.08
const SCAN_INTERVAL = 2.5

const STAR_COLORS = ['#ffffff', '#aaccff', '#ffddaa', '#ffaaaa', '#aaffaa', '#ccaaff']
const NEBULA_COLORS = ['#1a0533', '#052033', '#330520', '#203305', '#331505', '#052030']
const COLLECTIBLE_COLORS = { 'void-matter': '#9966ff', 'energy-node': '#ffaa33' }

// === UTILITIES ===
function rnd(min: number, max: number) { return Math.random() * (max - min) + min }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function dist(a: Vec2, b: Vec2) { return Math.hypot(b.x - a.x, b.y - a.y) }

// === SECTOR GENERATION ===
function generateSector(sector: number): { nebulae: Nebula[]; seed: number } {
  const seed = sector * 1337
  const nebulae: Nebula[] = []
  const nebCount = rndInt(1, 3)
  for (let i = 0; i < nebCount; i++) {
    nebulae.push({
      x: rnd(-2000, 2000),
      y: rnd(-2000, 2000),
      radius: rnd(300, 700),
      color: NEBULA_COLORS[rndInt(0, NEBULA_COLORS.length - 1)],
      opacity: rnd(0.3, 0.7),
    })
  }
  return { nebulae, seed }
}

// === HELPER FUNCTIONS ===
function spawnAsteroid(state: GameState) {
  const angle = rnd(0, Math.PI * 2)
  const d = rnd(400, 800)
  state.asteroids.push({
    x: state.ship.x + Math.cos(angle) * d,
    y: state.ship.y + Math.sin(angle) * d,
    vx: rnd(-0.5, 0.5),
    vy: rnd(-0.5, 0.5),
    size: rnd(8, 28),
    rotation: rnd(0, Math.PI * 2),
    rotSpeed: rnd(-0.03, 0.03),
  })
}

function spawnCollectible(state: GameState) {
  const angle = rnd(0, Math.PI * 2)
  const d = rnd(250, 600)
  const type = Math.random() < 0.7 ? 'void-matter' : 'energy-node'
  state.collecting.push({ x: state.ship.x + Math.cos(angle) * d, y: state.ship.y + Math.sin(angle) * d, type, pulse: rnd(0, Math.PI * 2), alive: true })
}

function spawnAnomaly(state: GameState) {
  const kinds: ('wormhole' | 'pulsar' | 'void-gate')[] = ['wormhole', 'pulsar', 'void-gate']
  const kind = kinds[rndInt(0, 2)]
  const angle = rnd(0, Math.PI * 2)
  state.anomalies.push({ x: state.ship.x + Math.cos(angle) * rnd(500, 900), y: state.ship.y + Math.sin(angle) * rnd(500, 900), kind, phase: 0, alive: true })
}

function emitParticles(state: GameState, x: number, y: number, count: number, color: string, speed = 3) {
  for (let i = 0; i < count; i++) {
    const a = rnd(0, Math.PI * 2)
    const s = rnd(0.5, speed)
    state.particlePool.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(20, 50), maxLife: 50, color, size: rnd(1, 3) })
  }
}

// === MAIN COMPONENT ===
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const lastScanRef = useRef(0)
  const rafRef = useRef<number>(0)

  const makeInitGame = useCallback((): (canvas: HTMLCanvasElement) => GameState => {
    return (canvas: HTMLCanvasElement): GameState => {
      const { nebulae, seed } = generateSector(1)
      const asteroids: Asteroid[] = []
      const state: GameState = {
        ship: { x: canvas.width / 2, y: canvas.height / 2 },
        shipAngle: -Math.PI / 2,
        velocity: { x: 0, y: 0 },
        energy: 100,
        shields: 100,
        score: 0,
        sector: 1,
        sectorProgress: 0,
        collecting: [],
        anomalies: [],
        asteroids,
        particlePool: [],
        scannerPings: [],
        mouse: { x: canvas.width / 2, y: canvas.height / 2 },
        keys: new Set(),
        running: true,
        paused: false,
        nebulae,
        seed,
      }
      for (let i = 0; i < 12; i++) spawnAsteroid(state)
      return state
    }
  }, [])

  const render = useCallback((ctx: CanvasRenderingContext2D, state: GameState, t: number) => {
    const { width, height } = ctx.canvas

    // Background - deep void
    ctx.fillStyle = '#030308'
    ctx.fillRect(0, 0, width, height)

    // Depth-layer parallax stars (4 layers)
    const depthLayers = [0.1, 0.3, 0.6, 1.0]
    const starsByDepth: { x: number; y: number; size: number; color: string; twinkle: number }[][] = [[], [], [], []]
    const starSeed = state.seed
    for (let layer = 0; layer < 4; layer++) {
      const count = [120, 80, 50, 30][layer]
      for (let i = 0; i < count; i++) {
        const sx = ((i * 137.508 + starSeed * (layer + 1) * 0.01) % width + width) % width
        const sy = ((i * 251.73 + starSeed * (layer + 1) * 0.02) % height + height) % height
        starsByDepth[layer].push({
          x: sx, y: sy,
          size: [0.5, 0.8, 1.2, 1.8][layer],
          color: STAR_COLORS[Math.floor(((i * 73.13 + starSeed) % STAR_COLORS.length) + 0)],
          twinkle: Math.sin(t * 0.002 + i) * 0.5 + 0.5,
        })
      }
    }

    // Draw nebulae
    for (const neb of state.nebulae) {
      const nx = ((neb.x - state.ship.x * 0.15 + width * 10) % width)
      const ny = ((neb.y - state.ship.y * 0.15 + height * 10) % height)
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, neb.radius)
      g.addColorStop(0, neb.color + 'cc')
      g.addColorStop(0.5, neb.color + '66')
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = neb.opacity
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }

    // Draw stars with parallax
    for (let layer = 0; layer < 4; layer++) {
      const parallax = depthLayers[layer]
      for (const star of starsByDepth[layer]) {
        const sx = ((star.x - state.ship.x * parallax + width * 10) % width)
        const sy = ((star.y - state.ship.y * parallax + height * 10) % height)
        const twinkleSize = star.size * (0.7 + star.twinkle * 0.6)
        ctx.globalAlpha = 0.4 + star.twinkle * 0.6
        ctx.fillStyle = star.color
        ctx.beginPath()
        ctx.arc(sx, sy, twinkleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // Scanner rings
    const scanAge = (t / 1000) - lastScanRef.current
    if (scanAge < SCAN_INTERVAL) {
      const progress = scanAge / SCAN_INTERVAL
      const ringRadius = progress * 450
      ctx.strokeStyle = `rgba(0, 255, 200, ${0.4 * (1 - progress)})`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.arc(state.ship.x, state.ship.y, ringRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Scanner pings
    for (const ping of state.scannerPings) {
      const age = (t / 1000) - ping.t
      if (age < 3) {
        ctx.globalAlpha = 1 - age / 3
        ctx.fillStyle = '#00ffc8'
        ctx.beginPath()
        ctx.arc(ping.x, ping.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    // Draw anomalies
    for (const anom of state.anomalies) {
      if (!anom.alive) continue
      const ax = anom.x - state.ship.x + state.ship.x
      const ay = anom.y - state.ship.y + state.ship.y
      const pulseSize = 20 + Math.sin(anom.phase) * 8
      const alpha = 0.6 + Math.sin(anom.phase) * 0.3

      if (anom.kind === 'wormhole') {
        ctx.strokeStyle = `rgba(100, 50, 255, ${alpha})`
        ctx.lineWidth = 2
        for (let ring = 0; ring < 3; ring++) {
          const r = pulseSize + ring * 10
          ctx.globalAlpha = alpha - ring * 0.15
          ctx.beginPath()
          ctx.arc(ax, ay, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      } else if (anom.kind === 'pulsar') {
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(ax, ay, pulseSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.5})`
        ctx.lineWidth = 1
        for (let a2 = 0; a2 < 8; a2++) {
          const ang = (a2 / 8) * Math.PI * 2 + anom.phase * 0.5
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(ax + Math.cos(ang) * 50, ay + Math.sin(ang) * 50)
          ctx.stroke()
        }
      } else {
        ctx.save()
        ctx.translate(ax, ay)
        ctx.rotate(anom.phase * 0.3)
        ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`
        ctx.lineWidth = 2
        ctx.strokeRect(-pulseSize, -pulseSize, pulseSize * 2, pulseSize * 2)
        ctx.restore()
      }
    }

    // Draw asteroids
    for (const ast of state.asteroids) {
      const ax = ast.x - state.ship.x + state.ship.x
      const ay = ast.y - state.ship.y + state.ship.y
      ctx.save()
      ctx.translate(ax, ay)
      ctx.rotate(ast.rotation)
      ctx.strokeStyle = '#667788'
      ctx.lineWidth = 1.5
      ctx.fillStyle = '#1a2233'
      ctx.beginPath()
      const sides = rndInt(5, 8)
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        const r = ast.size * (0.7 + Math.sin(i * 2.3) * 0.3)
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // Draw collectibles
    for (const col of state.collecting) {
      if (!col.alive) continue
      const cx = col.x - state.ship.x + state.ship.x
      const cy = col.y - state.ship.y + state.ship.y
      const color = COLLECTIBLE_COLORS[col.type]
      const glow = Math.sin(col.pulse) * 0.4 + 0.6

      ctx.shadowBlur = 15
      ctx.shadowColor = color
      ctx.fillStyle = color
      ctx.globalAlpha = glow

      if (col.type === 'void-matter') {
        ctx.beginPath()
        ctx.moveTo(cx, cy - 10)
        ctx.lineTo(cx + 7, cy)
        ctx.lineTo(cx, cy + 10)
        ctx.lineTo(cx - 7, cy)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          const r = 8 + Math.sin(col.pulse * 2) * 2
          if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
      }

      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    // Draw particles
    for (const p of state.particlePool) {
      const alpha = p.life / p.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Draw ship
    const shipX = state.ship.x
    const shipY = state.ship.y
    ctx.save()
    ctx.translate(shipX, shipY)
    ctx.rotate(state.shipAngle)

    const enginePulse = 0.7 + Math.sin(t * 0.01) * 0.3
    ctx.shadowBlur = 20 * enginePulse
    ctx.shadowColor = '#00ddff'
    ctx.fillStyle = `rgba(0, 220, 255, ${enginePulse * 0.6})`
    ctx.beginPath()
    ctx.moveTo(-8, -6)
    ctx.lineTo(-18 - enginePulse * 10, 0)
    ctx.lineTo(-8, 6)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#e0f4ff'
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(-10, -10)
    ctx.lineTo(-5, 0)
    ctx.lineTo(-10, 10)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#00ddff'
    ctx.beginPath()
    ctx.arc(8, 0, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    renderHUD(ctx, state, t, width, height)
  }, [])

  const renderHUD = (ctx: CanvasRenderingContext2D, state: GameState, t: number, width: number, height: number) => {
    const barW = 200
    const barH = 12
    const pad = 20

    // Energy bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(pad, pad, barW + 4, barH + 4)
    ctx.fillStyle = '#222'
    ctx.fillRect(pad + 2, pad + 2, barW, barH)
    const energyColor = state.energy > 30 ? '#00ffaa' : state.energy > 15 ? '#ffaa00' : '#ff3355'
    ctx.fillStyle = energyColor
    ctx.fillRect(pad + 2, pad + 2, barW * (state.energy / 100), barH)
    ctx.fillStyle = '#fff'
    ctx.font = '10px monospace'
    ctx.fillText(`ENERGY ${Math.floor(state.energy)}%`, pad + 4, pad + 11)

    // Shield bar
    const shieldY = pad + barH + 8
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(pad, shieldY, barW + 4, barH + 4)
    ctx.fillStyle = '#222'
    ctx.fillRect(pad + 2, shieldY + 2, barW, barH)
    const shieldColor = state.shields > 50 ? '#4488ff' : state.shields > 25 ? '#ffaa00' : '#ff3355'
    ctx.fillStyle = shieldColor
    ctx.fillRect(pad + 2, shieldY + 2, barW * (state.shields / 100), barH)
    ctx.fillStyle = '#fff'
    ctx.fillText(`SHIELDS ${Math.floor(state.shields)}%`, pad + 4, shieldY + 11)

    // Score & sector
    ctx.fillStyle = '#aaa'
    ctx.font = '12px monospace'
    ctx.fillText(`SCORE: ${state.score.toString().padStart(6, '0')}`, pad, pad + barH * 2 + 30)
    ctx.fillText(`SECTOR ${state.sector}`, pad, pad + barH * 2 + 46)

    // Scanner display (top right)
    const scanX = width - 160
    const scanY = pad
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(scanX, scanY, 140, 140)
    ctx.strokeStyle = '#00ffc8'
    ctx.lineWidth = 1
    ctx.strokeRect(scanX, scanY, 140, 140)
    ctx.fillStyle = '#00ffc8'
    ctx.font = '9px monospace'
    ctx.fillText('SCANNER', scanX + 5, scanY + 12)

    const mapSize = 120
    const mapOX = scanX + 10
    const mapOY = scanY + 22
    ctx.fillStyle = 'rgba(0, 255, 200, 0.1)'
    ctx.fillRect(mapOX, mapOY, mapSize, mapSize)
    ctx.strokeStyle = '#00ffc844'
    ctx.strokeRect(mapOX, mapOY, mapSize, mapSize)

    ctx.fillStyle = '#00ffc8'
    ctx.fillRect(mapOX + mapSize / 2 - 2, mapOY + mapSize / 2 - 2, 4, 4)

    const minimapScale = 0.06
    for (const col of state.collecting) {
      if (!col.alive) continue
      const mx = mapOX + mapSize / 2 + (col.x - state.ship.x) * minimapScale
      const my = mapOY + mapSize / 2 + (col.y - state.ship.y) * minimapScale
      if (mx >= mapOX && mx <= mapOX + mapSize && my >= mapOY && my <= mapOY + mapSize) {
        ctx.fillStyle = COLLECTIBLE_COLORS[col.type]
        ctx.fillRect(mx - 1, my - 1, 3, 3)
      }
    }
    for (const anom of state.anomalies) {
      if (!anom.alive) continue
      const mx = mapOX + mapSize / 2 + (anom.x - state.ship.x) * minimapScale
      const my = mapOY + mapSize / 2 + (anom.y - state.ship.y) * minimapScale
      if (mx >= mapOX && mx <= mapOX + mapSize && my >= mapOY && my <= mapOY + mapSize) {
        ctx.fillStyle = '#aa44ff'
        ctx.fillRect(mx - 2, my - 2, 4, 4)
      }
    }
    for (const ast of state.asteroids) {
      const mx = mapOX + mapSize / 2 + (ast.x - state.ship.x) * minimapScale
      const my = mapOY + mapSize / 2 + (ast.y - state.ship.y) * minimapScale
      if (mx >= mapOX && mx <= mapOX + mapSize && my >= mapOY && my <= mapOY + mapSize) {
        ctx.fillStyle = '#667788'
        ctx.fillRect(mx - 1, my - 1, 2, 2)
      }
    }

    // Controls hint
    ctx.fillStyle = '#555'
    ctx.font = '10px monospace'
    ctx.fillText('WASD/ARROWS + MOUSE', pad, height - pad - 20)
    ctx.fillText('SPACE = PAUSE', pad, height - pad - 8)

    // Pause overlay
    if (state.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#00ffc8'
      ctx.font = 'bold 36px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('PAUSED', width / 2, height / 2)
      ctx.font = '14px monospace'
      ctx.fillStyle = '#aaa'
      ctx.fillText('Press SPACE to resume', width / 2, height / 2 + 30)
      ctx.textAlign = 'left'
    }

    // Low energy warning
    if (state.energy < 20 && Math.floor(t / 500) % 2 === 0) {
      ctx.fillStyle = '#ff3355'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('⚠ LOW ENERGY ⚠', width / 2, height - pad - 10)
      ctx.textAlign = 'left'
    }
  }

  const makeUpdate = useCallback((canvas: HTMLCanvasElement) => {
    return (state: GameState, _dt: number, t: number) => {
      if (state.paused || !state.running) return

      const { keys } = state

      // Rotate ship toward mouse
      const dx = state.mouse.x - state.ship.x
      const dy = state.mouse.y - state.ship.y
      const targetAngle = Math.atan2(dy, dx)
      let angleDiff = targetAngle - state.shipAngle
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      state.shipAngle += angleDiff * ROT_SPEED

      // Thrust
      let thrustX = 0, thrustY = 0
      if (keys.has('w') || keys.has('arrowup')) thrustY -= 1
      if (keys.has('s') || keys.has('arrowdown')) thrustY += 1
      if (keys.has('a') || keys.has('arrowleft')) thrustX -= 1
      if (keys.has('d') || keys.has('arrowright')) thrustX += 1

      if (thrustX !== 0 || thrustY !== 0) {
        const len = Math.hypot(thrustX, thrustY)
        state.velocity.x += (thrustX / len) * SHIP_SPEED * 0.15
        state.velocity.y += (thrustY / len) * SHIP_SPEED * 0.15
        if (Math.random() < 0.4) {
          const backAngle = state.shipAngle + Math.PI + rnd(-0.3, 0.3)
          state.particlePool.push({
            x: state.ship.x + Math.cos(state.shipAngle + Math.PI) * 12,
            y: state.ship.y + Math.sin(state.shipAngle + Math.PI) * 12,
            vx: Math.cos(backAngle) * rnd(1, 3),
            vy: Math.sin(backAngle) * rnd(1, 3),
            life: rnd(10, 25),
            maxLife: 25,
            color: '#00ddff',
            size: rnd(1, 2.5),
          })
        }
      }

      // Velocity cap + drift
      const speed = Math.hypot(state.velocity.x, state.velocity.y)
      if (speed > SHIP_SPEED) {
        state.velocity.x = (state.velocity.x / speed) * SHIP_SPEED
        state.velocity.y = (state.velocity.y / speed) * SHIP_SPEED
      }
      state.velocity.x *= DRIFT
      state.velocity.y *= DRIFT

      state.ship.x += state.velocity.x
      state.ship.y += state.velocity.y

      state.ship.x = clamp(state.ship.x, -100, canvas.width + 100)
      state.ship.y = clamp(state.ship.y, -100, canvas.height + 100)

      // Energy drain & shield regen
      state.energy = Math.max(0, state.energy - ENERGY_DRAIN)
      state.shields = Math.min(100, state.shields + SHIELD_REGEN)

      // Sector progression
      state.sectorProgress += Math.hypot(state.velocity.x, state.velocity.y) * 0.001
      if (state.sectorProgress >= 1) {
        state.sectorProgress = 0
        state.sector++
        const { nebulae, seed } = generateSector(state.sector)
        state.nebulae = nebulae
        state.seed = seed
        emitParticles(state, state.ship.x, state.ship.y, 40, '#00ffc8', 6)
      }

      // Spawn
      if (Math.random() < COLLECTIBLE_SPAWN_RATE) spawnCollectible(state)
      if (Math.random() < ANOMALY_SPAWN_RATE && state.anomalies.filter(a => a.alive).length < 3) spawnAnomaly(state)
      if (Math.random() < ASTEROID_SPAWN_RATE && state.asteroids.length < 25) spawnAsteroid(state)

      // Update asteroids
      for (const ast of state.asteroids) {
        ast.x += ast.vx
        ast.y += ast.vy
        ast.rotation += ast.rotSpeed
      }

      // Update collectibles
      for (const col of state.collecting) col.pulse += 0.05

      // Update anomalies
      for (const anom of state.anomalies) anom.phase += 0.03

      // Update particles
      state.particlePool = state.particlePool.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.life -= 1
        return p.life > 0
      })

      // Update scanner pings
      state.scannerPings = state.scannerPings.filter(p => (t / 1000) - p.t < 3)

      // Auto-scan
      const scanTime = t / 1000
      if (scanTime - lastScanRef.current >= SCAN_INTERVAL) {
        lastScanRef.current = scanTime
        for (const col of state.collecting) {
          if (dist(state.ship, col) < 450) state.scannerPings.push({ x: col.x, y: col.y, t: scanTime })
        }
        for (const anom of state.anomalies) {
          if (dist(state.ship, anom) < 450) state.scannerPings.push({ x: anom.x, y: anom.y, t: scanTime })
        }
      }

      // Collect items
      for (const col of state.collecting) {
        if (!col.alive) continue
        if (dist(state.ship, col) < 25) {
          col.alive = false
          state.score += col.type === 'void-matter' ? 100 : 250
          state.energy = Math.min(100, state.energy + (col.type === 'void-matter' ? VOID_MATTER_ENERGY : ENERGY_NODE_ENERGY))
          emitParticles(state, col.x, col.y, 15, COLLECTIBLE_COLORS[col.type], 4)
          lastScanRef.current = scanTime - SCAN_INTERVAL + 0.5
        }
      }
      state.collecting = state.collecting.filter(c => c.alive)

      // Anomaly interaction
      for (const anom of state.anomalies) {
        if (!anom.alive) continue
        if (dist(state.ship, anom) < 30) {
          anom.alive = false
          state.score += 500
          emitParticles(state, anom.x, anom.y, 30, '#aa44ff', 8)
          state.sector += 3
          state.sectorProgress = 0
          const { nebulae, seed } = generateSector(state.sector)
          state.nebulae = nebulae
          state.seed = seed
          state.energy = Math.min(100, state.energy + 50)
        }
      }

      // Asteroid collision
      for (let i = state.asteroids.length - 1; i >= 0; i--) {
        const ast = state.asteroids[i]
        if (dist(state.ship, ast) < ast.size + 10) {
          state.shields -= ast.size * 0.8
          emitParticles(state, ast.x, ast.y, 10, '#667788', 3)
          state.asteroids.splice(i, 1)
          state.score = Math.max(0, state.score - 50)
          if (state.shields <= 0) {
            state.running = false
            emitParticles(state, state.ship.x, state.ship.y, 60, '#ff3355', 6)
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const initGame = makeInitGame()
    const update = makeUpdate(canvas)
    const state = initGame(canvas)
    stateRef.current = state

    let lastTime = performance.now()
    lastScanRef.current = 0

    const loop = (t: number) => {
      const dt = Math.min(t - lastTime, 50)
      lastTime = t

      update(state, dt, t)

      if (!state.running) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#ff3355'
        ctx.font = 'bold 48px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('VOID CLAIMED YOU', canvas.width / 2, canvas.height / 2 - 30)
        ctx.fillStyle = '#aaa'
        ctx.font = '18px monospace'
        ctx.fillText(`Final Score: ${state.score} | Sector: ${state.sector}`, canvas.width / 2, canvas.height / 2 + 10)
        ctx.fillStyle = '#00ffc8'
        ctx.fillText('Click to restart', canvas.width / 2, canvas.height / 2 + 50)
        ctx.textAlign = 'left'
        return
      }

      render(ctx, state, t)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    const onKeyDown = (e: KeyboardEvent) => {
      state.keys.add(e.key.toLowerCase())
      if (e.key === ' ') {
        e.preventDefault()
        if (state.running) state.paused = !state.paused
      }
    }
    const onKeyUp = (e: KeyboardEvent) => { state.keys.delete(e.key.toLowerCase()) }
    const onMouseMove = (e: MouseEvent) => {
      state.mouse.x = e.clientX
      state.mouse.y = e.clientY
    }
    const onClick = () => {
      if (!state.running) {
        const newState = initGame(canvas)
        stateRef.current = newState
        lastScanRef.current = 0
        lastTime = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    const onResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
    }
  }, [makeInitGame, makeUpdate, render])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  )
}
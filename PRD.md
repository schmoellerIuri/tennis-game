# Tennis Game — Product Requirements Document

## 1. Overview

A browser-based 3D arcade tennis game with a broadcast-style camera view from above and behind the court. Players control a character with 3D models on a full 3D court. The game launches as a single-player experience against AI opponents, with a clear path to real-time multiplayer in a later phase.

**Reference:** [Free Tennis](https://freetennis.org/) — a 3D tennis game with an above-court camera, arcade controls, and keyboard-driven gameplay.

## 2. Goals

- Deliver a fun, accessible 3D tennis game that runs in any modern browser
- Use a physics engine for realistic ball behavior, bouncing, and collision detection
- Low-poly arcade art style — visually appealing without requiring AAA assets
- Keep the architecture simple for phase 1 while ensuring multiplayer can be added without a rewrite
- Target desktop browsers with keyboard input

## 3. Non-Goals (Phase 1)

- Multiplayer networking
- User accounts, persistence, or leaderboards
- Mobile/touch support
- Photorealistic graphics or PBR materials
- Motion-captured animations

---

## 4. Game Design

### 4.1 Perspective & Camera

- **View:** 3D, positioned above and behind the player's baseline — similar to a TV broadcast angle
- **Camera behavior:** Semi-fixed — follows the ball laterally with gentle smoothing, slight zoom adjustments during serves and rallies
- **Default angle:** ~30-40 degrees from horizontal, looking down the length of the court
- **Alternative view (toggle):** Side-on broadcast view for variety
- **Resolution:** Responsive WebGL canvas that scales to fit the browser window while maintaining aspect ratio

### 4.2 Art Style

- **Low-poly arcade aesthetic** — stylized 3D models with flat or cel-shaded materials
- **3D Models (GLTF/GLB format):**
  - **Players:** Low-poly humanoid characters (~500-1500 triangles) with skeletal animations
  - **Racket:** Simple 3D racket model attached to the player's hand bone
  - **Ball:** Sphere with tennis ball texture/color (yellow-green)
- **Court:** 3D geometry with clay surface texture, white line markings, and surrounding area
- **Net:** Simple mesh with slight transparency/alpha for the net pattern
- **Color palette:** Clay orange court, white lines, distinct player outfit colors (e.g. player = blue, opponent = red)
- **Lighting:** Single directional light (sun) + ambient light, real-time shadows for players and ball
- **Particle effects:** Dust puffs on ball bounce (clay court), hit spark on racket contact

### 4.3 Player Animations

All animations are stored in the GLTF model and triggered by game state:

| Animation | Trigger |
|---|---|
| Idle | Default stance when not moving |
| Run | Moving to reach the ball |
| Forehand swing | Hitting a ball on the dominant side |
| Backhand swing | Hitting a ball on the non-dominant side |
| Serve toss + hit | During serve sequence |
| Celebration | Winning a point |
| Ready position | Awaiting serve |

### 4.4 Mechanics (Arcade / Simplified)

- **Movement:** Player moves along their half of the court using keyboard (WASD or arrow keys). Movement is 3D but constrained to the ground plane.
- **Shots:** Single-button shot system
  - **Space bar:** Swing the racket. Press space when the ball is in range to hit it back.
  - **Shot direction:** Determined by player position relative to center court + movement direction at time of swing. Moving left while hitting aims the ball left, standing still aims roughly toward the center of the opponent's court.
  - **Shot type:** Automatically chosen based on timing and distance — early/close hits produce flat shots, late/far hits produce lobs. This keeps controls simple while still creating variety.
- **Ball physics (Rapier3D):**
  - Gravity, bounce restitution based on court surface
  - Ball-court collision for bounce detection and out-of-bounds
  - Ball-net collision for net faults and let calls
  - Ball-racket collision zone (simplified — triggered when player is in range and presses space)
- **Serving:**
  - Space bar starts the toss, press space again to hit — timing determines serve quality
  - Direction influenced by holding a movement key (left/right) during the toss
- **Scoring:** Standard tennis scoring (15-30-40-deuce-advantage), configurable match length (1 set, 3 sets, etc.)
- **Court boundaries:** Ball landing outside lines = out (physics-based detection using court boundary colliders)

### 4.5 AI Opponent

- **Difficulty levels:** Easy, Medium, Hard
- Easy: slow reaction, random shot placement, frequent mistiming
- Medium: moderate tracking, targets open court sometimes, decent timing
- Hard: fast reaction, strategic placement, rarely mistimes, adapts to player patterns
- AI decision-making: simple state machine (idle → move to ball → position for swing → swing → return to ready position)
- AI difficulty affects: movement speed, reaction delay, shot accuracy, shot selection intelligence

### 4.6 Game Flow

1. **Main Menu** — Start match, select difficulty, settings
2. **Match** — Gameplay with 3D HUD overlay (score, set, game)
3. **Point Transition** — Brief pause between points, camera may show replay angle
4. **Changeover** — Players switch sides every 2 games (visual transition)
5. **Match End** — Results screen with stats (aces, winners, unforced errors, rallies)
6. **Return to Menu**

---

## 5. Technical Architecture

### 5.1 Frontend Stack

| Component | Technology |
|---|---|
| Language | TypeScript |
| 3D Engine | Three.js |
| Physics | Rapier3D (`@dimforge/rapier3d-compat`) |
| Model format | GLTF / GLB |
| Build tool | Vite |
| Package manager | npm |

**Why Three.js + Rapier3D:**
- Three.js is the most widely used WebGL library with the largest ecosystem, extensive documentation, and community support
- Rapier3D is a high-performance physics engine written in Rust, compiled to WASM — fast enough for real-time game physics in the browser
- `@dimforge/rapier3d-compat` provides a clean JS API with no async WASM initialization hassles
- GLTF model loading is first-class in Three.js via `GLTFLoader`
- Skeletal animation support via Three.js `AnimationMixer`

### 5.2 Project Structure

```
tennis-game/
├── src/
│   ├── main.ts                # Entry point, game bootstrap
│   ├── core/
│   │   ├── Game.ts            # Main game loop, state management
│   │   ├── SceneManager.ts    # Three.js scene, renderer, camera setup
│   │   └── PhysicsWorld.ts    # Rapier3D world initialization and step
│   ├── entities/
│   │   ├── Player.ts          # Player entity: model, animations, movement
│   │   ├── Ball.ts            # Ball entity: model, physics body, trail
│   │   ├── Court.ts           # Court geometry, textures, line markings
│   │   ├── Net.ts             # Net mesh and collider
│   │   └── Racket.ts          # Racket model, attached to player hand
│   ├── systems/
│   │   ├── PhysicsSystem.ts   # Sync Rapier bodies ↔ Three.js meshes
│   │   ├── AnimationSystem.ts # Manage skeletal animations and transitions
│   │   ├── ShotSystem.ts      # Shot mechanics: type, direction, power calc
│   │   ├── ServeSystem.ts     # Serve sequence: toss, timing, execution
│   │   ├── ScoringSystem.ts   # Tennis scoring rules, match state
│   │   └── CameraSystem.ts    # Camera follow, smoothing, transitions
│   ├── ai/
│   │   └── AIController.ts    # AI opponent: state machine, difficulty
│   ├── input/
│   │   └── InputManager.ts    # Keyboard input handling, command abstraction
│   ├── ui/
│   │   ├── HUD.ts             # In-game score overlay (HTML/CSS or canvas)
│   │   ├── MenuScreen.ts      # Main menu UI
│   │   └── ResultScreen.ts    # Post-match results UI
│   ├── utils/
│   │   └── Constants.ts       # Game constants (court dims, physics params, etc.)
│   ├── assets/
│   │   └── AssetLoader.ts     # Centralized GLTF/texture loading with progress
│   └── types/
│       └── index.ts           # Shared TypeScript types and interfaces
├── public/
│   ├── index.html
│   └── models/                # GLTF/GLB model files
│       ├── player.glb
│       ├── racket.glb
│       └── ball.glb
├── package.json
├── tsconfig.json
├── vite.config.ts
└── PRD.md
```

### 5.3 Game Loop

- **Fixed timestep** physics and game logic at 60 ticks/second (16.67ms)
- **Variable framerate** rendering via `requestAnimationFrame`
- Each frame: accumulate delta time → run fixed-step updates → interpolate for render → render scene
- Rapier3D `world.step()` called at fixed rate for deterministic physics
- Three.js `AnimationMixer.update(delta)` for smooth skeletal animations
- Separation of game logic (systems) from rendering to prepare for deterministic multiplayer later

### 5.4 Physics Setup (Rapier3D)

- **Gravity:** `{ x: 0, y: -9.81, z: 0 }`
- **Ball:** Dynamic rigid body (sphere collider, ~0.033m radius), with restitution ~0.75 for realistic bounce
- **Court ground:** Fixed rigid body (box collider), positioned at y=0
- **Net:** Fixed rigid body (thin box collider), centered at the net line
- **Court boundaries:** Sensor colliders (invisible) placed at the court lines — trigger events when the ball crosses out of bounds
- **Racket hit zone:** Not a continuous physics collider — instead, a proximity check: when the ball is within striking distance and the player swings, apply an impulse to the ball based on shot type and aim direction
- **Collision events:** Rapier's event system detects ball-court, ball-net, and ball-out-of-bounds contacts

### 5.5 3D Model Pipeline

- Models created in Blender (or sourced from free low-poly asset packs)
- Exported as `.glb` (binary GLTF) for compact file size
- Player model includes armature with bone names matching animation clips
- Animations can be embedded in the GLB or loaded separately
- Three.js `GLTFLoader` handles loading; `AnimationMixer` handles playback
- Racket attached to the player's hand bone via `bone.add(racketMesh)`

### 5.6 Key Design Decisions for Multiplayer Readiness

Even though phase 1 is single-player, the architecture should support multiplayer later:

- **Deterministic game logic:** Game state updates are pure functions of inputs + current state. Rapier3D is deterministic given the same inputs.
- **Input abstraction:** `InputManager` produces input commands (move direction, shot type) — AI and human players both produce the same command format
- **State serialization:** Game state (positions, velocities, ball state, score) is serializable to JSON for future network sync
- **No render-coupled logic:** Game rules never depend on rendering state — physics and scoring run independently of Three.js

---

## 6. Phase 2 — Multiplayer (Future)

### 6.1 Backend Stack

| Component | Technology |
|---|---|
| Language | Kotlin |
| Framework | Ktor |
| Protocol | WebSocket |
| Hosting | AWS EC2 or ECS (containerized) |

### 6.2 Networking Model

- **Authoritative server:** Server runs the game simulation, clients send inputs, server broadcasts state
- **Client-side prediction:** Client predicts local player movement immediately, reconciles with server state
- **Input delay:** ~2-3 frames of input buffer to smooth network jitter
- **Tick rate:** Server runs at 60Hz, sends state updates at 20Hz (every 3rd tick) to reduce bandwidth
- **Protocol:** Binary WebSocket frames (not JSON) for compact state serialization

### 6.3 Matchmaking

- Simple queue-based: player joins queue → server pairs two players → creates game room
- No rating system initially — random matching
- Room-based architecture: each match is an isolated game room on the server

### 6.4 Scaling Strategy (< 100 CCU)

At small scale, a single EC2 instance handles everything:

- **Single server:** One Ktor instance handles WebSocket connections, matchmaking, and game rooms
- **Vertical scaling first:** Upgrade instance size before distributing
- **Container-ready:** Dockerized from day one so migration to ECS/Fargate is trivial
- **If growth demands it:**
  - Sticky sessions via ALB for WebSocket affinity
  - Separate matchmaking service from game servers
  - Regional game servers to reduce latency

### 6.5 Infrastructure

- **Frontend:** Cloudflare Pages (global CDN, auto-deploy from Git, free tier)
- **Backend:** AWS EC2 (t3.small to start) or ECS Fargate for container orchestration
- **CI/CD:** GitHub Actions for both frontend and backend pipelines
- **Monitoring:** CloudWatch for server metrics, simple health check endpoint

---

## 7. Performance Targets

| Metric | Target |
|---|---|
| Client FPS | 60 fps on integrated GPU (low-poly scene) |
| Bundle size | < 2MB gzipped (incl. Three.js + Rapier WASM + models) |
| Model budget | < 5K triangles per character, < 20K total scene |
| Time to interactive | < 4 seconds on 4G (WASM + model loading) |
| Input latency (local) | < 16ms (1 frame) |
| Network latency (phase 2) | Playable up to 150ms RTT |

---

## 8. Development Phases

### Phase 1 — Single-Player MVP

1. Project setup (Vite + TypeScript + Three.js + Rapier3D)
2. 3D court rendering with camera system
3. Physics world setup (ground, net, boundaries)
4. Player 3D model loading and basic movement
5. Ball physics (serve, rally, bounce, out-of-bounds)
6. Shot system (flat, topspin, lob) with keyboard controls
7. Basic AI opponent
8. Scoring system and match flow
9. HUD and menu screens
10. Animations and visual polish (dust particles, shadows, camera smoothing)
11. Deploy to Cloudflare Pages

### Phase 2 — Multiplayer

1. Kotlin/Ktor WebSocket server
2. Shared game logic (deterministic simulation)
3. Client-server state sync with prediction
4. Matchmaking queue
5. Dockerize and deploy to AWS
6. Lobby UI and connection flow

### Phase 3 — Growth (if needed)

1. Player accounts and persistence (PostgreSQL)
2. Leaderboards and rankings
3. Tournament mode
4. Spectator mode
5. Mobile touch controls
6. Regional server distribution
7. Additional court surfaces (grass, hard) with visual and physics differences
8. Character customization (outfits, rackets)

---

## 9. Resolved Questions

- **AI difficulty vs serve speed:** AI difficulty affects positioning and strategy only, not serve speed
- **Sound effects:** Add as polish later, not in initial MVP
- **Court surface:** Clay court only for MVP
- **Player animations:** Full skeletal animations via GLTF (idle, run, forehand, backhand, serve)
- **Camera style:** Broadcast-style above-and-behind view (like Free Tennis / TV coverage)
- **Controls:** Keyboard-only — WASD to move, space bar to swing. Shot direction derived from player position and movement

## 10. Open Questions

- What free/open-source low-poly character models should we use, or should we create custom ones in Blender?
- Should the timing indicator for shots/serves be a visual element (e.g. a circle that shrinks) or purely feel-based?
- Do we want ball trails / motion blur for visual feedback on fast shots?
- Should changeovers (switching sides) be animated or a quick cut?

claude --resume 937b4437-f3c4-4a65-9dfd-aea068c4f658
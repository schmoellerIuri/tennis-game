# Tennis Game — Product Requirements Document

## 1. Overview

A browser-based 2.5D isometric tennis game with arcade-style mechanics and flat/vector art. The game launches as a single-player experience against AI opponents, with a clear path to real-time multiplayer in a later phase.

## 2. Goals

- Deliver a fun, accessible tennis game that runs in any modern browser
- Keep the architecture simple for phase 1 while ensuring multiplayer can be added without a rewrite
- Target desktop browsers with keyboard + mouse input

## 3. Non-Goals (Phase 1)

- Multiplayer networking
- User accounts, persistence, or leaderboards
- Mobile/touch support
- Realistic physics simulation

---

## 4. Game Design

### 4.1 Perspective & Camera

- **View:** 2.5D isometric, fixed camera showing the entire court
- **No camera movement** — the full court is always visible
- **Resolution:** Responsive canvas that scales to fit the browser window while maintaining aspect ratio

### 4.2 Art Style

- **Flat/vector aesthetic** — clean geometric shapes, minimal detail
- Court, players, ball, and net rendered programmatically (no external sprite assets required)
- Color palette: grass green court, white lines, distinct player colors
- Shadows and depth cues to sell the isometric perspective

### 4.3 Mechanics (Arcade / Simplified)

- **Movement:** Player moves along their half of the court using keyboard (WASD or arrow keys)
- **Shots:** Mouse controls aim direction and shot type
  - Left click: normal shot (direction follows mouse position relative to player)
  - Right click: lob shot (higher arc, slower)
  - Hold duration or mouse distance from player determines power
- **Ball physics:** Simple parabolic trajectories, no spin or wind
- **Serving:** Automated toss, player controls direction and power
- **Scoring:** Standard tennis scoring (15-30-40-deuce-advantage), configurable match length (1 set, 3 sets, etc.)
- **Court boundaries:** Ball landing outside lines = out, net hits = let/fault

### 4.4 AI Opponent

- **Difficulty levels:** Easy, Medium, Hard
- Easy: slow reaction, random shot placement
- Medium: moderate tracking, targets open court sometimes
- Hard: fast reaction, strategic placement, adapts to player patterns
- AI decision-making: simple state machine (idle → move to ball → swing → return to position)

### 4.5 Game Flow

1. **Main Menu** — Start match, select difficulty, settings
2. **Match** — Gameplay with score overlay
3. **Point Transition** — Brief pause between points showing score
4. **Match End** — Results screen with stats (aces, winners, errors)
5. **Return to Menu**

---

## 5. Technical Architecture

### 5.1 Frontend Stack

| Component | Technology |
|---|---|
| Language | TypeScript |
| Renderer | PixiJS (WebGL-accelerated 2D) |
| Build tool | Vite |
| Package manager | npm |

### 5.2 Project Structure

```
tennis-game/
├── src/
│   ├── main.ts              # Entry point, game bootstrap
│   ├── game/
│   │   ├── Game.ts           # Main game loop, state management
│   │   ├── Court.ts          # Court rendering (isometric projection)
│   │   ├── Player.ts         # Player entity, movement, animations
│   │   ├── Ball.ts           # Ball entity, trajectory, physics
│   │   ├── Net.ts            # Net rendering
│   │   └── Score.ts          # Scoring logic and display
│   ├── ai/
│   │   └── AIController.ts   # AI opponent logic
│   ├── input/
│   │   └── InputManager.ts   # Keyboard + mouse input handling
│   ├── physics/
│   │   └── Physics.ts        # Ball trajectories, collision detection
│   ├── scenes/
│   │   ├── MenuScene.ts      # Main menu
│   │   ├── MatchScene.ts     # Gameplay scene
│   │   └── ResultScene.ts    # Post-match results
│   ├── utils/
│   │   ├── IsometricUtils.ts # 2D ↔ isometric coordinate transforms
│   │   └── Constants.ts      # Game constants (court dimensions, speeds, etc.)
│   └── types/
│       └── index.ts          # Shared TypeScript types
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── PRD.md
```

### 5.3 Game Loop

- **Fixed timestep** game logic at 60 ticks/second (16.67ms)
- **Variable framerate** rendering via `requestAnimationFrame`
- Separation of update logic and render logic to prepare for deterministic multiplayer later
- PixiJS `Ticker` for render loop, custom accumulator for fixed-step updates

### 5.4 Isometric Projection

- Game logic operates in 2D world coordinates (top-down court)
- Isometric transform applied at render time only
- Transform: `screenX = (worldX - worldY) * tileWidth / 2` and `screenY = (worldX + worldY) * tileHeight / 2`
- Mouse input reverse-transformed from screen → world coordinates for aiming

### 5.5 Key Design Decisions for Multiplayer Readiness

Even though phase 1 is single-player, the architecture should support multiplayer later:

- **Deterministic game logic:** Game state updates are pure functions of inputs + current state
- **Input abstraction:** `InputManager` produces input commands (move direction, shot type, aim angle) — AI and human players both produce the same command format
- **State serialization:** Game state (positions, ball trajectory, score) is serializable to JSON for future network sync
- **No render-coupled logic:** Game rules never depend on rendering state

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
| Client FPS | 60 fps on integrated GPU |
| Bundle size | < 500KB gzipped (incl. PixiJS) |
| Time to interactive | < 2 seconds on 4G |
| Input latency (local) | < 16ms (1 frame) |
| Network latency (phase 2) | Playable up to 150ms RTT |

---

## 8. Development Phases

### Phase 1 — Single-Player MVP

1. Project setup (Vite + TypeScript + PixiJS)
2. Isometric court rendering
3. Player movement and input handling
4. Ball physics and trajectory system
5. Basic AI opponent
6. Scoring system and match flow
7. Menu and results screens
8. Polish: animations, sound effects, visual feedback
9. Deploy to Cloudflare Pages

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

---

## 9. Open Questions

- Should the AI difficulty also affect serve speed, or only positioning/strategy? - Only Position and strategy
- Do we want sound effects from day one, or add them as polish later? Add them as polish later
- Should the court surface be configurable (grass/clay/hard) with visual-only differences, or skip that for MVP? Only clay for now
- What's the minimum viable animation for player characters? (simple shape rotation vs. multi-frame sprites) multi-frame sprites

# JARVIS 3D — Complete Feature Specification

> Every feature, how it works, what it does, how to use it.
> Iron Man Holographic Table Level Interactive 3D Platform.

---

## Table of Contents

1. [Face Scan & Identity](#1-face-scan--identity)
2. [3D Holographic Background](#2-3d-holographic-background)
3. [Floating Navigation](#3-floating-navigation)
4. [Project Grid (Home)](#4-project-grid-home)
5. [Interactive 3D Exploder](#5-interactive-3d-exploder)
6. [Part Drill-Down System](#6-part-drill-down-system)
7. [Explode / Assemble Animation](#7-explode--assemble-animation)
8. [X-Ray Mode](#8-x-ray-mode)
9. [Hover & Selection Effects](#9-hover--selection-effects)
10. [Mouse Controls](#10-mouse-controls)
11. [Gesture Controls](#11-gesture-controls)
12. [Search System](#12-search-system)
13. [AI Assistant (JARVIS)](#13-ai-assistant-jarvis)
14. [P2P Collaboration Room](#14-p2p-collaboration-room)
15. [3D Model Upload](#15-3d-model-upload)
16. [Annotations System](#16-annotations-system)
17. [Sound Engine](#17-sound-engine)
18. [Keyboard Shortcuts](#18-keyboard-shortcuts)
19. [Status HUD](#19-status-hud)
20. [Data Storage & Privacy](#20-data-storage--privacy)
21. [9 Built-in Projects](#21-9-built-in-projects)
22. [Screenshot System](#22-screenshot-system)
23. [Saved Views](#23-saved-views)
24. [Favorites](#24-favorites)
25. [Guided Tour](#25-guided-tour)
26. [Assembly Animation Timeline](#26-assembly-animation-timeline)
27. [Mobile Touch Gestures](#27-mobile-touch-gestures)
28. [Achievements](#28-achievements)
29. [Voice Commands](#29-voice-commands)
30. [Stress Test Visualization](#30-stress-test-visualization)
31. [Real-Time 3D State Sync](#31-real-time-3d-state-sync)
32. [Theme Engine](#32-theme-engine)
33. [PWA (Offline Support)](#33-pwa-offline-support)
34. [Compare Mode](#34-compare-mode)
35. [Annotation Export](#35-annotation-export)
36. [Share Link](#36-share-link)
37. [Plugin System](#37-plugin-system)
38. [Measurement Tool](#38-measurement-tool)
22. [Architecture](#22-architecture)

---

## 1. Face Scan & Identity

**What:** On first visit, the site asks for camera access and scans your face using face-api.js (TinyFaceDetector + 68-point landmark model).

**How it works:**
1. Loading screen shows with a pulsing ring animation
2. Camera feed appears inside the ring (mirrored)
3. Face detection runs up to 40 attempts (10 seconds)
4. 68 facial landmarks are extracted → converted to 128-value embedding vector
5. Embedding is compared against all stored faces using cosine similarity
6. If similarity > 0.85 → recognized as returning user → shows "Welcome back, [ID]"
7. If no match → new UUID generated → stored in IndexedDB
8. Camera stops → transitions to main interface with 1-second fade

**Skip option:** "Skip Scan" button enters as guest (HUD shows "ANONYMOUS")

**Privacy:**
- Raw camera frames are NOT saved
- Only the 128-number embedding vector is stored
- Everything stays in browser IndexedDB
- Nothing is sent to any server

**Fallback:** If camera denied → guest mode. If models fail to load → guest mode.

---

## 2. 3D Holographic Background

**What:** A persistent 3D scene rendered behind all UI elements.

**Elements:**
- **Grid floor:** 40×40 grid of cyan lines at y=-2, pulses opacity
- **Particles:** 1,200 floating cyan dots with additive blending, rise upward and reset
- **Concentric rings:** 5 rings at y=-1.9, subtle glow
- **Scanlines:** CSS overlay with repeating gradient (CRT effect)
- **Camera sway:** Gentle sinusoidal movement on x and y axes

**Technical:**
- Three.js r128 WebGL renderer
- PerspectiveCamera at (0, 8, 12) looking at origin
- Ambient light (cyan tint) + directional light
- `requestAnimationFrame` loop at 60fps
- Pixel ratio capped at 2x for performance

---

## 3. Floating Navigation

**What:** 5 draggable buttons on the right side of the screen.

**Buttons:**
| Button | Section | Icon |
|--------|---------|------|
| HOME | Project Grid | 🏠 |
| API | AI Configuration | 🔌 |
| ROOM | P2P Video Chat | 🚪 |
| GESTURE | Hand Tracking | 🤌 |
| UPLOAD | Import GLB Models | 📤 |

**Behavior:**
- Can be dragged anywhere on screen (mouse or touch)
- Position saves to IndexedDB → persists across sessions
- Active button gets cyan border + glow
- Hover sound plays on mouse enter
- Click sound plays on activation
- `backdrop-filter: blur(10px)` for frosted glass look

---

## 4. Project Grid (Home)

**What:** 3×3 grid of project cards showing all 9 built-in projects + user uploads.

**Each card shows:**
- Mini 3D rotating preview (all parts arranged compactly)
- Project name with icon
- Part count + description
- Badge: "BUILT-IN" (green) or "UPLOADED" (orange)
- Delete button (✕) appears on hover for uploaded projects

**Interaction:**
- Click card → opens Interactive 3D Exploder
- Hover → card lifts with `translateY(-4px)` + glow border + hover sound
- Cards use spring transition (`cubic-bezier(0.34, 1.56, 0.64, 1)`)

**3D Preview:**
- Each card has its own WebGL canvas
- Renders all parts in compact arrangement
- Slowly rotates (0.008 rad/frame)
- Auto-scales to fit 2.5 units
- Animations stop when leaving home (GPU conservation)

---

## 5. Interactive 3D Exploder

**What:** The main feature — a complete 3D model rendered in a canvas where every part is individually clickable.

**When you click a project card:**
1. Card preview animations stop
2. Exploder view appears with the assembled 3D model
3. Model slowly auto-rotates
4. All parts are individually selectable via raycasting

**Layout:**
```
[← Back] [Breadcrumb: Project ▸ Part ▸ Sub-part]

[Left Panel]     [3D Canvas + Controls]     [Right Panel]
 Part List        💥 Explode 🔄 Reset 👁️ X-Ray    Part List
 Grouped by       Hint text below canvas
 category         Part name + description
                  Annotation UI
```

**Controls row below canvas:**
- 💥 Explode / 🔧 Assemble — toggle explosion animation
- 🔄 Reset — return to assembled + default camera
- 👁️ X-Ray — wireframe see-through mode

---

## 6. Part Drill-Down System

**What:** Click any part to see its internal sub-components. Go 4-5 levels deep.

**How it works:**
1. User sees assembled model with all top-level parts
2. Hover on a part → part highlights (glow + scale up 4%)
3. Tooltip appears: part name + description + sub-part count
4. Click on part with sub-parts → **drill down**
5. Camera smoothly transitions to show sub-parts
6. Side panels update to show sub-part list
7. Breadcrumb updates: `▸ Part Name`
8. Repeat — sub-parts may have their own sub-parts

**Navigation:**
- **Back button:** Goes up one level in the hierarchy
- **Breadcrumb:** Shows current drill path
- **Side panel click:** Directly jump to any part

**Depth examples (Falcon Rocket):**
```
Level 0: Nose Cone, Payload Bay, 2nd Stage, Interstage, 1st Stage, Engines, Legs, Grid Fins, Fuel Tanks
Level 1: Nose → [Telemetry Antenna, Fairing Half L, Fairing Half R, Vent Valve]
Level 2: Fairing Half L → [Thermal Blanket, Clamp Band Half]
Level 3: Thermal Blanket → [MLI Layer 1, MLI Layer 2]
Level 4: Clamp Band → [Separation Bolt]
Level 5: Separation Bolt → [Detonator, Nut & Washer]
```

**Smooth transitions:**
- Camera position lerps to target (no instant jumps)
- Rotation resets smoothly
- Old model fades out, new model fades in
- Explode state resets on drill

---

## 7. Explode / Assemble Animation

**What:** Parts smoothly fly outward from center, revealing internal structure.

**Animation details:**
- Each part calculates a random direction vector away from center
- Random distance multiplier: 1.2× to 2.0×
- Easing function: ease-in-out quadratic (`t < 0.5 ? 2t² : -1+(4-2t)t`)
- Progress tracked as 0→1 float, animated per-frame (+0.02 per frame)
- Camera shake on trigger (intensity 0.15, decays 0.9× per frame)

**Trigger methods:**
1. Click 💥 Explode button
2. 🤘 Rock gesture while in exploder view
3. Custom gesture mapped to "3D: Explode/Assemble"

**Assemble (reverse):**
- Parts lerp back to original positions
- Same easing, same speed
- Camera shake on assemble too
- Button text changes: 💥 Explode ↔ 🔧 Assemble

---

## 8. X-Ray Mode

**What:** Makes all parts wireframe + transparent so you can see through outer parts to inner components.

**How it works:**
1. Click 👁️ X-Ray button (toggles active state with green glow)
2. All meshes switch to `wireframe: true`, `opacity: 0.25`
3. Hint text changes: "X-Ray: wireframe mode — click parts to inspect"
4. Click again → restores original materials (opacity, wireframe off)

**Use cases:**
- See how parts fit inside each other
- Understand internal structure without drilling down
- Find specific sub-components visually

---

## 9. Hover & Selection Effects

**Hover (on any part):**
- Emissive intensity increases to 0.25 (brighter glow)
- Part scales up to 1.04× (smooth lerp, 15% per frame)
- Cursor changes to pointer
- Tooltip follows mouse: name + description + sub-part count
- Hint text updates with part name

**Selection (click on leaf part):**
- Emissive intensity jumps to 0.5 (strong glow)
- Part scales up to 1.08×
- Part name + description shown in detail panel
- Annotation UI appears below description

**Unhover/Unselect:**
- Smooth scale-down back to 1.0×
- Emissive returns to 0.05 (default)
- All transitions are lerped (no instant jumps)

---

## 10. Mouse Controls

**In the 3D canvas:**

| Action | Input | Effect |
|--------|-------|--------|
| Rotate | Click + drag | Rotates model on X and Y axes |
| Zoom in | Scroll wheel up | Camera moves closer (min 2 units) |
| Zoom out | Scroll wheel down | Camera moves farther (max 15 units) |
| Hover | Move mouse | Part highlights, tooltip appears |
| Select | Click | Drill into part OR select leaf part |
| Auto-rotate | No interaction | Model slowly spins (0.002 rad/frame) |

**Rotation limits:**
- X rotation clamped to ±π/2 (can't flip upside down)
- Y rotation wraps freely (full 360°)

**Auto-rotation behavior:**
- Starts immediately when entering exploder
- Slows during/after drag interaction
- Speed controlled by `exploderAutoRotateSpeed`
- Can be paused via ✌️ peace gesture

---

## 11. Gesture Controls

**Prerequisites:** Enable camera in Gesture section first.

### Built-in Gesture → 3D Mapping

| Gesture | 3D Action | When Active |
|---------|-----------|-------------|
| ✋ Swipe left/right | Rotate model Y-axis | Always in exploder |
| ✋ Swipe up/down | Rotate model X-axis | Always in exploder |
| ☝️ Point (index) | Hover/select part via finger raycast | Always in exploder |
| ✊ Fist | Drill down into pointed part (or go back) | Always in exploder |
| 🖐️ Open Palm | Reset view (camera + rotation + go to root) | Always in exploder |
| 🤏 Pinch | Zoom in continuously | Always in exploder |
| 👍 Thumbs Up | Zoom in | Always in exploder |
| 👎 Thumbs Down | Zoom out | Always in exploder |
| ✌️ Peace | Toggle auto-rotate on/off | Always in exploder |
| 🤘 Rock | Explode/Assemble toggle | Always in exploder |

### Gesture Recognition (MediaPipe Hands)

**How it works:**
1. MediaPipe Hands loads from CDN (21-landmark model)
2. Camera feed sent to Hands model at 60fps
3. 21 landmarks per hand detected
4. Finger extension calculated by comparing tip vs PIP joint positions
5. Gesture classified based on which fingers are extended
6. Callback fires with gesture type + raw landmarks

**Recognized gestures (code level):**
- `fist` — no fingers extended
- `open_palm` — all 4 fingers extended
- `point` — only index extended
- `peace` — index + middle extended
- `three` — index + middle + ring extended
- `thumbs_up` — thumb above wrist, others closed
- `thumbs_down` — thumb below wrist, others closed
- `pinch` — thumb tip close to index tip (<0.05 normalized)
- `ok_sign` — pinch + other 3 fingers extended
- `rock` — index + pinky extended
- `swipe_left/right/up/down` — wrist at screen edge

### Finger Pointing (Raycast)

When user points (index finger extended):
1. Index tip landmark (landmark 8) position extracted (0-1 normalized)
2. X is mirrored (camera is mirrored)
3. Mapped to canvas screen coordinates
4. Raycaster fires from camera through that screen point
5. Intersects with all meshes in current model
6. First hit gets highlighted
7. Hint shows: "☝️ Pointing at: [Part Name]"

### Custom Gesture Recording

1. Click "+ Record New Gesture"
2. Enter name, select action from dropdown
3. Click "Start Recording"
4. Hold gesture for 2 seconds (60 frames captured)
5. Template saved to IndexedDB
6. Future matches trigger the assigned action

**Template comparison:** DTW-inspired — averages frames to single 21-point frame, normalizes to wrist, calculates landmark distance, converts to similarity score (0-1). Threshold: 0.7.

**Custom actions available:**
- Navigate: Home, API, Room, Upload
- Scroll: Up, Down
- Zoom: In, Out
- 3D: Rotate Left, Rotate Right, Reset View, Explode/Assemble

---

## 12. Search System

**Trigger:** `Ctrl+K` or `/` key or 🔍 button

**Search overlay:**
- Dark semi-transparent backdrop with blur
- Search input with cyan styling
- Results list with keyboard navigation

**What it searches:**
- **Projects:** Name + description match
- **Parts:** Name + description + group match (across all projects)
- **Actions:** Navigation shortcuts

**Result types:**
| Type | Icon | Action |
|------|------|--------|
| Project | Project icon | Opens exploder for that project |
| Part | 🔩 | Opens exploder → drills to that part |
| Action | Section icon | Navigates to that section |

**Keyboard navigation:**
- `↑` / `↓` — navigate results
- `Enter` — select focused result
- `Escape` — close search

**Highlighting:** Matching text gets cyan highlight in results.

---

## 13. AI Assistant (JARVIS)

**What:** Floating 🤖 chat bubble that connects to OpenAI, Anthropic, or Google Gemini.

**Setup:**
1. Click 🤖 bubble (bottom-right)
2. Enter API key + select provider
3. Click Connect

**Context awareness (sent with every message):**
```json
{
  "currentSection": "home",
  "selectedProject": "FALCON ROCKET",
  "selectedPart": "Engine Bells",
  "confusionScore": 45,
  "recentActions": ["project_open: FALCON ROCKET", "part_click: Engine Bells"],
  "totalProjects": 9
}
```

**Confusion detection:**
- Same part clicked 3+ times in 10 seconds → score +30
- 8+ clicks in 3 seconds → score +20
- Score decays -10 every 30 seconds
- If score > 50, AI proactively offers help

**Personality:** Calm, confident, slightly witty — like Tony Stark's JARVIS. References exact part names and context.

**Security:**
- API key stored ONLY in JavaScript variable (RAM)
- Never saved to IndexedDB, localStorage, or cookies
- Tab close = key gone forever
- Key never sent to our servers (direct to provider)

**Providers:**
- OpenAI: gpt-4o-mini
- Anthropic: claude-3-5-haiku
- Google: gemini-2.0-flash

**Can also be configured from:** API section (🔌 in nav)

---

## 14. P2P Collaboration Room

**What:** Peer-to-peer video + text chat room for two people.

**Setup:**
1. Click 🚪 Room in nav
2. **Create Room:** Set password → get 8-char room code
3. **Join Room:** Enter code + password

**Technical:**
- Uses PeerJS free cloud signaling server (initial handshake only)
- WebRTC for direct peer-to-peer video + data
- Video never touches any server after connection

**Features:**
- Live video chat (2 streams: local + remote)
- Text chat alongside video (WebRTC data channel)
- Room code + password displayed (password masked)
- Leave button tears down connection + stops camera

**Limitations:**
- 2 people max per room
- No shared 3D state (future feature)
- PeerJS free tier: 1 concurrent connection

---

## 15. 3D Model Upload

**What:** Import your own .glb 3D models into the platform.

**How it works:**
1. Click 📤 Upload in nav
2. Drop .glb file or click to browse
3. Model is parsed with THREE.GLTFLoader
4. Centered and scaled to fit preview
5. Every mesh extracted as a selectable part
6. Each mesh gets: name (from mesh name), color (from material), group (parent name)
7. If >50 parts → auto-grouping engine kicks in
8. Preview shows rotating model
9. Parts list shows all extracted components
10. Click "Add to Projects" → appears on Home grid with "UPLOADED" badge

**Auto-grouping algorithm:**
- Groups by parent hierarchy first
- Then sub-groups by name patterns:
  - body/frame/chassis/shell/hull → "Body"
  - engine/motor/piston/cylinder → "Mechanical"
  - wheel/tire/rim/axle/brake → "Wheels & Suspension"
  - wire/cable/sensor/board/chip → "Electronics"
  - wing/spoiler/fin/flap → "Aerodynamics"
  - thruster/nozzle/prop/rotor → "Propulsion"
  - gun/cannon/missile/turret → "Weaponry"
  - camera/lens/radar/sonar → "Sensors & Optics"
  - glass/window/windshield → "Glass"
- Groups with >5 parts become expandable entries
- Groups with ≤5 parts remain individual

**Storage:** Uploaded models saved to IndexedDB with full GLB binary buffer. Persists across sessions.

**Delete:** Hover on uploaded card → ✕ button appears → confirm → removed from IndexedDB.

**Supported format:** .glb only (binary glTF — most efficient web 3D format)

---

## 16. Annotations System

**What:** Add personal notes to any part for later reference.

**How it works:**
1. In exploder view, select any part
2. Below part description, see 📌 "Add Note" (or 📝 "View Note" if exists)
3. Click to expand textarea
4. Write notes, click Save
5. Notes persist in IndexedDB
6. 📌 changes to 📝 when note exists
7. Delete button removes annotation

**Storage:** `{ id: partId, text: "note content", created: timestamp }` in IndexedDB `annotations` store.

---

## 17. Sound Engine

**What:** Procedural sci-fi UI sounds generated with Web Audio API. No audio files needed.

**All sounds are generated in real-time using oscillators + noise buffers:**

| Sound | Trigger | Technique |
|-------|---------|-----------|
| Click | Button press | Sine blip 1200→800Hz, 80ms |
| Hover | Mouse enter | Sine tick 2000Hz, 30ms |
| Navigate | Section change | Triple ascending sine (600/800/1000Hz) |
| Explode | Part open/explode | Noise buffer + bandpass filter sweep |
| Success | Save/confirm | C-E-G major chord (523/659/784Hz) |
| Error | Error state | Square wave descending 200→150Hz |
| Ambient | Background | Sawtooth 55Hz + lowpass 200Hz (continuous) |
| Scan | Face scan complete | Sine sweep 400→1600→400Hz |

**Toggle:** Press `M` or click 🔊 button. Master gain set to 0 (muted) or 0.3.

**Initialization:** Requires first user click (browser autoplay policy).

---

## 18. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Navigate to Home |
| `2` | Navigate to API |
| `3` | Navigate to Room |
| `4` | Navigate to Gesture |
| `5` | Navigate to Upload |
| `Ctrl+K` | Open Search |
| `/` | Open Search |
| `Escape` | Close search → Close AI panel → Back from exploder |
| `M` | Toggle Sound on/off |
| `↑` `↓` | Navigate search results |

---

## 19. Status HUD

**What:** Bottom-left corner shows system status.

| Field | Value | Description |
|-------|-------|-------------|
| SYSTEM | ONLINE | Always shows online (client-side app) |
| USER | 8-char ID or ANONYMOUS | Face scan ID or guest |
| SECTION | Current section name | HOME, API, ROOM, GESTURE, UPLOAD |
| ENGINE | READY | 3D engine status |

---

## 20. Data Storage & Privacy

**Everything is stored in browser IndexedDB. Zero server communication.**

| Data | Store | Format | Privacy |
|------|-------|--------|---------|
| Face embedding | `faces` | 128-float vector | Math only, no photo |
| Uploaded projects | `projects` | GLB binary + metadata | Local only |
| Custom gestures | `gestures` | 21-landmark frames | Local only |
| Annotations | `annotations` | `{id, text, created}` | Local only |
| Nav positions | `navPositions` | `{left, top}` | Local only |
| API key | JS variable | String (RAM only) | Tab close = gone |

**What goes to external servers:**
- CDN assets (Three.js, face-api.js, MediaPipe models) → loaded from CDN
- AI API calls → direct from browser to OpenAI/Anthropic/Gemini (our server not involved)
- PeerJS signaling → initial WebRTC handshake only
- Nothing else. Ever.

**Database:** `jarvis3d`, version 2, 6 object stores.

---

## 21. 9 Built-in Projects

### 🚀 Falcon Rocket (~177 components)
Heavy-lift launch vehicle with reusable boosters.
- Nose Cone → Fairing (MLI layers, clamp bands, bolts, detonators) → Level 5 depth
- Payload Bay → PAF (frangible bolts, initiators), deploy mechanism (springs, latches, solenoids), umbilical (power/data/pyro pins)
- 2nd Stage → LOX/RP-1 tanks (baffles, probes, fill valves), MVac engine (combustion chamber, throat, injector manifolds, igniter, turbopump with impeller/turbine/bearings/gas generator, nozzle extension, gimbal actuator)
- Interstage → 4 frangible bolts (each with detonator + charge), pushers with springs, wiring harness
- 1st Stage → Tank structure (LOX/RP-1 tanks with domes, anti-vortex, vents), octaweb, avionics (triple-redundant FC, GPS, S-band), cold gas thrusters
- Engines → Center engine (detailed: chamber, turbopump, injector, nozzle, gimbal) + 8 outer engines
- Landing Legs → Struts (inner tubes), hydraulic dampers (pistons, O-rings), foot pads (radar altimeter, strain gauge), up-locks (pyro release)
- Grid Fins → Actuators (BLDC motors, encoders), pivot bearings
- Fuel Tanks → LOX/RP-1 systems, pressurization (He bottles, regulators)

### 🏎️ Sports Car (~50 components)
Electric hypercar with active aerodynamics.
- Carbon monocoque body, active hood, active spoiler (hydraulic), rear diffuser
- 4 wheels (forged Mg, carbon ceramic brakes, double wishbone suspension, ABS sensors)
- Front motor (inverter, gearbox), rear motors (2x inverters), battery pack (BMS, cooling plate, HV contactors)

### 🛸 Quad Drone (~35 components)
Autonomous quadcopter with obstacle avoidance.
- CF X-frame, 4 arms, top/bottom plates
- 4 brushless motors (bearings, magnets), 4 propellers
- LiPo battery, flight controller (gyro, barometer), GPS, FPV camera

### 🤖 Mech Suit (~40 components)
Powered exoskeleton for heavy-duty operations.
- Helmet (AR display, comms), torso (life support, spine actuator)
- Arc reactor (palladium core, magnetic coils)
- Arms (shoulder joints, hydraulics), hands (fingers, repulsor)
- Legs (knee actuators), thrusters, boot jets

### 🛰️ Satellite (~25 components)
Communication satellite with solar arrays.
- Satellite bus, main antenna (subreflector), feed horn
- Solar arrays (array drives), battery pack, thermal radiator
- Ion thrusters, xenon tank

### 🔱 Submarine (~25 components)
Deep-sea research submarine.
- Pressure hull (3 sections), conning tower
- Forward/aft ballast tanks (blow valves)
- Pump-jet propulsor (electric motor), maneuvering thrusters
- Spherical sonar array (signal processor), external cameras

### 🛸 Space Station (~20 components)
Modular orbital research station.
- Core module (life support, nav computer), science lab (glovebox)
- Docking node (pressure hatch), robotic arm (end effector)
- Solar wings (alpha joint), radiator panels (ammonia pump)

### 🚜 Battle Tank (~25 components)
Next-generation main battle tank.
- Turret (autoloader, gunner sight), gun barrel (muzzle brake)
- Hull (driver station), reactive armor
- Tracks (tensioners), turbine engine (transmission, air filter)

### ✈️ Stealth Jet (~25 components)
5th generation stealth fighter.
- Fuselage (weapons bay, forward fuel cell), wings (ailerons), tail (ruddervators)
- S-duct intakes (DSI bump), turbofan engines (FADEC), thrust vectoring nozzle
- AESA radar (signal processor), cockpit (MFD displays, HMCS helmet)

---

## 22. Architecture

```
3D/
├── index.html              # Main page — all HTML structure
├── src/
│   ├── app.js              # Core app — state, navigation, exploder, AI, room, gestures
│   ├── geometries.js       # Low-level 3D geometry builders for each part shape
│   ├── modelbuilder.js     # High-level model assembly — hierarchical part trees
│   ├── gestures.js         # MediaPipe hand tracking + gesture recognition
│   ├── sounds.js           # Procedural Web Audio API sound engine
│   ├── search.js           # Search overlay + keyboard shortcuts + annotations
│   ├── ai-prompt.js        # AI system prompt (JARVIS personality)
│   ├── style.css           # Complete holographic theme
│   └── GLTFLoader.js       # Three.js GLB parser (bundled)
├── models/                 # Face detection models (face-api.js)
└── README.md / FEATURES.md
```

**Tech Stack:**

| Layer | Technology |
|-------|------------|
| 3D Engine | Three.js r128 |
| Materials | MeshStandardMaterial (PBR metalness/roughness) |
| Face Detection | face-api.js (TinyFaceDetector + 68 landmarks) |
| Hand Tracking | MediaPipe Hands (21 landmarks) |
| P2P Video | WebRTC via PeerJS |
| AI | OpenAI / Anthropic / Gemini (direct browser fetch) |
| Storage | IndexedDB |
| Sounds | Web Audio API (procedural oscillators + noise) |
| Hosting | Any static server (Python, Nginx, Vercel, Cloudflare Pages) |

**Deployment:** No build step. No npm. No backend. Just serve the files.

```bash
python3 -m http.server 8080
# or
npx serve .
# or (with AI API proxy)
node server.js
```

---

## 22. Screenshot System

**What:** Capture any 3D view as a PNG image.

**How it works:**
1. Press `P` key or click 📸 in quick controls or exploder toolbar
2. Screen flashes white (visual feedback)
3. Canvas is captured at 1920×1080
4. Holographic footer added: project name + timestamp
5. PNG auto-downloads as `jarvis3d-[timestamp].png`

**Capture sources:**
- In exploder view → captures `part-detail-canvas` (3D model)
- In any other view → captures `three-canvas` (background scene)

**UI Impact:** 1 button in quick-controls + 1 in exploder controls. Non-intrusive.

---

## 23. Saved Views

**What:** Save and restore any exploder state with a name.

**Saved data:**
- Project ID + name
- Selected part (if any)
- Camera position (x, y, z)
- Rotation (x, y)
- Explode state (on/off)
- X-ray state (on/off)

**How to use:**
1. In exploder view, set up your desired view (rotate, explode, select part, etc.)
2. Click 💾 Save → enter a name
3. Click 💾 in quick controls → panel shows all saved views
4. Click any saved view → restores exact state

**Storage:** IndexedDB (`savedViews` store). Persists across sessions.

**Delete:** Hover over a saved view → ✕ button appears.

---

## 24. Favorites

**What:** Star any part for quick access across projects.

**How to use:**
1. In exploder view, select any part
2. Click ☆ Fav → becomes ★ Fav (yellow)
3. Navigate to ⭐ Favorites section
4. All favorited parts shown as clickable cards
5. Click any card → opens that project, selects that part

**Data stored per favorite:** Project ID, project name, project icon, part ID, part name, part description.

**Storage:** IndexedDB (`favorites` store). Key format: `[projectId]::[partId]`.

**Remove:** Click ✕ on a favorite card, or click ★ Fav again in exploder.

---

## 25. Guided Tour

**What:** First-time user walkthrough with spotlight effect.

**Steps:**
1. Project Grid — "This is your Project Grid — 9 built-in models"
2. Floating Navigation — "Drag it anywhere. Use it to switch sections"
3. Search — "Press Ctrl+K to search projects, parts, and actions"
4. AI Assistant — "Click the JARVIS bubble to chat with your AI"
5. First Project Card — "Click this card to open the Part Exploder"

**How it works:**
- Auto-starts on first visit (after 2 second delay)
- Overlay darkens screen, spotlight highlights target element
- Tooltip positioned relative to target (left/right/bottom/center)
- Step indicator shows "STEP X / 5"
- Skip button → dismisses immediately
- Done button on last step

**Persistence:** Saves `tour-seen: true` in IndexedDB settings. Won't show again.

---

## 26. Assembly Animation Timeline

**What:** Slider control for smooth explode/assemble interpolation.

**How it works:**
- Slider appears below exploder controls when a project is open
- Left = EXPLODED (parts spread out)
- Right = ASSEMBLED (parts in original position)
- Drag slider → smooth transition between states
- Updates `exploderExplodeProgress` in real-time

**Technical:** Reuses the same `updateExplodePositions()` function as the explode button. Slider value (0-100) maps to progress (1.0-0.0).

---

## 27. Mobile Touch Gestures

**What:** Touch-based 3D interaction for mobile devices.

**Gestures:**
| Gesture | Action |
|---|---|
| Single finger drag | Rotate model |
| Pinch (two fingers) | Zoom in/out |
| Two-finger rotate | Combined zoom + rotation |
| Tap on part | Select part |
| Tap on project card | Open project |

**Technical:** Uses `touchstart`, `touchmove`, `touchend` events with `{ passive: false }` to prevent browser zoom. Touch events mapped to the same `exploderRotation` and `exploderCamera.position` as mouse controls.

---

## 28. Achievements

**What:** Unlock badges as you explore the platform.

**Achievement definitions:**
| ID | Name | Description | Trigger |
|---|---|---|---|
| first_view | First Steps | Opened your first project | `openExploder()` called |
| explorer | Explorer | Viewed all 9 built-in projects | `viewedProjects.size >= 9` |
| deep_diver | Deep Diver | Drilled 5 levels deep | `exploderBreadcrumb.length >= 5` |
| first_favorite | Bookworm | Favorited your first part | `toggleFavorite()` success |
| collector | Collector | Favorited 10 parts | `favorites count >= 10` |
| first_upload | Creator | Uploaded your first model | `addUploadedProject()` success |
| voice_user | Talk to Me | Used voice commands | Voice button clicked |
| tour_complete | Oriented | Completed the guided tour | Tour done/skipped |
| theme_changer | Stylish | Changed the theme | Theme selected |
| all_parts | Completionist | Inspected 90 unique parts | `viewedParts.size >= 90` |

**Notification:** Slide-in toast at bottom-left. Green border. Shows 🏆 icon + title + description. Auto-dismisses after 3 seconds.

**Storage:** IndexedDB (`achievements` store). Each entry: `{ id, unlockedAt }`.

---

## 29. Voice Commands

**What:** Browser-based speech recognition for hands-free control.

**Technology:** Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`). Works best in Chrome.

**How to use:**
1. Click 🎙️ in quick controls
2. Button turns green + pulses
3. Status bar appears: "Listening..."
4. Speak a command
5. Status shows recognized text
6. Command executes automatically

**Supported commands:**
| Phrase | Action |
|---|---|
| "home" / "projects" | Navigate to project grid |
| "api" / "settings" | Navigate to API section |
| "room" / "collaborate" | Navigate to room section |
| "upload" / "import" | Navigate to upload section |
| "favorite" | Navigate to favorites section |
| "explode" | Toggle explode view |
| "assemble" / "put together" | Reassemble model |
| "reset" | Reset camera and rotation |
| "x-ray" / "wireframe" | Toggle X-ray mode |
| "screenshot" / "capture" | Take screenshot |
| "search" | Open search overlay |
| "sound off" / "mute" | Mute sounds |
| "sound on" / "unmute" | Unmute sounds |
| "[project name]" | Open that project (e.g., "falcon", "drone") |
| "[part name]" | Select that part (e.g., "engine", "hull") |

**Fallback:** If browser doesn't support Web Speech API, button is grayed out with tooltip "Voice not supported in this browser".

---

## 30. Stress Test Visualization

**What:** Simulated load distribution visualization as a heat map.

**How it works:**
1. In exploder view, click 🧪 Stress
2. All parts recolored based on simulated stress:
   - **Red** = high stress (lower position, outer edges)
   - **Blue** = low stress (upper position, inner)
   - Interpolated gradient between
3. Original colors saved in `mesh.userData._stressOriginalColor`
4. Click again to toggle off → original colors restored

**Algorithm:** Stress = `(2 - y_position) * 0.3 + distance_from_center * 0.4 + random_noise * 0.2`, clamped to [0, 1].

**UI Impact:** 1 toggle button in exploder controls. Active state: orange border + glow.

---

## 31. Real-Time 3D State Sync

**What:** P2P synchronization of 3D view state between room peers.

**How it works:**
1. When a peer connects (after password auth), `startStateSync()` is called
2. Every 200ms (5 updates/sec), current state is sent over WebRTC data channel:
   ```javascript
   { type: '3d_state', projectId, partName, rotation, exploded }
   ```
3. Receiving peer's `handleRemote3DState()` applies the state:
   - If different project → opens that project
   - Rotation → smoothly interpolated via `exploderRotTarget`
   - Explode state → toggled if different

**Stop:** `stopStateSync()` called when room is left.

**Bandwidth:** ~200 bytes per update × 5/sec = ~1 KB/sec per peer.

---

## 32. Theme Engine

**What:** 6 color themes that change CSS variables and Three.js scene colors.

**Themes:**
| Name | Primary | Accent | Vibe |
|---|---|---|---|
| Cyan (default) | #00d4ff | #ff6600 | Classic holographic |
| Red Alert | #ff3333 | #ffaa00 | Danger mode |
| Matrix | #00ff66 | #88ff00 | Green terminal |
| Gold | #ffaa00 | #ff6600 | Luxury |
| Nebula | #aa44ff | #ff44aa | Deep space |
| Arctic | #ffffff | #6699ff | Clean white/blue |

**How it works:**
1. Click 🎨 in quick controls → tiny overlay appears below button
2. Click a theme → `data-theme` attribute set on `<html>` element
3. CSS `[data-theme="name"]` selectors override `:root` variables
4. Three.js scene colors updated: grid lines, particles, ambient light
5. Saved to `localStorage` → persists across sessions

**CSS variables changed:** `--primary`, `--primary-dim`, `--secondary`, `--accent`, `--border`, `--surface`, `--glow`, `--glow-strong`, `--text`, `--text-dim`.

---

## 33. PWA (Offline Support)

**What:** Installable progressive web app with offline capability.

**Components:**
- `manifest.json` — app name, icons, theme color, display mode
- `sw.js` — service worker with caching strategy

**Caching strategy:**
- **Static assets** (HTML, CSS, JS): Cache-first, cached on install
- **CDN assets** (Three.js, face-api.js, fonts): Stale-while-revalidate
- **API calls** (`/api/*`): Network-only (not cached)

**Install:** Chrome shows "Install" prompt after first visit. Click to install as desktop app.

**Offline behavior:**
- App loads and works fully offline after first visit
- AI assistant needs internet (API calls)
- P2P room needs internet (PeerJS signaling)
- MediaPipe needs internet (model download on first use)

---

## 34. Compare Mode

**What:** Side-by-side project comparison.

**How to use:**
1. Click ⚖️ COMPARE in nav (or press `6`)
2. Select two projects from dropdowns
3. Click Compare

**Stats shown per project:**
- Top-level parts count
- Total components (with drill-down)
- Categories count
- Max drill depth
- Type (built-in / uploaded)

**Visual comparison bars:** Horizontal bars showing relative values for parts, categories, and depth. Left bar = first project (primary color), right bar = second project (accent color).

---

## 35. Annotation Export

**What:** Export all annotations as a CSV file.

**How to use:**
1. In exploder view, click 📋 EXPORT
2. CSV auto-downloads: `jarvis3d-annotations-[timestamp].csv`

**CSV format:**
```
Part ID,Note,Created
"falcon-engine","This is the main engine","2026-04-21T10:30:00.000Z"
```

---

## 36. Share Link

**What:** Generate a shareable URL that restores project + part state.

**How to use:**
1. In exploder view, click 🔗 SHARE
2. URL copied to clipboard (with visual confirmation)
3. Share the URL → recipient opens same project + part

**Technical:** State encoded as Base64 in URL hash: `{ p: projectId, part: partName }`. On page load, `restoreFromHash()` reads the hash and navigates to the saved state.

---

## 37. Plugin System

**What:** Extension API for developers to add custom functionality.

**API:**
```javascript
// Register a plugin
window.JarvisPlugins.register('myPlugin', {
    // Called once on startup
    onInit: (state, db) => {},
    
    // Called when user selects a part
    onPartSelected: (partData) => {},
    
    // Called when a project is opened
    onProjectOpened: (project) => {},
    
    // Called when navigation changes
    onSectionChanged: (sectionName) => {},
    
    // Custom commands (callable via trigger)
    commands: {
        myAction: (args) => { /* ... */ }
    }
});

// Read current app state
const state = window.JarvisPlugins.getState();
// Returns: { currentSection, selectedProject, selectedPart, projects }

// Trigger a hook manually
window.JarvisPlugins.trigger('partSelected', data);
```

**Available hooks:** `partSelected`, `projectOpened`, `sectionChanged`

**Error handling:** Plugin errors are caught and logged — they won't crash the app.

---

## 38. Measurement Tool

**What:** Measure distance between two points on a 3D model.

**How to use:**
1. In exploder view, click 📏 Measure
2. Button turns green (active)
3. Click first point on the model → green marker appears
4. Click second point → distance displayed in center
5. Auto-clears after 5 seconds

**Distance:** Shown in model units (e.g., `📏 Distance: 0.847 units`).

**Technical:** Uses Three.js Raycaster to get intersection points, then `point1.distanceTo(point2)`.

---

*317+ clickable components. 5 levels deep. 38 features. Zero servers. Pure browser power.*

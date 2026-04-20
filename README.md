# JARVIS 3D — Holographic Interface

A fully serverless, browser-based 3D interactive platform inspired by Iron Man's JARVIS holographic table. No backend. No database server. Everything runs in the browser.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Tech](https://img.shields.io/badge/tech-Three.js-blue)
![Serverless](https://img.shields.io/badge/architecture-100%25%20serverless-orange)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-green)

---

## What Is This?

A 3D website where you can:

- **Browse interactive 3D projects** — rockets, drones, cars, jets, tanks, submarines, satellites, space stations, mech suits
- **Explode any project into parts** — click a project, see every component, click a part to inspect it 5 levels deep
- **Upload your own 3D models** — drop a `.glb` file, the engine automatically breaks it into selectable parts
- **Talk to an AI assistant** — add your own API key (OpenAI / Anthropic / Gemini), get real-time help
- **Video call a friend** — peer-to-peer room with live video + text chat + **3D state sync**
- **Control with hand gestures** — camera-based gesture recognition using MediaPipe Hands
- **Control with voice** — say "Show me the engine", "Explode", "Reset"
- **Search everything** — `Ctrl+K` to find any project, part, or action instantly
- **Annotate parts** — add notes to any component for later reference
- **Save views** — bookmark any camera angle + part + state for instant recall
- **Favorite parts** — star parts across projects, access from Favorites section
- **Compare projects** — side-by-side stats and visual comparison
- **Take screenshots** — capture any view as PNG with holographic overlay
- **Measure distances** — click two points on a 3D model to measure
- **Stress test** — visualize simulated load distribution as a heat map
- **Theme it** — 6 color themes (Cyan, Red Alert, Matrix, Gold, Nebula, Arctic)
- **Use offline** — PWA with service worker, installable on desktop
- **Earn achievements** — unlock badges as you explore

---

## Quick Start

```bash
# No install needed. No npm. No build step.
# Just serve the files with any HTTP server.

cd jarvis-3d
python3 -m http.server 8080

# Open http://localhost:8080 in Chrome
```

That's it. No dependencies to install. Everything loads from CDN.

For AI assistant (OpenAI/Anthropic) with CORS proxy:
```bash
node server.js
```

---

## First Visit

1. **Face Scan** — The site asks for camera access and scans your face
   - Your face data stays in your browser (IndexedDB). Nothing is sent anywhere
   - On your next visit, it recognizes you
   - Click **Skip Scan** if you don't want this

2. **Guided Tour** — First-time users get a 5-step walkthrough
   - Highlights each section with spotlight effect
   - Click **Skip** to dismiss anytime
   - Won't show again after completion

3. **Main Interface** — You land on the project grid (9 built-in projects)

---

## Features

### 🏠 Project Grid

3×3 grid of projects. Each card shows a rotating 3D preview of the project's parts.

**Built-in projects:**
| Project | Icon | Top-Level Parts | Total Components |
|---|---|---|---|
| Falcon Rocket | 🚀 | 9 | 180+ (5 levels deep) |
| Quad Drone | 🛸 | 12 | ~30 |
| Mech Suit | 🤖 | 12 | ~35 |
| Satellite | 🛰️ | 9 | ~25 |
| Sports Car | 🏎️ | 11 | ~35 |
| Submarine | 🔱 | 8 | ~25 |
| Space Station | 🛸 | 6 | ~20 |
| Battle Tank | 🚜 | 7 | ~25 |
| Stealth Jet | ✈️ | 9 | ~30 |

### 🔩 Part Exploder (Star Feature)

Click any project → all parts appear grouped on left and right panels.

Click a specific part:
- **Other parts fly to the sides** as small labeled icons with spring animation
- **Selected part zooms to center** with a rotating 3D preview
- **Part name + description** shown below
- **Add notes** (annotations) to any part
- **Breadcrumb navigation** — drill 5 levels deep, back button pops stack

**Exploder Controls:**
| Button | Action |
|---|---|
| 💥 Explode | Toggle explode/assemble with camera shake |
| 🔄 Reset | Reset camera, rotation, explode state |
| 👁️ X-Ray | Wireframe mode — see through parts |
| 📏 Measure | Click two points → distance shown |
| 🧪 Stress | Heat map visualization (red=high, blue=low) |
| ☆ Fav | Star the selected part |
| 💾 Save | Save current view (camera + state) |
| 📸 | Capture screenshot as PNG |

**Assembly Timeline:** Slider below controls — drag to smoothly transition between exploded and assembled states.

### 📤 Upload Your Own Models

1. Click the 📤 Upload button
2. Drop a `.glb` file (binary glTF)
3. The engine:
   - Parses the 3D model
   - Extracts every mesh as a selectable part
   - Auto-groups if there are 50+ parts (by hierarchy + name similarity)
   - Shows a 3D preview
4. Click **Add to Projects** — it appears on your Home grid with an "UPLOADED" badge
5. Your uploads persist in IndexedDB across sessions

**Supported format:** `.glb` only

### 🤖 AI Assistant

1. Click the 🤖 bubble (bottom-right)
2. Enter your API key (OpenAI, Anthropic, or Google Gemini)
3. Start chatting

**The AI knows:** current section, selected project/part, recent actions, confusion score  
**The AI does NOT know:** camera feed, gesture data, API key  
**Security:** API key lives in RAM only. Close tab = key gone forever.

### 🚪 P2P Collaboration Room

1. Click 🚪 Room
2. **Create Room** — set a password, get a room code
3. **Join Room** — enter code + password (validated server-side)
4. Live video chat via WebRTC (peer-to-peer)
5. Text chat alongside video
6. **3D State Sync** — when connected, both users see the same project, rotation, and explode state
7. **Leave** to disconnect

### 🤌 Gesture Controls

Camera-based hand tracking using MediaPipe (21 landmarks).

**Recognized gestures:** Fist, Open Palm, Point, Peace, Thumbs Up/Down, Pinch, Rock, Swipe  
**3D Integration:** Point=hover part, Fist=click/drill, Open Palm=reset, Pinch=zoom, Rock=explode  
**Custom gestures:** Record any pose → assign an action → saves to IndexedDB

### 🎙️ Voice Commands

Click the 🎙️ button to activate. Say:

| Command | Action |
|---|---|
| "Home" / "Projects" | Go to project grid |
| "Explode" | Toggle explode view |
| "Assemble" | Reassemble model |
| "Reset" | Reset camera view |
| "X-ray" | Toggle wireframe mode |
| "Screenshot" | Capture current view |
| "Search" | Open search overlay |
| "Sound off" / "Mute" | Mute sounds |
| "[Project Name]" | Open that project (e.g., "Falcon", "Drone") |
| "[Part Name]" | Select that part (e.g., "Engine", "Hull") |

### 💾 Saved Views

Save any exploder state (camera position, rotation, explode, part, X-ray) with a name. Restore with one click. Panel accessible via 💾 button in quick controls.

### ⭐ Favorites

Star any part from the exploder view. Access all favorites from the ⭐ Favorites section in navigation. Click any favorite card to jump directly to that part.

### ⚖️ Compare Mode

Side-by-side project comparison (press `6` or use nav). Shows:
- Top-level parts count
- Total components (with drill-down)
- Categories count
- Max drill depth
- Visual comparison bars

### 📸 Screenshot

Press `P` or click 📸 to capture the current view as a 1920×1080 PNG. Includes holographic footer with project name and timestamp.

### 🎨 Theme Engine

6 color themes — click �🎨 in quick controls:
- **Cyan** (default) — classic holographic
- **Red Alert** — danger mode
- **Matrix** — green terminal vibe
- **Gold** — luxury feel
- **Nebula** — deep space purple
- **Arctic** — clean white/blue

Theme persists in localStorage. Changes CSS variables + Three.js scene colors.

### 📱 Mobile Support

Touch gestures on the 3D canvas:
- **Single finger** — rotate model
- **Pinch** — zoom in/out
- **Two fingers** — rotate + zoom combined
- **Tap** — select parts

### 🏆 Achievements

Unlock badges as you explore:
| Achievement | How to Unlock |
|---|---|
| First Steps | Open your first project |
| Explorer | View all 9 built-in projects |
| Deep Diver | Drill 5 levels deep |
| Bookworm | Favorite your first part |
| Collector | Favorite 10 parts |
| Creator | Upload your first model |
| Talk to Me | Use voice commands |
| Oriented | Complete the guided tour |
| Stylish | Change the theme |
| Completionist | Inspect 90 unique parts |

### 📝 Annotations

Add notes to any part. Notes persist in IndexedDB. Export all annotations as CSV via the 📋 Export button.

### 🔊 Sound Design

Procedural sci-fi sounds (Web Audio API, no audio files):
Click, Hover, Navigate, Explode, Success, Error, Ambient hum, Scan sweep  
Press **M** to toggle.

### 🔌 Plugin System

Developers can extend JARVIS 3D:

```javascript
window.JarvisPlugins.register('myPlugin', {
    onInit: (state, db) => { /* called on startup */ },
    onPartSelected: (part) => { /* called when part selected */ },
    onProjectOpened: (project) => { /* called when project opened */ },
    onSectionChanged: (section) => { /* called on navigation */ },
    commands: {
        myCommand: (args) => { /* custom action */ }
    }
});

// Read current state
const state = window.JarvisPlugins.getState();
// Trigger hooks manually
window.JarvisPlugins.trigger('partSelected', data);
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` | Home (Projects) |
| `2` | API Settings |
| `3` | Room |
| `4` | Gesture |
| `5` | Upload |
| `6` | Compare |
| `P` | Screenshot |
| `Ctrl+K` or `/` | Open Search |
| `Escape` | Back / Close |
| `M` | Toggle Sound |
| `↑` `↓` | Navigate search results |

---

## Architecture

```
jarvis-3d/
├── index.html              # Main page — all UI sections
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline support)
├── server.js               # Dev server + AI API proxy
├── src/
│   ├── app.js              # Core application (~3000 lines)
│   ├── style.css           # Holographic theme + 6 variants (~430 lines)
│   ├── ai-prompt.js        # AI system prompt (158 lines)
│   ├── geometries.js       # 3D geometry for all 90+ parts (1807 lines)
│   ├── modelbuilder.js     # Ultra-deep model builder — 300+ components (578 lines)
│   ├── gestures.js         # MediaPipe hand tracking (474 lines)
│   ├── sounds.js           # Procedural sound engine (199 lines)
│   ├── search.js           # Search + shortcuts + annotations (453 lines)
│   └── GLTFLoader.js       # Three.js GLB parser (3629 lines)
├── models/
│   ├── tiny_face_detector_model-*      # Face detection model
│   └── face_landmark_68_model-*         # 68-point landmark model
├── README.md
└── FEATURES.md             # Detailed feature specification
```

**Total code:** ~11,000 lines

### Tech Stack

| Layer | Technology |
|---|---|
| 3D Engine | Three.js r128 |
| Face Detection | face-api.js (TinyFaceDetector + 68 landmarks) |
| Hand Tracking | MediaPipe Hands (21 landmarks) |
| Voice Recognition | Web Speech API |
| P2P Video + 3D Sync | WebRTC via PeerJS |
| AI Integration | OpenAI / Anthropic / Gemini |
| Storage | IndexedDB (9 stores) |
| Sounds | Web Audio API (procedural) |
| Offline | Service Worker + Manifest (PWA) |
| Hosting | Any static server |

### IndexedDB Stores

| Store | Purpose |
|---|---|
| faces | Face embeddings for identity |
| projects | Uploaded projects + GLB buffers |
| gestures | Custom gesture templates |
| navPositions | Floating nav bar position |
| settings | App settings (tour seen, etc.) |
| annotations | Part annotations |
| savedViews | Saved exploder views |
| favorites | Favorited parts |
| achievements | Unlocked achievements |

---

## Deployment

### Local Development
```bash
python3 -m http.server 8080
# or
npx serve .
# or (with AI proxy)
node server.js
```

### Production (Vercel)
```bash
# Push to GitHub → connect to Vercel. No build step needed.
```

### Production (Cloudflare Pages)
```bash
# Connect repo → Deploy. Done.
```

### Production (Any Static Host)
Upload the entire `jarvis-3d/` folder. That's it.

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 15+ | ✅ Most features |
| Mobile Chrome | ✅ Works (touch gestures supported) |
| Mobile Safari | ⚠️ Partial (WebGL performance varies) |

**Requirements:**
- WebGL support (for 3D rendering)
- Camera access (for face scan + gestures, optional)
- Microphone access (for voice commands, optional)
- Modern JavaScript (ES2020+)

---

## FAQ

**Q: Is my data sent to any server?**
A: No. Face data, projects, gestures, annotations, favorites, saved views — all in IndexedDB. API keys go directly to providers. Nothing touches our servers.

**Q: Can I use this offline?**
A: Yes. Service worker caches all assets after first load. AI calls and P2P features need internet.

**Q: Can two people see the same 3D model in the room?**
A: Yes. The room now syncs 3D state (project, rotation, explode) between peers at 5 updates/sec.

**Q: How does voice recognition work?**
A: Uses the browser's built-in Web Speech API. Works best in Chrome. No data sent to our servers.

**Q: Can I extend JARVIS 3D with my own features?**
A: Yes. Use the Plugin System API (`window.JarvisPlugins.register()`). See the Plugin System section above.

---

## License

MIT

---

## Credits

- [Three.js](https://threejs.org/) — 3D rendering
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) — Face detection
- [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands) — Hand tracking
- [PeerJS](https://peerjs.com/) — WebRTC simplification
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — Voice recognition
- Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron) + [Rajdhani](https://fonts.google.com/specimen/Rajdhani)

---

*Built with ❤️ and 11,000 lines of hand-crafted code.*

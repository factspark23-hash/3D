# JARVIS 3D — Holographic Interface

A fully serverless, browser-based 3D interactive platform inspired by Iron Man's JARVIS holographic table. No backend. No database server. Everything runs in the browser.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Tech](https://img.shields.io/badge/tech-Three.js-blue)
![Serverless](https://img.shields.io/badge/architecture-100%25%20serverless-orange)

---

## What Is This?

A 3D website where you can:

- **Browse interactive 3D projects** — rockets, drones, cars, jets, tanks, submarines, satellites, space stations, mech suits
- **Explode any project into parts** — click a project, see every component, click a part to inspect it in detail
- **Upload your own 3D models** — drop a `.glb` file, the engine automatically breaks it into selectable parts
- **Talk to an AI assistant** — add your own API key (OpenAI / Anthropic / Gemini), get real-time help
- **Video call a friend** — peer-to-peer room with live video + text chat
- **Control with hand gestures** — camera-based gesture recognition using MediaPipe Hands
- **Search everything** — `Ctrl+K` to find any project, part, or action instantly
- **Annotate parts** — add notes to any component for later reference

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

---

## First Visit

1. **Face Scan** — The site asks for camera access and scans your face
   - Your face data stays in your browser (IndexedDB). Nothing is sent anywhere
   - On your next visit, it recognizes you
   - Click **Skip Scan** if you don't want this

2. **Main Interface** — You land on the project grid (9 built-in projects)

---

## Features

### 🏠 Project Grid

3×3 grid of projects. Each card shows a rotating 3D preview of the project's parts.

**Built-in projects:**
| Project | Icon | Parts |
|---|---|---|
| Falcon Rocket | 🚀 | 9 |
| Quad Drone | 🛸 | 12 |
| Mech Suit | 🤖 | 12 |
| Satellite | 🛰️ | 9 |
| Sports Car | 🏎️ | 11 |
| Submarine | 🔱 | 8 |
| Space Station | 🛸 | 6 |
| Battle Tank | 🚜 | 7 |
| Stealth Jet | ✈️ | 9 |

### 🔩 Part Exploder (Star Feature)

Click any project → all parts appear grouped on left and right panels.

Click a specific part:
- **Other parts fly to the sides** as small labeled icons
- **Selected part zooms to center** with a rotating 3D preview
- **Part name + description** shown below
- **Add notes** (annotations) to any part

Parts with 50+ components are auto-grouped into smart categories:
- Body, Mechanical, Wheels, Electronics, Aerodynamics, Propulsion, etc.
- Groups are expandable — click ▶ to see sub-parts

### 📤 Upload Your Own Models

1. Click the 📤 Upload button
2. Drop a `.glb` file (binary glTF)
3. The engine:
   - Parses the 3D model
   - Extracts every mesh as a selectable part
   - Auto-groups if there are 50+ parts
   - Shows a 3D preview
4. Click **Add to Projects** — it appears on your Home grid with an "UPLOADED" badge
5. Your uploads persist in IndexedDB across sessions

**Supported format:** `.glb` only (the most efficient 3D format, natively supported by Three.js)

### 🤖 AI Assistant

1. Click the 🤖 bubble (bottom-right)
2. Enter your API key (OpenAI, Anthropic, or Google Gemini)
3. Start chatting

**The AI knows:**
- Which section you're on
- What project/part you've selected
- Your recent actions
- If you seem confused (repeat clicks, rapid clicking)

**The AI does NOT know:**
- Your camera feed
- Your gesture data
- Your API key (stored in RAM only, never persisted)

**Security:** Your API key exists only in JavaScript memory. Close the tab = key gone forever. It is never saved to IndexedDB, localStorage, or cookies.

### 🚪 P2P Collaboration Room

1. Click 🚪 Room
2. **Create Room** — set a password, get a room code
3. **Join Room** — enter code + password
4. Live video chat via WebRTC (peer-to-peer, no server)
5. Text chat alongside video
6. **Leave** to disconnect

Uses PeerJS free cloud signaling server for the initial handshake. After that, all data flows directly between browsers.

### 🤌 Gesture Controls

1. Click 🤌 Gesture → **Enable Camera**
2. The system loads MediaPipe Hands (21-landmark hand tracking)
3. You see your hand skeleton drawn in real-time

**Recognized gestures:**
| Gesture | Meaning |
|---|---|
| ✊ Fist | Fist |
| 🖐️ Open palm | Open palm |
| ☝️ Point | Point (index finger) |
| ✌️ Peace | Peace sign |
| 🤟 Three fingers | Three fingers up |
| 👍 Thumbs up | Thumbs up |
| 👎 Thumbs down | Thumbs down |
| 🤏 Pinch | Thumb + index close |
| 🤘 Rock | Rock sign |
| Swipe | Move hand to screen edge |

**Custom gestures:**
1. Click **+ Record New Gesture**
2. Name it, assign an action (navigate, scroll, zoom)
3. Hold your gesture for 2 seconds
4. It saves to IndexedDB
5. Make that gesture anytime → action triggers

### 🔍 Search

- Press `Ctrl+K` or `/` to open search
- Type to find projects, parts, or actions
- Arrow keys to navigate, Enter to select
- Click any result to jump directly

### 📝 Annotations

- In the Part Exploder view, click 📌 **Add Note** below any part's description
- Write your notes in the textarea
- Click **Save**
- Notes persist in IndexedDB
- 📌 changes to 📝 when a note exists

### 🔊 Sound Design

Procedural sci-fi sounds (no audio files):
- **Click** — sine blip
- **Hover** — subtle tick
- **Navigate** — ascending triple tone
- **Explode** — noise whoosh
- **Success** — C-E-G chord
- **Error** — descending buzz
- **Ambient** — continuous low-frequency hum
- **Scan** — sweeping sine wave

Press **M** to toggle sound on/off. Or click the 🔊 button (top-left).

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` | Home (Projects) |
| `2` | API Settings |
| `3` | Room |
| `4` | Gesture |
| `5` | Upload |
| `Ctrl+K` or `/` | Open Search |
| `Escape` | Back / Close |
| `M` | Toggle Sound |
| `↑` `↓` | Navigate search results |

---

## Architecture

```
jarvis-3d/
├── index.html              # Main page (250 lines)
├── src/
│   ├── app.js              # Core application logic (1555 lines)
│   ├── style.css           # Holographic theme (250 lines)
│   ├── ai-prompt.js        # AI system prompt (158 lines)
│   ├── geometries.js       # 3D geometry for all 90+ parts (552 lines)
│   ├── gestures.js         # MediaPipe hand tracking (388 lines)
│   ├── sounds.js           # Procedural sound engine (199 lines)
│   ├── search.js           # Search + shortcuts + annotations (441 lines)
│   └── GLTFLoader.js       # Three.js GLB parser (downloaded)
├── models/
│   ├── tiny_face_detector_model-*      # Face detection model
│   └── face_landmark_68_model-*         # 68-point landmark model
└── README.md
```

**Total code written:** ~3,800 lines

### Tech Stack

| Layer | Technology |
|---|---|
| 3D Engine | Three.js r128 |
| Face Detection | face-api.js (TinyFaceDetector + 68 landmarks) |
| Hand Tracking | MediaPipe Hands (21 landmarks) |
| P2P Video | WebRTC via PeerJS |
| AI Integration | OpenAI / Anthropic / Gemini (direct browser fetch) |
| Storage | IndexedDB (faces, projects, gestures, annotations, nav positions) |
| Sounds | Web Audio API (procedural oscillators + noise buffers) |
| Hosting | Any static server (Python, Nginx, Vercel, Cloudflare Pages) |

### Scalability

Since everything is client-side:
- **No server = no server load**
- CDN serves static files → handles millions of requests natively
- All computation (3D rendering, face detection, gesture tracking, AI calls) happens in the user's browser
- 10M+ concurrent users is a non-issue

---

## Deployment

### Local Development
```bash
python3 -m http.server 8080
# or
npx serve .
```

### Production (Vercel)
```bash
# Just push to a GitHub repo and connect to Vercel.
# No build step. No config needed.
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
| Safari 15+ | ✅ Most features (MediaPipe may need polyfill) |
| Mobile Chrome | ✅ Works (performance depends on device GPU) |
| Mobile Safari | ⚠️ Partial (WebGL performance varies) |

**Requirements:**
- WebGL support (for 3D rendering)
- Camera access (for face scan + gestures, optional)
- Modern JavaScript (ES2020+)

---

## FAQ

**Q: Is my data sent to any server?**
A: No. Face data, projects, gestures, annotations — all stored in your browser's IndexedDB. API keys go directly from your browser to OpenAI/Anthropic/Gemini. Nothing touches our servers.

**Q: Can I use this offline?**
A: After the first load (CDN assets cached), yes. The only things that need internet are: AI API calls, PeerJS signaling, and MediaPipe model download.

**Q: Why .glb and not .obj or .fbx?**
A: `.glb` is the industry standard for web 3D. It's binary (small), carries materials + hierarchy in one file, and Three.js supports it natively. No extra parser needed.

**Q: Can two people see the same 3D model in the room?**
A: Not yet. The room currently handles video + text chat. Shared 3D state synchronization would require a signaling layer for state — possible future feature.

**Q: Why do card previews look like abstract shapes for built-in projects?**
A: Built-in projects use procedural geometry (generated code). The previews show all parts arranged compactly. Upload a real `.glb` to see actual model geometry in the preview.

**Q: How accurate is gesture detection?**
A: With MediaPipe Hands: very accurate for distinct gestures (fist, open palm, peace, point). Custom gesture recording uses template matching — hold the gesture steady for best results. In "basic mode" (no MediaPipe), only directional swipes are detected.

---

## License

MIT

---

## Credits

- [Three.js](https://threejs.org/) — 3D rendering
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) — Face detection
- [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands) — Hand tracking
- [PeerJS](https://peerjs.com/) — WebRTC simplification
- Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron) + [Rajdhani](https://fonts.google.com/specimen/Rajdhani)

---

*Built with ❤️ and 3,800 lines of hand-crafted code.*

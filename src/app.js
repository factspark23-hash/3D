// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Complete Application
// 3D Base + Face Scan + Project Grid + Part Exploder +
// AI Assistant + P2P Room + Gesture Builder + Upload
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    const state = {
        faceData: null,
        currentSection: 'home',
        apiKey: null,
        apiProvider: 'openai',
        actionLog: [],
        confusionScore: { score: 0, lastReset: Date.now() },
        selectedProject: null,
        selectedPart: null,
        projects: [],
        peer: null,
        peerConn: null,
        roomCode: null,
        roomPassword: null,
        gestureModels: [],
        gestureStream: null,
        gestureRecording: false,
        gestureSamples: [],
    };

    // ═══════════════════════════════════════════════════════════
    // INDEXEDDB
    // ═══════════════════════════════════════════════════════════
    const db = {
        name: 'jarvis3d', version: 2, _db: null,
        async open() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.name, this.version);
                req.onupgradeneeded = (e) => {
                    const d = e.target.result;
                    ['faces', 'projects', 'gestures', 'navPositions', 'settings', 'annotations'].forEach(s => {
                        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
                    });
                };
                req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
                req.onerror = () => reject(req.error);
            });
        },
        async put(store, data) {
            return new Promise((res, rej) => {
                const tx = this._db.transaction(store, 'readwrite');
                tx.objectStore(store).put(data);
                tx.oncomplete = res; tx.onerror = rej;
            });
        },
        async get(store, id) {
            return new Promise((res, rej) => {
                const tx = this._db.transaction(store, 'readonly');
                const req = tx.objectStore(store).get(id);
                req.onsuccess = () => res(req.result); req.onerror = rej;
            });
        },
        async getAll(store) {
            return new Promise((res, rej) => {
                const tx = this._db.transaction(store, 'readonly');
                const req = tx.objectStore(store).getAll();
                req.onsuccess = () => res(req.result); req.onerror = rej;
            });
        },
        async del(store, id) {
            return new Promise((res, rej) => {
                const tx = this._db.transaction(store, 'readwrite');
                tx.objectStore(store).delete(id);
                tx.oncomplete = res; tx.onerror = rej;
            });
        },
    };

    // ═══════════════════════════════════════════════════════════
    // HOLOGRAPHIC CONFIRM DIALOG
    // ═══════════════════════════════════════════════════════════
    function holoConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';

            const box = document.createElement('div');
            box.style.cssText = 'background:rgba(0,10,20,0.95);border:1px solid rgba(0,212,255,0.5);box-shadow:0 0 40px rgba(0,212,255,0.2);padding:30px;max-width:400px;width:90%;text-align:center;';

            const msg = document.createElement('p');
            msg.style.cssText = "font-family:'Rajdhani',sans-serif;font-size:15px;color:#e0e0e0;margin-bottom:24px;line-height:1.6;";
            msg.textContent = message;

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

            const makeBtn = (label, color, border, hoverBg) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.cssText = `background:${color};border:1px solid ${border};color:${label === 'CANCEL' ? '#888' : border};padding:10px 28px;font-family:'Orbitron',monospace;font-size:11px;letter-spacing:2px;cursor:pointer;transition:all 0.3s;`;
                btn.addEventListener('mouseenter', () => { btn.style.background = hoverBg; });
                btn.addEventListener('mouseleave', () => { btn.style.background = color; });
                return btn;
            };

            const cancelBtn = makeBtn('CANCEL', 'transparent', 'rgba(0,212,255,0.3)', 'rgba(0,212,255,0.1)');
            const confirmBtn = makeBtn('DELETE', 'rgba(255,50,50,0.1)', '#ff3232', 'rgba(255,50,50,0.25)');

            cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
            confirmBtn.addEventListener('click', () => { overlay.remove(); resolve(true); });

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(confirmBtn);
            box.appendChild(msg);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION LOGGER + CONFUSION DETECTION
    // ═══════════════════════════════════════════════════════════
    function logAction(type, detail) {
        state.actionLog.push({ type, detail, time: Date.now() });
        if (state.actionLog.length > 100) state.actionLog.splice(0, 50);
        updateConfusion(type, detail);
    }

    function updateConfusion(type, detail) {
        const now = Date.now();
        if (now - state.confusionScore.lastReset > 30000) {
            state.confusionScore.score = Math.max(0, state.confusionScore.score - 10);
            state.confusionScore.lastReset = now;
        }
        if (type === 'part_click') {
            const recent = state.actionLog.filter(a => a.type === 'part_click' && a.detail === detail && now - a.time < 10000);
            if (recent.length >= 3) state.confusionScore.score = Math.min(100, state.confusionScore.score + 30);
        }
        const recentClicks = state.actionLog.filter(a => now - a.time < 3000 && (a.type === 'nav_click' || a.type === 'part_click'));
        if (recentClicks.length > 8) state.confusionScore.score = Math.min(100, state.confusionScore.score + 20);
    }

    function getAIContext() {
        return {
            currentSection: state.currentSection,
            selectedProject: state.selectedProject?.name || null,
            selectedPart: state.selectedPart?.name || null,
            confusionScore: state.confusionScore.score,
            recentActions: state.actionLog.slice(-15).map(a => `${a.type}: ${a.detail}`),
            totalProjects: state.projects.length,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // DEMO PROJECTS DATA
    // ═══════════════════════════════════════════════════════════
    function getDemoProjects() {
        return [
            {
                id: 'proj-falcon', name: 'FALCON ROCKET', type: 'built-in',
                color: 0x00d4ff, icon: '🚀',
                desc: 'Heavy-lift launch vehicle with reusable boosters',
                parts: [
                    { id: 'nose', name: 'Nose Cone', desc: 'Aerodynamic fairing protecting payload during ascent. Houses telemetry antennas.', color: 0xcccccc, group: 'Payload Section' },
                    { id: 'payload', name: 'Payload Bay', desc: 'Houses satellite or crew capsule. 15-ton capacity to LEO.', color: 0xaaaaaa, group: 'Payload Section' },
                    { id: 'second-stage', name: 'Second Stage', desc: 'Vacuum-optimized Merlin engine. 934kN thrust in vacuum.', color: 0x888888, group: 'Upper Stage' },
                    { id: 'interstage', name: 'Interstage', desc: 'Carbon fiber structure connecting stages. Contains separation system.', color: 0x666666, group: 'Upper Stage' },
                    { id: 'first-stage', name: 'First Stage', desc: '9 Merlin engines, 7,607kN thrust at sea level. Lands vertically.', color: 0x00d4ff, group: 'Booster' },
                    { id: 'legs', name: 'Landing Legs', desc: '4 carbon fiber legs deploy before touchdown. Withstand 2m/s impact.', color: 0x0088aa, group: 'Booster' },
                    { id: 'grid-fins', name: 'Grid Fins', desc: 'Titanium aerodynamic control surfaces for precision landing.', color: 0x006688, group: 'Booster' },
                    { id: 'engine-bell', name: 'Engine Bells', desc: '9 Merlin 1D engines with gimbal capability ±5°.', color: 0xff6600, group: 'Propulsion' },
                    { id: 'fuel-tanks', name: 'Fuel Tanks', desc: 'RP-1 kerosene + LOX. 410,000 kg propellant capacity.', color: 0xff4400, group: 'Propulsion' },
                ],
            },
            {
                id: 'proj-drone', name: 'QUAD DRONE', type: 'built-in',
                color: 0x00ff88, icon: '🛸',
                desc: 'Autonomous quadcopter with obstacle avoidance',
                parts: [
                    { id: 'frame', name: 'Main Frame', desc: 'Carbon fiber X-frame, 450mm wheelbase. Houses all electronics.', color: 0x333333, group: 'Structure' },
                    { id: 'top-plate', name: 'Top Plate', desc: 'Mounts flight controller and GPS module. Vibration-dampened.', color: 0x444444, group: 'Structure' },
                    { id: 'arm-fl', name: 'Front Left Arm', desc: 'Motor mount + ESC wiring. Integrated LED strip.', color: 0x00ff88, group: 'Arms' },
                    { id: 'arm-fr', name: 'Front Right Arm', desc: 'Motor mount + ESC wiring. Integrated LED strip.', color: 0x00ff88, group: 'Arms' },
                    { id: 'arm-bl', name: 'Back Left Arm', desc: 'Motor mount + ESC wiring. Integrated LED strip.', color: 0x00ff88, group: 'Arms' },
                    { id: 'arm-br', name: 'Back Right Arm', desc: 'Motor mount + ESC wiring. Integrated LED strip.', color: 0x00ff88, group: 'Arms' },
                    { id: 'motor', name: 'Brushless Motors', desc: '4x 2300KV motors. 5045 props. 1.2kg thrust each.', color: 0x666666, group: 'Propulsion' },
                    { id: 'prop', name: 'Propellers', desc: '5-inch tri-blade props. Self-tightening.', color: 0x888888, group: 'Propulsion' },
                    { id: 'battery', name: 'LiPo Battery', desc: '4S 1500mAh 100C. ~8 min flight time.', color: 0xff4444, group: 'Power' },
                    { id: 'fc', name: 'Flight Controller', desc: 'F7 processor running Betaflight. Gyro + accelerometer.', color: 0x0088ff, group: 'Avionics' },
                    { id: 'gps', name: 'GPS Module', desc: 'u-blox M10. Dual constellation. 10Hz update rate.', color: 0x00aaff, group: 'Avionics' },
                    { id: 'camera', name: 'FPV Camera', desc: '1200TVL CMOS camera. 150° FOV. Low latency.', color: 0x222222, group: 'Avionics' },
                ],
            },
            {
                id: 'proj-robot', name: 'MECH SUIT', type: 'built-in',
                color: 0xff6600, icon: '🤖',
                desc: 'Powered exoskeleton for heavy-duty operations',
                parts: [
                    { id: 'helmet', name: 'Helmet Assembly', desc: 'AR visor with HUD. 270° camera array. Comms suite.', color: 0xff8800, group: 'Head' },
                    { id: 'torso', name: 'Torso Frame', desc: 'Titanium-alloy spine. Houses reactor and life support.', color: 0xcc6600, group: 'Core' },
                    { id: 'reactor', name: 'Arc Reactor', desc: 'Compact fusion reactor. 8GW output. Palladium core.', color: 0x00ddff, group: 'Core' },
                    { id: 'l-arm', name: 'Left Arm', desc: 'Hydraulic actuators. 2-ton lift capacity per arm.', color: 0xff6600, group: 'Limbs' },
                    { id: 'r-arm', name: 'Right Arm', desc: 'Weapon hardpoint. Integrated repulsor emitter.', color: 0xff6600, group: 'Limbs' },
                    { id: 'l-hand', name: 'Left Hand', desc: '5-finger manipulator. Haptic feedback. 500kg grip.', color: 0xff5500, group: 'Limbs' },
                    { id: 'r-hand', name: 'Right Hand', desc: 'Repulsor palm emitter. Concussive blast capable.', color: 0xff5500, group: 'Limbs' },
                    { id: 'l-leg', name: 'Left Leg', desc: 'Knee + ankle hydraulics. 30mph sprint.', color: 0xff6600, group: 'Legs' },
                    { id: 'r-leg', name: 'Right Leg', desc: 'Knee + ankle hydraulics. Shock absorbers.', color: 0xff6600, group: 'Legs' },
                    { id: 'thruster-l', name: 'Left Thruster', desc: 'Sub-orbital flight capable. Max Mach 3.', color: 0xffaa00, group: 'Flight' },
                    { id: 'thruster-r', name: 'Right Thruster', desc: 'Sub-orbital flight capable. Gimbal-mounted.', color: 0xffaa00, group: 'Flight' },
                    { id: 'boot-jet', name: 'Boot Jets', desc: 'VTOL thrust vectoring. Landing stabilization.', color: 0xff9900, group: 'Flight' },
                ],
            },
            {
                id: 'proj-sat', name: 'SATELLITE', type: 'built-in',
                color: 0xffff00, icon: '🛰️',
                desc: 'Communication satellite with solar arrays',
                parts: [
                    { id: 'bus', name: 'Satellite Bus', desc: 'Main structural body. Houses all subsystems.', color: 0xcccccc, group: 'Structure' },
                    { id: 'antenna-dish', name: 'Main Antenna', desc: '2.4m reflector dish. Ku-band. 10Gbps throughput.', color: 0xdddddd, group: 'Comms' },
                    { id: 'antenna-horn', name: 'Feed Horn', desc: 'Low-noise amplifier. Signal processing unit.', color: 0xbbbbbb, group: 'Comms' },
                    { id: 'solar-l', name: 'Left Solar Array', desc: 'GaAs triple-junction cells. 15kW output.', color: 0x0000aa, group: 'Power' },
                    { id: 'solar-r', name: 'Right Solar Array', desc: 'GaAs triple-junction cells. 15kW output.', color: 0x0000aa, group: 'Power' },
                    { id: 'battery-pak', name: 'Battery Pack', desc: 'Li-ion. 100kWh capacity. 15-year lifespan.', color: 0x444444, group: 'Power' },
                    { id: 'radiator', name: 'Thermal Radiator', desc: 'Heat pipe system. Maintains -10 to +40°C.', color: 0x888888, group: 'Thermal' },
                    { id: 'thruster-cluster', name: 'Ion Thrusters', desc: '4x Hall-effect thrusters. Station-keeping.', color: 0x4400ff, group: 'Propulsion' },
                    { id: 'fuel-tank-sat', name: 'Xenon Tank', desc: '150kg xenon propellant. 15-year station-keeping.', color: 0x666666, group: 'Propulsion' },
                ],
            },
            {
                id: 'proj-car', name: 'SPORTS CAR', type: 'built-in',
                color: 0xff0044, icon: '🏎️',
                desc: 'Electric hypercar with active aerodynamics',
                parts: [
                    { id: 'body', name: 'Carbon Body', desc: 'Full carbon fiber monocoque. 1,200kg total weight.', color: 0xff0044, group: 'Body' },
                    { id: 'hood', name: 'Active Hood', desc: 'Deployable air intake. Active cooling for battery.', color: 0xcc0033, group: 'Body' },
                    { id: 'spoiler', name: 'Active Spoiler', desc: 'Hydraulic wing. 0-70° adjustment. 800kg downforce.', color: 0xaa0022, group: 'Aero' },
                    { id: 'diffuser', name: 'Rear Diffuser', desc: 'Venturi tunnel design. Ground effect generation.', color: 0x880011, group: 'Aero' },
                    { id: 'wheel-fl', name: 'Front Left Wheel', desc: '20" forged magnesium. Michelin Pilot Sport Cup 2.', color: 0x333333, group: 'Wheels' },
                    { id: 'wheel-fr', name: 'Front Right Wheel', desc: '20" forged magnesium. Carbon ceramic brakes.', color: 0x333333, group: 'Wheels' },
                    { id: 'wheel-rl', name: 'Rear Left Wheel', desc: '21" forged magnesium. Carbon ceramic brakes.', color: 0x333333, group: 'Wheels' },
                    { id: 'wheel-rr', name: 'Rear Right Wheel', desc: '21" forged magnesium. Carbon ceramic brakes.', color: 0x333333, group: 'Wheels' },
                    { id: 'motor-f', name: 'Front Motor', desc: 'Permanent magnet. 350kW. Independent torque vectoring.', color: 0x00aaff, group: 'Drivetrain' },
                    { id: 'motor-r', name: 'Rear Motors', desc: '2x 500kW motors. 1,000kW combined. Direct drive.', color: 0x00aaff, group: 'Drivetrain' },
                    { id: 'battery-car', name: 'Battery Pack', desc: '100kWh solid-state. 800V architecture. 10min to 80%.', color: 0x00ff00, group: 'Drivetrain' },
                ],
            },
            {
                id: 'proj-sub', name: 'SUBMARINE', type: 'built-in',
                color: 0x0088aa, icon: '🔱',
                desc: 'Deep-sea research submarine',
                parts: [
                    { id: 'hull', name: 'Pressure Hull', desc: 'Titanium alloy. Rated to 11,000m depth.', color: 0x445566, group: 'Hull' },
                    { id: 'tower', name: 'Conning Tower', desc: 'Houses periscopes, masts, and antennas.', color: 0x556677, group: 'Hull' },
                    { id: 'ballast-f', name: 'Forward Ballast', desc: 'Compressed air blow system. 2000L capacity.', color: 0x334455, group: 'Buoyancy' },
                    { id: 'ballast-a', name: 'Aft Ballast', desc: 'Trim tanks for fine depth control.', color: 0x334455, group: 'Buoyancy' },
                    { id: 'prop-sub', name: 'Propulsor', desc: 'Pump-jet. Quieter than propeller. 5MW.', color: 0x666666, group: 'Propulsion' },
                    { id: 'thruster-sub', name: 'Maneuvering Thrusters', desc: '6x tunnel thrusters for precise positioning.', color: 0x555555, group: 'Propulsion' },
                    { id: 'sonar', name: 'Sonar Array', desc: 'Spherical bow array. Active/passive. 100km range.', color: 0x00ccaa, group: 'Sensors' },
                    { id: 'camera-sub', name: 'External Cameras', desc: '4K cameras with LED arrays. 360° coverage.', color: 0x222222, group: 'Sensors' },
                ],
            },
            {
                id: 'proj-station', name: 'SPACE STATION', type: 'built-in',
                color: 0xaabbff, icon: '🛸',
                desc: 'Modular orbital research station',
                parts: [
                    { id: 'core', name: 'Core Module', desc: 'Central hub. Life support, navigation, and crew quarters.', color: 0xccccdd, group: 'Core' },
                    { id: 'lab', name: 'Science Lab', desc: 'Microgravity research. 20 experiment racks.', color: 0xbbbbcc, group: 'Modules' },
                    { id: 'node', name: 'Docking Node', desc: '6 docking ports. International spacecraft compatible.', color: 0xaaaabb, group: 'Modules' },
                    { id: 'arm', name: 'Robotic Arm', desc: '17m Canadarm3. 116-ton payload manipulation.', color: 0x888888, group: 'Systems' },
                    { id: 'solar-station', name: 'Solar Wings', desc: '8 arrays. 240kW total. Sun-tracking.', color: 0x0044aa, group: 'Power' },
                    { id: 'radiator-station', name: 'Radiator Panels', desc: 'Ammonia loop heat rejection. 70kW capacity.', color: 0x999999, group: 'Thermal' },
                ],
            },
            {
                id: 'proj-tank', name: 'BATTLE TANK', type: 'built-in',
                color: 0x667744, icon: '🚜',
                desc: 'Next-generation main battle tank',
                parts: [
                    { id: 'turret', name: 'Turret', desc: 'Unmanned turret. 120mm smoothbore autoloader.', color: 0x556644, group: 'Firepower' },
                    { id: 'barrel', name: 'Gun Barrel', desc: 'L/55 smoothbore. 1,750 m/s muzzle velocity.', color: 0x445533, group: 'Firepower' },
                    { id: 'hull-tank', name: 'Hull', desc: 'Composite armor. ERA tiles. STANAG Level 6.', color: 0x667744, group: 'Protection' },
                    { id: 'reactive', name: 'Reactive Armor', desc: 'Explosive reactive tiles. Defeats HEAT and APFSDS.', color: 0x778855, group: 'Protection' },
                    { id: 'track-l', name: 'Left Track', desc: 'Rubber-padded. Hydrostatic drive. 70km/h road.', color: 0x333333, group: 'Mobility' },
                    { id: 'track-r', name: 'Right Track', desc: 'Independent drive. Pivot steering capable.', color: 0x333333, group: 'Mobility' },
                    { id: 'engine-tank', name: 'Turbine Engine', desc: '1,500hp gas turbine. Multi-fuel capable.', color: 0x884400, group: 'Mobility' },
                ],
            },
            {
                id: 'proj-plane', name: 'STEALTH JET', type: 'built-in',
                color: 0x555566, icon: '✈️',
                desc: '5th generation stealth fighter',
                parts: [
                    { id: 'fuselage', name: 'Fuselage', desc: 'Radar-absorbing composite. Internal weapons bay.', color: 0x555566, group: 'Airframe' },
                    { id: 'wing-l', name: 'Left Wing', desc: 'Blended wing-body. All-moving control surfaces.', color: 0x666677, group: 'Airframe' },
                    { id: 'wing-r', name: 'Right Wing', desc: 'Blended wing-body. Missile hardpoints internal.', color: 0x666677, group: 'Airframe' },
                    { id: 'tail-v', name: 'Vertical Stabilizers', desc: 'Canted twin tails. Reduced radar cross-section.', color: 0x444455, group: 'Airframe' },
                    { id: 'intake', name: 'Engine Intakes', desc: 'S-duct intakes hide compressor face from radar.', color: 0x333344, group: 'Propulsion' },
                    { id: 'engine-jet', name: 'Turbofan Engines', desc: '2x afterburning turbofans. Supercruise Mach 1.8.', color: 0x664422, group: 'Propulsion' },
                    { id: 'nozzle', name: 'Thrust Vectoring', desc: '3D vectoring nozzles. ±20° pitch and yaw.', color: 0x775533, group: 'Propulsion' },
                    { id: 'radar', name: 'AESA Radar', desc: 'Active electronically scanned array. 400km detection.', color: 0x00aaff, group: 'Avionics' },
                    { id: 'cockpit', name: 'Cockpit', desc: 'Helmet-mounted display. Voice control. Voice AI.', color: 0x222233, group: 'Avionics' },
                ],
            },
        ];
    }

    // ═══════════════════════════════════════════════════════════
    // THREE.JS SCENE
    // ═══════════════════════════════════════════════════════════
    let scene, camera, renderer, particles, gridLines, clock;
    let uploadScene, uploadCamera, uploadRenderer, uploadModel;

    function initThree() {
        clock = new THREE.Clock();
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 8, 12);
        camera.lookAt(0, 0, 0);

        const canvas = document.getElementById('three-canvas');
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) {
            console.warn('WebGL not available, 3D background disabled');
            return;
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0a0a12, 1);

        // Grid
        const gridGeo = new THREE.BufferGeometry();
        const gv = [];
        const s = 40, d = 40, st = s / d, h = s / 2;
        for (let i = 0; i <= d; i++) { const p = -h + i * st; gv.push(-h,-2,p, h,-2,p, p,-2,-h, p,-2,h); }
        gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gv, 3));
        gridLines = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.08 }));
        scene.add(gridLines);

        // Particles
        const pCount = 1200;
        const pPos = new Float32Array(pCount * 3);
        const pVel = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount; i++) {
            pPos[i*3] = (Math.random()-0.5)*50; pPos[i*3+1] = Math.random()*25-2; pPos[i*3+2] = (Math.random()-0.5)*50;
            pVel[i*3] = (Math.random()-0.5)*0.01; pVel[i*3+1] = Math.random()*0.02+0.005; pVel[i*3+2] = (Math.random()-0.5)*0.01;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x00d4ff, size: 0.06, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        particles._vel = pVel;
        scene.add(particles);

        // Rings
        for (let i = 1; i <= 5; i++) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(i*2-0.02, i*2+0.02, 64),
                new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })
            );
            ring.rotation.x = -Math.PI/2; ring.position.y = -1.9;
            scene.add(ring);
        }

        // Lights
        scene.add(new THREE.AmbientLight(0x00d4ff, 0.3));
        const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(5,10,5); scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0xff8800, 0.15); dl2.position.set(-5,3,-5); scene.add(dl2);

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    function animate() {
        requestAnimationFrame(animate);
        if (!renderer) return;
        const t = clock.getElapsedTime();

        // Particles
        const pos = particles.geometry.attributes.position.array;
        const vel = particles._vel;
        for (let i = 0; i < pos.length; i += 3) {
            pos[i] += vel[i]; pos[i+1] += vel[i+1]; pos[i+2] += vel[i+2];
            if (pos[i+1] > 25) { pos[i+1] = -2; pos[i] = (Math.random()-0.5)*50; pos[i+2] = (Math.random()-0.5)*50; }
        }
        particles.geometry.attributes.position.needsUpdate = true;

        camera.position.x = Math.sin(t*0.1)*0.5;
        camera.position.y = 8 + Math.sin(t*0.15)*0.3;
        camera.lookAt(0, 0, 0);

        gridLines.material.opacity = 0.06 + Math.sin(t*0.5)*0.02;
        renderer.render(scene, camera);
    }

    // Upload preview renderer
    function initUploadRenderer() {
        const canvas = document.getElementById('upload-canvas');
        if (!canvas) return;
        let uRenderer;
        try {
            uRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) { return; }
        uploadScene = new THREE.Scene();
        uploadCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        uploadCamera.position.set(5, 3, 5);
        uploadCamera.lookAt(0, 0, 0);
        uploadRenderer = uRenderer;
        uploadRenderer.setSize(300, 300);
        uploadRenderer.setClearColor(0x000000, 0);

        uploadScene.add(new THREE.AmbientLight(0xffffff, 0.3));
        const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(5,10,5); uploadScene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x00d4ff, 0.25); dl2.position.set(-5,3,-5); uploadScene.add(dl2);
    }

    function animateUpload() {
        if (!uploadRenderer) return;
        requestAnimationFrame(animateUpload);
        if (uploadModel) uploadModel.rotation.y += 0.005;
        uploadRenderer.render(uploadScene, uploadCamera);
    }

    // ═══════════════════════════════════════════════════════════
    // FACE SCAN
    // ═══════════════════════════════════════════════════════════
    async function initFaceScan() {
        const statusEl = document.getElementById('scan-status');
        const bar = document.getElementById('scan-progress-bar');
        const video = document.getElementById('face-video');

        try {
            // Step 1: Load models
            statusEl.textContent = 'Loading face models...';
            bar.style.width = '10%';

            try {
                await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
                bar.style.width = '25%';
                await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
                bar.style.width = '40%';
            } catch (modelErr) {
                console.error('Model load failed:', modelErr);
                statusEl.textContent = 'Model load failed — guest mode';
                bar.style.width = '100%';
                setTimeout(transitionToMain, 1500);
                return;
            }

            // Step 2: Access camera
            statusEl.textContent = 'Accessing camera...';
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 280, height: 280, facingMode: 'user' },
                });
            } catch (camErr) {
                console.warn('Camera denied:', camErr);
                statusEl.textContent = 'Camera denied — guest mode';
                bar.style.width = '100%';
                setTimeout(transitionToMain, 1500);
                return;
            }

            video.srcObject = stream;
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = resolve;
                video.onerror = reject;
                setTimeout(resolve, 3000); // timeout fallback
            });
            await video.play();
            bar.style.width = '60%';

            // Step 3: Detect face (try up to 40 times = 10 seconds)
            statusEl.textContent = 'Scanning face — look at camera...';
            let detection = null;
            const maxAttempts = 40;

            for (let i = 0; i < maxAttempts && !detection; i++) {
                try {
                    detection = await faceapi
                        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
                        .withFaceLandmarks();
                } catch (detectErr) {
                    // Skip failed detection frames
                }
                bar.style.width = (60 + (i / maxAttempts) * 35) + '%';

                if (!detection) {
                    // Update status with dots animation
                    const dots = '.'.repeat((i % 3) + 1);
                    statusEl.textContent = `Scanning face${dots}`;
                    await new Promise(r => setTimeout(r, 250));
                }
            }

            // Step 4: Process result
            if (detection) {
                statusEl.textContent = 'Face detected — generating ID...';
                bar.style.width = '95%';

                const lm = detection.landmarks.positions;
                const emb = lm.map(p => [p.x / 280, p.y / 280]).flat();

                // Check returning user
                const existing = await db.getAll('faces');
                let userId = null;
                let bestSim = 0;

                for (const face of existing) {
                    const sim = cosineSim(emb, face.embedding);
                    if (sim > bestSim) {
                        bestSim = sim;
                        userId = face.id;
                    }
                }

                if (bestSim > 0.85) {
                    statusEl.textContent = `Welcome back, ${userId.slice(0, 8)}!`;
                    state.faceData = { id: userId, embedding: emb, returning: true };
                    document.getElementById('hud-user').textContent = userId.slice(0, 8).toUpperCase();
                } else {
                    userId = crypto.randomUUID();
                    await db.put('faces', { id: userId, embedding: emb, created: Date.now() });
                    statusEl.textContent = `Identity registered: ${userId.slice(0, 8)}`;
                    state.faceData = { id: userId, embedding: emb, returning: false };
                    document.getElementById('hud-user').textContent = userId.slice(0, 8).toUpperCase();
                }

                bar.style.width = '100%';
                // Play scan sound
                if (window.JarvisSounds) JarvisSounds.scan();
            } else {
                statusEl.textContent = 'No face detected — guest mode';
                bar.style.width = '100%';
            }

            // Step 5: Cleanup camera
            stream.getTracks().forEach(t => t.stop());

            // Step 6: Transition
            setTimeout(transitionToMain, 1500);

        } catch (err) {
            console.error('Face scan error:', err);
            statusEl.textContent = 'Scan error — guest mode';
            bar.style.width = '100%';
            setTimeout(transitionToMain, 1500);
        }
    }

    function cosineSim(a, b) {
        if (a.length !== b.length) return 0;
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
    }

    function transitionToMain() {
        const ls = document.getElementById('loading-screen');
        const mi = document.getElementById('main-interface');
        ls.style.opacity = '0';
        setTimeout(() => {
            ls.style.display = 'none';
            mi.classList.remove('hidden');
            mi.style.opacity = '1';
            initAllSections();
        }, 1000);
    }

    // ═══════════════════════════════════════════════════════════
    // DRAGGABLE
    // ═══════════════════════════════════════════════════════════
    function makeDraggable(el) {
        let dragging = false, sx, sy, ox, oy;
        const start = (ex, ey) => {
            dragging = true; sx = ex; sy = ey;
            const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
            el.style.position = 'fixed'; el.style.transition = 'none';
        };
        const move = (ex, ey) => {
            if (!dragging) return;
            el.style.left = (ox + ex - sx) + 'px';
            el.style.top = (oy + ey - sy) + 'px';
            el.style.right = 'auto'; el.style.transform = 'none';
        };
        const end = () => { if (dragging) { dragging = false; savePos(el); } };

        el.addEventListener('mousedown', e => { if (e.target.closest('.nav-item')) { start(e.clientX, e.clientY); e.preventDefault(); } });
        document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
        document.addEventListener('mouseup', end);
        el.addEventListener('touchstart', e => { if (e.target.closest('.nav-item')) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        el.addEventListener('touchmove', e => { if (dragging) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        el.addEventListener('touchend', end);
    }

    async function savePos(el) {
        const r = el.getBoundingClientRect();
        await db.put('navPositions', { id: el.id, left: r.left, top: r.top, saved: true });
    }

    async function restorePos(el) {
        const p = await db.get('navPositions', el.id);
        if (p?.saved) {
            el.style.position = 'fixed';
            el.style.left = p.left + 'px'; el.style.top = p.top + 'px';
            el.style.right = 'auto'; el.style.transform = 'none';
        }
    }

    // ═══════════════════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════════════════
    function initAllSections() {
        const nav = document.getElementById('floating-nav');
        makeDraggable(nav);
        restorePos(nav);

        state.projects = getDemoProjects();
        loadUserProjects();
        renderProjectGrid();
        initNavButtons();
        initExploder();
        initAPISection();
        initRoomSection();
        initGestureSection();
        initUploadSection();
        initAIChat();
        initScreenshot();
        initThemeEngine();
        initCompareSection();
        initMeasurement();
        initShareExport();
        initPWA();

        // Initialize sounds on first user interaction
        document.addEventListener('click', () => {
            JarvisSounds.init();
            JarvisSounds.startAmbient();
        }, { once: true });

        // Initialize search
        JarvisSearch.initSearch((type, data) => {
            if (type === 'project') {
                JarvisSounds.explode();
                openExploder(data);
            } else if (type === 'part') {
                JarvisSounds.explode();
                openExploder(data.project);
                setTimeout(() => {
                    // Find and click the part in the new 3D interactive view
                    const mesh = exploderFlatParts.find(m => m.userData.partId === data.part.id);
                    if (mesh) handlePartClick(mesh);
                }, 300);
            } else if (type === 'section') {
                JarvisSounds.navigate();
                showSection(data);
            }
        });

        // Initialize keyboard shortcuts
        JarvisSearch.initKeyboard({
            home: () => { JarvisSounds.navigate(); showSection('home'); },
            api: () => { JarvisSounds.navigate(); showSection('api'); },
            room: () => { JarvisSounds.navigate(); showSection('room'); },
            gesture: () => { JarvisSounds.navigate(); showSection('gesture'); },
            upload: () => { JarvisSounds.navigate(); showSection('upload'); },
            compare: () => { JarvisSounds.navigate(); showSection('compare'); },
            screenshot: () => { takeScreenshot(); },
            back: () => {
                if (state.selectedProject) {
                    state.selectedProject = null;
                    state.selectedPart = null;
                    showSection('home');
                }
            },
        });

        // Load annotations
        JarvisSearch.loadAnnotations();

        showSection('home');
    }

    // Expose projects for search
    window._jarvisProjects = state.projects;
    window._jarvisDB = db;
    window.getDemoProjects = getDemoProjects;

    function initNavButtons() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                logAction('nav_click', section);
                JarvisSounds.navigate();
                showSection(section);
            });

            // Hover sound
            btn.addEventListener('mouseenter', () => JarvisSounds.hover());
        });
    }

    function stopAllCardAnimations() {
        document.querySelectorAll('.card-canvas').forEach(canvas => {
            if (canvas._stopAnim) canvas._stopAnim();
        });
    }

    function showSection(name) {
        state.currentSection = name;
        document.getElementById('hud-section').textContent = name.toUpperCase();
        document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
        document.querySelectorAll('.section-view').forEach(v => v.classList.add('hidden'));
        const el = document.getElementById(name === 'home' ? 'project-grid' : name + '-section');
        if (el) el.classList.remove('hidden');
        if (name === 'home') {
            document.getElementById('project-grid').classList.remove('hidden');
            // Restart card animations when returning home
            state.projects.forEach((proj, i) => setTimeout(() => initCardPreview(proj), i * 50));
        } else {
            // Stop card animations when leaving home
            stopAllCardAnimations();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PROJECT GRID
    // ═══════════════════════════════════════════════════════════
    function renderProjectGrid() {
        const container = document.getElementById('grid-container');
        container.innerHTML = '';

        state.projects.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <canvas class="card-canvas" id="card-canvas-${proj.id}"></canvas>
                <div class="card-info">
                    <div class="card-name">${proj.icon} ${proj.name}</div>
                    <div class="card-meta">${proj.parts.length} parts · ${proj.desc}</div>
                </div>
                <span class="card-badge ${proj.type === 'user' ? 'user' : ''}">${proj.type === 'user' ? 'UPLOADED' : 'BUILT-IN'}</span>
                ${proj.type === 'user' ? '<button class="card-delete" title="Delete project">✕</button>' : ''}
            `;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-delete')) return; // Don't open exploder when clicking delete
                logAction('project_open', proj.name);
                JarvisSounds.explode();
                openExploder(proj);
            });
            card.addEventListener('mouseenter', () => JarvisSounds.hover());

            // Delete handler for uploaded projects
            if (proj.type === 'user') {
                const deleteBtn = card.querySelector('.card-delete');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const confirmed = await holoConfirm(`Delete "${proj.name}"? This cannot be undone.`);
                    if (confirmed) {
                        await db.del('projects', proj.id);
                        state.projects = state.projects.filter(p => p.id !== proj.id);
                        window._jarvisProjects = state.projects;
                        renderProjectGrid();
                        JarvisSounds.success();
                    }
                });
            }

            container.appendChild(card);

            // Mini 3D preview
            setTimeout(() => initCardPreview(proj), 100);
        });
    }

    function initCardPreview(proj) {
        const canvas = document.getElementById(`card-canvas-${proj.id}`);
        if (!canvas) return;
        const w = canvas.clientWidth || 200;
        const h = canvas.clientHeight || 150;
        let miniRenderer;
        try {
            miniRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) { return; }
        const miniScene = new THREE.Scene();
        const miniCam = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        miniCam.position.set(0, 2, 5);
        miniCam.lookAt(0, 0, 0);
        miniRenderer.setSize(w, h);
        miniRenderer.setClearColor(0x000000, 0);

        miniScene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3,5,3); miniScene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x00d4ff, 0.3); dl2.position.set(-3,2,-3); miniScene.add(dl2);
        const dl3 = new THREE.DirectionalLight(0xff6600, 0.2); dl3.position.set(-2,1,4); miniScene.add(dl3);

        // Build real geometry model for this project
        let model;
        try {
            model = JarvisGeometries.buildCardModel(proj.id);
        } catch (e) {
            // Fallback: simple colored boxes
            model = new THREE.Group();
            proj.parts.forEach((part, i) => {
                const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                const mat = new THREE.MeshPhongMaterial({ color: part.color, transparent: true, opacity: 0.85 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set((i % 3 - 1) * 0.5, (Math.floor(i / 3) - 1) * 0.5, 0);
                model.add(mesh);
            });
        }
        miniScene.add(model);

        let frameId;
        function animateCard() {
            frameId = requestAnimationFrame(animateCard);
            model.rotation.y += 0.008;
            miniRenderer.render(miniScene, miniCam);
        }
        animateCard();
        canvas._stopAnim = () => cancelAnimationFrame(frameId);
    }

    // ═══════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════
    // INTERACTIVE 3D PART EXPLODER
    // ═══════════════════════════════════════════════════════════
    let exploderRenderer, exploderScene, exploderCamera;
    let exploderModel = null;
    let exploderFlatParts = [];
    let exploderRaycaster, exploderMouse;
    let exploderHovered = null;
    let exploderSelected = null;
    let exploderAnimId = null;
    let exploderDragging = false;
    let exploderPrevMouse = { x: 0, y: 0 };
    let exploderRotation = { x: 0, y: 0 };
    let exploderBreadcrumb = [];
    // Smooth animation targets
    let exploderCamTarget = new THREE.Vector3(0, 2, 6);
    let exploderRotTarget = { x: 0, y: 0 };
    let exploderAutoRotateSpeed = 0.002;
    let exploderExploded = false;
    let exploderExplodeProgress = 0; // 0 = assembled, 1 = exploded
    let exploderHoverScale = {}; // partId -> current scale
    let exploderCameraShake = { x: 0, y: 0, intensity: 0 };

    function initExploder() {
        document.getElementById('exploder-back').addEventListener('click', () => {
            if (exploderBreadcrumb.length > 0) {
                exploderBreadcrumb.pop();
                const top = exploderBreadcrumb.length > 0 ? exploderBreadcrumb[exploderBreadcrumb.length - 1] : null;
                if (top && top.id) {
                    drillIntoPartById(top.id);
                } else {
                    rebuildExploderModel(state.selectedProject);
                }
            } else {
                state.selectedProject = null;
                state.selectedPart = null;
                showSection('home');
            }
        });

        // Explode/Assemble button
        document.getElementById('btn-explode').addEventListener('click', () => {
            triggerExplodeToggle();
            document.getElementById('btn-explode').textContent = exploderExploded ? '🔧 Assemble' : '💥 Explode';
        });

        // Reset view button
        document.getElementById('btn-reset-view').addEventListener('click', () => {
            exploderRotation = { x: 0, y: 0 }; exploderRotTarget = { x: 0, y: 0 }; exploderExploded = false; exploderExplodeProgress = 0;
            exploderCamTarget.set(0, 2, 6);
            document.getElementById('btn-explode').textContent = '💥 Explode';
            document.getElementById('exploder-hint').textContent = '🖱️ View reset!';
            if (exploderBreadcrumb.length > 0) {
                rebuildExploderModel(state.selectedProject);
                exploderBreadcrumb = [];
                updateBreadcrumbDisplay();
            }
        });

        // X-Ray mode button
        document.getElementById('btn-xray').addEventListener('click', () => {
            const isXray = document.getElementById('btn-xray').classList.toggle('active');
            exploderFlatParts.forEach(m => {
                if (m.material) {
                    if (isXray) {
                        m.material.transparent = true;
                        m.material.opacity = 0.25;
                        m.material.wireframe = true;
                    } else {
                        m.material.transparent = m.userData.hasChildren;
                        m.material.opacity = m.userData.hasChildren ? 0.92 : 1;
                        m.material.wireframe = false;
                    }
                }
            });
            document.getElementById('exploder-hint').textContent = isXray ? '👁️ X-Ray: wireframe mode — click parts to inspect' : '🖱️ Normal mode';
        });
    }

    function initExploderRenderer() {
        const canvas = document.getElementById('part-detail-canvas');
        if (!canvas || exploderRenderer) return;
        try {
            exploderRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (e) { return; }

        exploderScene = new THREE.Scene();
        exploderCamera = new THREE.PerspectiveCamera(50, canvas.clientWidth / Math.max(canvas.clientHeight, 300), 0.1, 100);
        exploderCamTarget.set(0, 2, 6);
        exploderCamera.lookAt(0, 0, 0);
        exploderRenderer.setSize(canvas.clientWidth, Math.max(canvas.clientHeight, 300));
        exploderRenderer.setClearColor(0x0a0a12, 1);

        exploderScene.add(new THREE.AmbientLight(0xffffff, 0.35));
        const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(5, 8, 5); exploderScene.add(key);
        const fill = new THREE.DirectionalLight(0x00d4ff, 0.3); fill.position.set(-5, 3, -5); exploderScene.add(fill);
        const rim = new THREE.PointLight(0xff6600, 0.25, 15); rim.position.set(0, -5, 3); exploderScene.add(rim);

        const gridGeo = new THREE.BufferGeometry();
        const gv = [];
        const s = 10, d = 20, st = s / d, h = s / 2;
        for (let i = 0; i <= d; i++) { const p = -h + i * st; gv.push(-h, -2, p, h, -2, p, p, -2, -h, p, -2, h); }
        gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gv, 3));
        exploderScene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.06 })));

        exploderRaycaster = new THREE.Raycaster();
        exploderMouse = new THREE.Vector2();

        canvas.addEventListener('mousedown', (e) => { exploderDragging = true; exploderPrevMouse = { x: e.clientX, y: e.clientY }; });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            exploderMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            exploderMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            if (exploderDragging) {
                exploderRotation.y += (e.clientX - exploderPrevMouse.x) * 0.005;
                exploderRotation.x += (e.clientY - exploderPrevMouse.y) * 0.005;
                exploderRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, exploderRotation.x));
                exploderPrevMouse = { x: e.clientX, y: e.clientY };
            }
            updateExploderHover(e);
        });
        canvas.addEventListener('mouseup', () => { exploderDragging = false; });
        canvas.addEventListener('mouseleave', () => { exploderDragging = false; hideTooltip(); });
        canvas.addEventListener('click', () => {
            if (measureMode && exploderHovered) {
                // Get intersection point for measurement
                exploderRaycaster.setFromCamera(exploderMouse, exploderCamera);
                const intersects = exploderRaycaster.intersectObjects(exploderFlatParts, false);
                if (intersects.length > 0) handleMeasureClick(intersects[0]);
                return;
            }
            if (exploderHovered) handlePartClick(exploderHovered);
        });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            exploderCamera.position.multiplyScalar(1 + e.deltaY * 0.002);
            const dist = exploderCamera.position.length();
            if (dist < 2) exploderCamera.position.setLength(2);
            if (dist > 15) exploderCamera.position.setLength(15);
        }, { passive: false });

        new ResizeObserver(() => {
            const w = canvas.clientWidth, h = Math.max(canvas.clientHeight, 300);
            exploderCamera.aspect = w / h;
            exploderCamera.updateProjectionMatrix();
            exploderRenderer.setSize(w, h);
        }).observe(canvas);
    }

    function updateExploderHover(e) {
        if (!exploderFlatParts.length) return;
        exploderRaycaster.setFromCamera(exploderMouse, exploderCamera);
        const intersects = exploderRaycaster.intersectObjects(exploderFlatParts, false);
        if (exploderHovered && exploderHovered !== exploderSelected) resetMeshHighlight(exploderHovered);
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            if (mesh.userData.partId) {
                exploderHovered = mesh;
                highlightMesh(mesh, false);
                showTooltip(e, mesh.userData);
                const hint = document.getElementById('exploder-hint');
                hint.textContent = mesh.userData.hasChildren
                    ? 'Click "' + mesh.userData.partName + '" to explore ' + mesh.userData.childCount + ' sub-parts'
                    : mesh.userData.partName;
                document.body.style.cursor = 'pointer';
            }
        } else {
            exploderHovered = null;
            document.getElementById('exploder-hint').textContent = 'Click any part to explore - Drag to rotate';
            document.body.style.cursor = 'default';
            hideTooltip();
        }
    }

    function highlightMesh(mesh, isSelected) {
        if (!mesh.material) return;
        mesh.material.emissiveIntensity = isSelected ? 0.5 : 0.25;
        // Scale up on hover
        exploderHoverScale[mesh.userData.partId] = isSelected ? 1.08 : 1.04;
    }
    function resetMeshHighlight(mesh) {
        if (!mesh.material) return;
        mesh.material.emissiveIntensity = 0.05;
        // Scale back to normal
        exploderHoverScale[mesh.userData.partId] = 1;
    }

    function showTooltip(e, data) {
        const tooltip = document.getElementById('part-tooltip');
        tooltip.classList.remove('hidden');
        const ci = data.hasChildren ? ' - ' + data.childCount + ' sub-parts' : '';
        tooltip.innerHTML = '<strong>' + data.partName + '</strong>' + ci + '<br><span style="color:#888;font-size:11px">' + data.partDesc.slice(0, 80) + '</span>';
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
    }
    function hideTooltip() { document.getElementById('part-tooltip').classList.add('hidden'); }

    function handlePartClick(mesh) {
        const data = mesh.userData;
        logAction('part_click', data.partName);
        JarvisSounds.explode();
        if (exploderSelected) resetMeshHighlight(exploderSelected);
        if (data.hasChildren) {
            exploderBreadcrumb.push({ mesh: mesh, id: data.partId, name: data.partName, desc: data.partDesc });
            drillIntoPartById(data.partId);
        } else {
            exploderSelected = mesh;
            highlightMesh(mesh, true);
            showPartInfo(data);
        }
        updateBreadcrumbDisplay();
    }

    function drillIntoPartById(partId) {
        const projId = state.selectedProject?.id;
        const modelDef = window.JarvisModelBuilder?.PROJECT_MODELS[projId];
        if (!modelDef) return;
        const partDef = findPartDef(modelDef.parts, partId);
        if (!partDef) return;

        const parentGroup = new THREE.Group();
        exploderFlatParts = [];

        if (partDef.children) {
            partDef.children.forEach(cd => {
                if (!cd.build) return;
                const geo = cd.build();
                const color = cd.color || 0x00d4ff;
                const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.25, emissive: color, emissiveIntensity: 0.05 });
                const m = new THREE.Mesh(geo, mat);
                if (cd.pos) m.position.set(cd.pos[0], cd.pos[1], cd.pos[2]);
                if (cd.rot) m.rotation.set(cd.rot[0], cd.rot[1], cd.rot[2]);
                m.userData = {
                    partId: cd.id, partName: cd.name, partDesc: cd.desc || '', partGroup: cd.group || '',
                    hasChildren: !!(cd.children && cd.children.length),
                    childCount: cd.children ? cd.children.length : 0, originalColor: color,
                };
                parentGroup.add(m);
                exploderFlatParts.push(m);
            });
        }

        const box = new THREE.Box3().setFromObject(parentGroup);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            parentGroup.scale.setScalar(3 / maxDim);
            const nb = new THREE.Box3().setFromObject(parentGroup);
            parentGroup.position.sub(nb.getCenter(new THREE.Vector3()));
        }

        if (exploderModel) exploderScene.remove(exploderModel);
        exploderModel = parentGroup;
        exploderScene.add(exploderModel);
        exploderRotation = { x: 0, y: 0 }; exploderRotTarget = { x: 0, y: 0 }; exploderExploded = false; exploderExplodeProgress = 0;
        showPartInfo({ partId: partDef.id, partName: partDef.name, partDesc: partDef.desc || '' });
        renderSidePanel(partId);
    }

    function findPartDef(parts, id) {
        for (const p of parts) {
            if (p.id === id) return p;
            if (p.children) { const f = findPartDef(p.children, id); if (f) return f; }
        }
        return null;
    }

    function rebuildExploderModel(proj) {
        if (!window.JarvisModelBuilder) return;
        if (exploderModel) exploderScene.remove(exploderModel);
        exploderHovered = null; exploderSelected = null;
        const { group, flatParts } = window.JarvisModelBuilder.buildAssembledModel(proj.id);
        exploderModel = group;
        exploderFlatParts = flatParts;
        exploderScene.add(exploderModel);
        exploderRotation = { x: 0, y: 0 }; exploderRotTarget = { x: 0, y: 0 }; exploderExploded = false; exploderExplodeProgress = 0;
        exploderCamTarget.set(0, 2, 6);
        exploderCamera.lookAt(0, 0, 0);
        renderSidePanel(null);
        document.getElementById('part-detail-name').textContent = proj.icon + ' ' + proj.name;
        document.getElementById('part-detail-desc').textContent = proj.desc;
        if (exploderAnimId) cancelAnimationFrame(exploderAnimId);
        animateExploder();
    }

    function animateExploder() {
        exploderAnimId = requestAnimationFrame(animateExploder);
        if (!exploderRenderer || !exploderModel) return;

        const dt = 0.06; // Lerp factor for smooth transitions

        // Smooth rotation (lerp toward target)
        exploderRotation.x += (exploderRotTarget.x - exploderRotation.x) * dt;
        exploderRotation.y += (exploderRotTarget.y - exploderRotation.y) * dt;

        exploderModel.rotation.y = exploderRotation.y;
        exploderModel.rotation.x = exploderRotation.x;

        // Auto-rotate with easing (slower when recently dragged)
        if (!exploderDragging) {
            exploderRotTarget.y += exploderAutoRotateSpeed;
        }

        // Smooth camera position
        exploderCamera.position.lerp(exploderCamTarget, dt * 0.5);

        // Camera shake (for impact effects)
        if (exploderCameraShake.intensity > 0.01) {
            exploderCamera.position.x += (Math.random() - 0.5) * exploderCameraShake.intensity;
            exploderCamera.position.y += (Math.random() - 0.5) * exploderCameraShake.intensity;
            exploderCameraShake.intensity *= 0.9; // Decay
        }

        // Smooth explode/assemble animation
        if (exploderExploded && exploderExplodeProgress < 1) {
            exploderExplodeProgress = Math.min(1, exploderExplodeProgress + 0.02);
            updateExplodePositions();
        } else if (!exploderExploded && exploderExplodeProgress > 0) {
            exploderExplodeProgress = Math.max(0, exploderExplodeProgress - 0.02);
            updateExplodePositions();
        }

        // Hover scale animation
        exploderFlatParts.forEach(m => {
            const id = m.userData.partId;
            const targetScale = exploderHoverScale[id] || 1;
            const currentScale = m.scale.x;
            if (Math.abs(currentScale - targetScale) > 0.001) {
                const newScale = currentScale + (targetScale - currentScale) * 0.15;
                m.scale.setScalar(newScale);
            }
        });

        exploderRenderer.render(exploderScene, exploderCamera);
    }

    function updateExplodePositions() {
        if (!exploderModel) return;
        const t = exploderExplodeProgress;
        // Use easing for smooth animation
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        exploderModel.children.forEach(child => {
            if (!child.userData._origPos) {
                child.userData._origPos = child.position.clone();
                // Calculate explode direction (away from center)
                const dir = child.position.clone();
                if (dir.length() < 0.01) {
                    dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
                }
                dir.normalize();
                child.userData._explodeDir = dir;
                child.userData._explodeDist = 1.2 + Math.random() * 0.8;
            }

            const orig = child.userData._origPos;
            const dir = child.userData._explodeDir;
            const dist = child.userData._explodeDist;

            child.position.lerpVectors(
                orig,
                orig.clone().add(dir.clone().multiplyScalar(dist)),
                ease
            );
        });
    }

    function triggerExplodeToggle() {
        exploderExploded = !exploderExploded;
        // Reset orig positions for new animation
        if (exploderModel) {
            exploderModel.children.forEach(child => {
                if (exploderExploded) {
                    // Save current position as origin before exploding
                    child.userData._origPos = child.position.clone();
                    const dir = child.position.clone();
                    if (dir.length() < 0.01) dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
                    dir.normalize();
                    child.userData._explodeDir = dir;
                    child.userData._explodeDist = 1.2 + Math.random() * 0.8;
                }
            });
        }
        // Camera shake on explode
        exploderCameraShake.intensity = 0.15;
        JarvisSounds.explode();
        document.getElementById('exploder-hint').textContent = exploderExploded ? '💥 Exploded! Drag to rotate · Click parts to inspect' : '🔧 Assembled!';
    }

    function openExploder(proj) {
        state.selectedProject = proj;
        state.selectedPart = null;
        exploderBreadcrumb = [];
        stopAllCardAnimations();
        document.querySelectorAll('.section-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('exploder-view').classList.remove('hidden');
        document.getElementById('exploder-project-name').textContent = proj.icon + ' ' + proj.name;
        initExploderRenderer();
        rebuildExploderModel(proj);
        updateBreadcrumbDisplay();
    }

    function showPartInfo(data) {
        document.getElementById('part-detail-name').textContent = data.partName;
        document.getElementById('part-detail-desc').textContent = data.partDesc;
        const detailInfo = document.getElementById('part-detail-info');
        const oldAnn = detailInfo.querySelector('.annotation-wrapper');
        if (oldAnn) oldAnn.remove();
        JarvisSearch.createAnnotationUI(data.partId, detailInfo);
    }

    function renderSidePanel(focusPartId) {
        const leftEl = document.getElementById('exploder-parts-left');
        const rightEl = document.getElementById('exploder-parts-right');
        leftEl.innerHTML = ''; rightEl.innerHTML = '';
        if (!state.selectedProject) return;
        const projId = state.selectedProject.id;
        const modelDef = window.JarvisModelBuilder?.PROJECT_MODELS[projId];
        if (!modelDef) return;
        let partsToShow = modelDef.parts;
        if (focusPartId) {
            const pd = findPartDef(modelDef.parts, focusPartId);
            if (pd && pd.children) partsToShow = pd.children;
        }
        const groups = {};
        partsToShow.forEach(p => { const g = p.group || 'Other'; if (!groups[g]) groups[g] = []; groups[g].push(p); });
        const groupNames = Object.keys(groups);
        const half = Math.ceil(groupNames.length / 2);
        groupNames.forEach((gName, gi) => {
            const target = gi < half ? leftEl : rightEl;
            const groupEl = document.createElement('div');
            groupEl.className = 'part-group';
            const header = document.createElement('div');
            header.className = 'part-group-header';
            header.textContent = gName;
            groupEl.appendChild(header);
            groups[gName].forEach((part, pi) => {
                const hasChildren = part.children && part.children.length > 0;
                const icon = document.createElement('div');
                icon.className = 'part-icon';
                icon.style.animationDelay = (pi * 0.05) + 's';
                const colorHex = (part.color || 0x00d4ff).toString(16).padStart(6, '0');
                icon.innerHTML = '<span class="part-dot" style="background:#' + colorHex + '"></span><span class="part-label">' + part.name + (hasChildren ? ' ▶' : '') + '</span>';
                icon.addEventListener('click', () => {
                    if (hasChildren) {
                        exploderBreadcrumb.push({ id: part.id, name: part.name, desc: part.desc });
                        drillIntoPartById(part.id);
                    } else {
                        showPartInfo({ partId: part.id, partName: part.name, partDesc: part.desc || '' });
                    }
                    logAction('part_click', part.name);
                    JarvisSounds.hover();
                });
                icon.addEventListener('mouseenter', () => {
                    const mesh = exploderFlatParts.find(m => m.userData.partId === part.id);
                    if (mesh) highlightMesh(mesh, false);
                    JarvisSounds.hover();
                });
                icon.addEventListener('mouseleave', () => {
                    const mesh = exploderFlatParts.find(m => m.userData.partId === part.id);
                    if (mesh && mesh !== exploderSelected) resetMeshHighlight(mesh);
                });
                groupEl.appendChild(icon);
            });
            target.appendChild(groupEl);
        });
    }

    function updateBreadcrumbDisplay() {
        const el = document.getElementById('exploder-breadcrumb');
        if (!el) return;
        if (exploderBreadcrumb.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = '> ' + exploderBreadcrumb.map((b, i) =>
            '<span class="crumb' + (i === exploderBreadcrumb.length - 1 ? ' active' : '') + '">' + b.name + '</span>'
        ).join(' > ');
    }

    // ═══════════════════════════════════════════════════════════
    // GESTURE → 3D EXPLODER INTEGRATION
    // ═══════════════════════════════════════════════════════════
    let gesture3DLastAction = 0;
    let gesture3DPrevWrist = null;
    const GESTURE_3D_COOLDOWN = 400;

    function handleExploderGesture(gestureType, landmarks) {
        // Only active when exploder is visible
        if (!exploderModel || document.getElementById('exploder-view').classList.contains('hidden')) return;

        const now = Date.now();
        const canvas = document.getElementById('part-detail-canvas');
        if (!canvas) return;

        if (landmarks) {
            const wrist = landmarks[0];
            const indexTip = landmarks[8];

            // ── SWIPE → ROTATE MODEL ──
            if (gesture3DPrevWrist && (gestureType === 'swipe_left' || gestureType === 'swipe_right' || gestureType === 'swipe_up' || gestureType === 'swipe_down')) {
                const dx = wrist.x - gesture3DPrevWrist.x;
                const dy = wrist.y - gesture3DPrevWrist.y;
                if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                    exploderRotation.y -= dx * 3;
                    exploderRotation.x -= dy * 2;
                    exploderRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, exploderRotation.x));
                }
            }
            gesture3DPrevWrist = { x: wrist.x, y: wrist.y };

            // ── POINT → HOVER/SELECT PART ──
            if (gestureType === 'point' && !state.gestureRecording) {
                // Map index finger to canvas coordinates
                // landmarks are normalized 0-1, mirror x
                const rect = canvas.getBoundingClientRect();
                const screenX = rect.left + (1 - indexTip.x) * rect.width;
                const screenY = rect.top + indexTip.y * rect.height;

                exploderMouse.x = ((1 - indexTip.x) * 2 - 1);
                exploderMouse.y = -(indexTip.y * 2 - 1);

                // Raycast
                exploderRaycaster.setFromCamera(exploderMouse, exploderCamera);
                const intersects = exploderRaycaster.intersectObjects(exploderFlatParts, false);

                if (intersects.length > 0) {
                    const mesh = intersects[0].object;
                    if (mesh.userData.partId) {
                        // Highlight
                        if (exploderHovered && exploderHovered !== exploderSelected) resetMeshHighlight(exploderHovered);
                        exploderHovered = mesh;
                        highlightMesh(mesh, false);

                        // Show finger cursor indicator
                        const hint = document.getElementById('exploder-hint');
                        if (mesh.userData.hasChildren) {
                            hint.textContent = '☝️ Pointing at: ' + mesh.userData.partName + ' — make a fist to drill down';
                        } else {
                            hint.textContent = '☝️ Pointing at: ' + mesh.userData.partName;
                        }
                    }
                }
            }

            // ── FIST → CLICK/DRILL DOWN ──
            if (gestureType === 'fist' && now - gesture3DLastAction > GESTURE_3D_COOLDOWN) {
                if (exploderHovered && exploderHovered.userData.hasChildren) {
                    handlePartClick(exploderHovered);
                    gesture3DLastAction = now;
                } else if (exploderBreadcrumb.length > 0) {
                    // Go back up
                    exploderBreadcrumb.pop();
                    const top = exploderBreadcrumb.length > 0 ? exploderBreadcrumb[exploderBreadcrumb.length - 1] : null;
                    if (top && top.id) {
                        drillIntoPartById(top.id);
                    } else {
                        rebuildExploderModel(state.selectedProject);
                    }
                    updateBreadcrumbDisplay();
                    gesture3DLastAction = now;
                }
            }

            // ── OPEN PALM → RESET VIEW ──
            if (gestureType === 'open_palm' && now - gesture3DLastAction > GESTURE_3D_COOLDOWN) {
                exploderRotation = { x: 0, y: 0 }; exploderRotTarget = { x: 0, y: 0 }; exploderExploded = false; exploderExplodeProgress = 0;
                exploderCamTarget.set(0, 2, 6);
                exploderCamera.lookAt(0, 0, 0);
                if (exploderBreadcrumb.length > 0) {
                    rebuildExploderModel(state.selectedProject);
                    exploderBreadcrumb = [];
                    updateBreadcrumbDisplay();
                }
                document.getElementById('exploder-hint').textContent = '🖐️ View reset!';
                gesture3DLastAction = now;
            }

            // ── PINCH → ZOOM IN ──
            if (gestureType === 'pinch') {
                exploderCamera.position.multiplyScalar(0.97);
                if (exploderCamera.position.length() < 2) exploderCamera.position.setLength(2);
            }

            // ── THUMBS UP → ZOOM IN ──
            if (gestureType === 'thumbs_up') {
                exploderCamera.position.multiplyScalar(0.98);
                if (exploderCamera.position.length() < 2) exploderCamera.position.setLength(2);
            }

            // ── THUMBS DOWN → ZOOM OUT ──
            if (gestureType === 'thumbs_down') {
                exploderCamera.position.multiplyScalar(1.02);
                if (exploderCamera.position.length() > 15) exploderCamera.position.setLength(15);
            }

            // ── PEACE SIGN → AUTO-ROTATE TOGGLE ──
            if (gestureType === 'peace' && now - gesture3DLastAction > GESTURE_3D_COOLDOWN) {
                exploderDragging = !exploderDragging; // Toggle auto-rotate
                document.getElementById('exploder-hint').textContent = exploderDragging ? '✌️ Auto-rotate paused' : '✌️ Auto-rotate resumed';
                gesture3DLastAction = now;
            }

            // ── ROCK → EXPLODE VIEW (smooth animation) ──
            if (gestureType === 'rock' && now - gesture3DLastAction > GESTURE_3D_COOLDOWN) {
                if (exploderModel) {
                    triggerExplodeToggle();
                    const btn = document.getElementById('btn-explode');
                    if (btn) btn.textContent = exploderExploded ? '🔧 Assemble' : '💥 Explode';
                }
                gesture3DLastAction = now;
            }
        } else {
            gesture3DPrevWrist = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // API SECTION
    // ═══════════════════════════════════════════════════════════
    function initAPISection() {
        document.getElementById('cfg-save').addEventListener('click', () => {
            const key = document.getElementById('cfg-api-key').value.trim();
            const provider = document.getElementById('cfg-provider').value;
            if (!key) return;

            state.apiKey = key;
            state.apiProvider = provider;
            document.getElementById('cfg-status').textContent = 'CONNECTED';
            document.getElementById('cfg-status').className = 'config-status connected';

            // Sync to AI panel
            document.getElementById('ai-key-input').classList.add('hidden');
            document.getElementById('ai-chat-input').classList.remove('hidden');
            addAIMessage('assistant', `Connected via ${provider}. How can I help?`);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // P2P ROOM
    // ═══════════════════════════════════════════════════════════
    function initRoomSection() {
        document.getElementById('room-create').addEventListener('click', createRoom);
        document.getElementById('room-join').addEventListener('click', joinRoom);
        document.getElementById('room-leave').addEventListener('click', leaveRoom);
        document.getElementById('room-chat-send').addEventListener('click', sendRoomMsg);
        document.getElementById('room-chat-text').addEventListener('keydown', e => { if (e.key === 'Enter') sendRoomMsg(); });
    }

    async function createRoom() {
        const password = document.getElementById('room-password-create').value.trim();
        if (!password) { alert('Set a room password'); return; }

        state.roomCode = crypto.randomUUID().slice(0, 8).toUpperCase();
        state.roomPassword = password;

        try {
            state.peer = new Peer('jarvis-' + state.roomCode.toLowerCase());
            state.peer.on('open', () => {
                console.log('[Room] Peer open:', state.roomCode);
                showActiveRoom();
                addRoomMessage('system', `Room created: ${state.roomCode} — waiting for peer...`);
            });

            state.peer.on('connection', conn => {
                let authenticated = false;

                conn.on('open', () => {
                    addRoomMessage('system', 'Incoming connection — waiting for password...');
                });

                conn.on('data', data => {
                    if (data.type === 'auth' && !authenticated) {
                        if (data.password === state.roomPassword) {
                            authenticated = true;
                            conn.send({ type: 'auth_ok' });
                            state.peerConn = conn;
                            addRoomMessage('system', 'Peer authenticated and connected!');
                            setupDataChannel(conn);
                        } else {
                            conn.send({ type: 'auth_fail' });
                            addRoomMessage('system', 'Wrong password — connection rejected');
                            setTimeout(() => conn.close(), 500);
                        }
                    } else if (authenticated && data.type === 'chat') {
                        addRoomMessage('remote', data.text);
                    }
                });
            });

            state.peer.on('call', async call => {
                // Only answer if we have an authenticated peer
                if (!state.peerConn) { call.close(); return; }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                document.getElementById('local-video').srcObject = stream;
                call.answer(stream);
                call.on('stream', remoteStream => {
                    document.getElementById('remote-video').srcObject = remoteStream;
                });
            });
        } catch (err) {
            addRoomMessage('system', 'Error: ' + err.message);
        }
    }

    async function joinRoom() {
        const code = document.getElementById('room-code-join').value.trim().toUpperCase();
        const password = document.getElementById('room-password-join').value.trim();
        if (!code || !password) { alert('Enter room code and password'); return; }

        state.roomCode = code;

        try {
            state.peer = new Peer();
            state.peer.on('open', () => {
                console.log('[Room] Joining:', code);
                const conn = state.peer.connect('jarvis-' + code.toLowerCase());
                state.peerConn = conn;
                let authPending = true;

                conn.on('open', () => {
                    addRoomMessage('system', 'Connected — sending password...');
                    conn.send({ type: 'auth', password: password });
                });

                conn.on('data', data => {
                    if (data.type === 'auth_ok' && authPending) {
                        authPending = false;
                        showActiveRoom();
                        addRoomMessage('system', `Joined room: ${code}`);
                        setupDataChannel(conn);

                        // Start video call after auth
                        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                            document.getElementById('local-video').srcObject = stream;
                            const call = state.peer.call('jarvis-' + code.toLowerCase(), stream);
                            call.on('stream', remoteStream => {
                                document.getElementById('remote-video').srcObject = remoteStream;
                            });
                        }).catch(() => {
                            addRoomMessage('system', 'Camera/mic not available — chat only');
                        });
                    } else if (data.type === 'auth_fail' && authPending) {
                        authPending = false;
                        addRoomMessage('system', 'Wrong password — connection rejected');
                        setTimeout(() => {
                            leaveRoom();
                        }, 1000);
                    } else if (data.type === 'chat') {
                        addRoomMessage('remote', data.text);
                    }
                });

                conn.on('close', () => {
                    if (authPending) {
                        authPending = false;
                        addRoomMessage('system', 'Connection closed — check room code');
                    }
                });
            });
        } catch (err) {
            addRoomMessage('system', 'Error: ' + err.message);
        }
    }

    function setupDataChannel(conn) {
        conn.on('data', data => {
            if (data.type === 'chat') {
                addRoomMessage('remote', data.text);
            }
        });
    }

    function showActiveRoom() {
        document.getElementById('room-lobby').classList.add('hidden');
        document.getElementById('room-active').classList.remove('hidden');
        document.getElementById('room-code-display').textContent = state.roomCode;
        document.getElementById('room-pass-display').textContent = '••••••••';
    }

    function leaveRoom() {
        if (state.peerConn) state.peerConn.close();
        if (state.peer) state.peer.destroy();
        state.peer = null; state.peerConn = null; state.roomCode = null;

        document.getElementById('room-active').classList.add('hidden');
        document.getElementById('room-lobby').classList.remove('hidden');
        document.getElementById('room-messages').innerHTML = '';

        const localVideo = document.getElementById('local-video');
        if (localVideo.srcObject) { localVideo.srcObject.getTracks().forEach(t => t.stop()); localVideo.srcObject = null; }
        document.getElementById('remote-video').srcObject = null;
    }

    function sendRoomMsg() {
        const input = document.getElementById('room-chat-text');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        addRoomMessage('local', text);
        if (state.peerConn?.open) state.peerConn.send({ type: 'chat', text });
    }

    function addRoomMessage(role, text) {
        const container = document.getElementById('room-messages');
        const div = document.createElement('div');
        div.className = `room-msg ${role}`;
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ═══════════════════════════════════════════════════════════
    // GESTURE SECTION (MediaPipe Hands — real 21-landmark tracking)
    // ═══════════════════════════════════════════════════════════
    function initGestureSection() {
        document.getElementById('gesture-start').addEventListener('click', startGestureCamera);
        document.getElementById('gesture-add').addEventListener('click', () => {
            document.getElementById('gesture-record-panel').classList.toggle('hidden');
        });
        document.getElementById('gesture-record-start').addEventListener('click', startGestureRecording);
        loadGestures();
    }

    async function startGestureCamera() {
        const video = document.getElementById('gesture-video');
        const canvas = document.getElementById('gesture-canvas');
        const status = document.getElementById('gesture-status');

        status.textContent = 'Loading hand tracking model...';

        try {
            await JarvisGestures.init(video, canvas, (gestureType, landmarks) => {
                // Handle detected gesture
                if (state.gestureRecording && landmarks) {
                    // Note: gesture engine already captures frames in processResults
                    state.gestureSamples.push(landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })));
                    status.textContent = `Recording... ${state.gestureSamples.length} frames`;

                    if (state.gestureSamples.length >= 60) {
                        finishGestureRecording();
                    }
                    return;
                }

                // ── 3D EXPLODER GESTURE CONTROL ──
                handleExploderGesture(gestureType, landmarks);

                // Check if gesture matches any saved gesture
                const recognized = checkGestureMatch(gestureType, landmarks);
                if (recognized) {
                    status.textContent = `Detected: ${recognized.name} → ${recognized.action}`;
                    executeGestureAction(recognized.action);
                } else if (gestureType) {
                    status.textContent = `Hand: ${gestureType.replace(/_/g, ' ')}`;
                }
            });

            document.getElementById('gesture-start').style.display = 'none';
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            const mode = JarvisGestures.getMode();
            if (mode === 'basic') {
                status.textContent = 'Basic mode — swipe gestures only (MediaPipe unavailable)';
                document.getElementById('gesture-add').disabled = true;
                document.getElementById('gesture-add').title = 'Custom gestures require MediaPipe (full hand tracking)';
                document.getElementById('gesture-add').style.opacity = '0.4';
            } else {
                status.textContent = 'Hand tracking active — show a gesture';
            }
        } catch (err) {
            console.error('Gesture init error:', err);
            status.textContent = 'Camera denied or model failed to load';
        }
    }

    function checkGestureMatch(gestureType, landmarks) {
        if (!state.gestureModels.length) return null;

        // First check simple gesture types (fist, open_palm, etc.)
        for (const g of state.gestureModels) {
            if (g.simpleType && g.simpleType === gestureType) {
                return g;
            }
        }

        // If we have landmarks, compare against recorded templates
        if (landmarks && state.gestureModels.some(g => g.template && g.template.length)) {
            const currentFrame = landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 }));
            let bestMatch = null;
            let bestScore = 0;

            for (const g of state.gestureModels) {
                if (!g.template || !g.template.length) continue;
                const score = JarvisGestures.compareTemplates([currentFrame], g.template);
                if (score > bestScore && score > 0.7) {
                    bestScore = score;
                    bestMatch = g;
                }
            }

            return bestMatch;
        }

        return null;
    }

    function executeGestureAction(action) {
        switch (action) {
            case 'navigate_home': showSection('home'); break;
            case 'navigate_api': showSection('api'); break;
            case 'navigate_room': showSection('room'); break;
            case 'navigate_upload': showSection('upload'); break;
            case 'navigate_gesture': showSection('gesture'); break;
            case 'scroll_up': window.scrollBy(0, -200); break;
            case 'scroll_down': window.scrollBy(0, 200); break;
            case 'zoom_in':
                if (exploderModel && !document.getElementById('exploder-view').classList.contains('hidden')) {
                    exploderCamera.position.multiplyScalar(0.85);
                    if (exploderCamera.position.length() < 2) exploderCamera.position.setLength(2);
                } else {
                    document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1);
                }
                break;
            case 'zoom_out':
                if (exploderModel && !document.getElementById('exploder-view').classList.contains('hidden')) {
                    exploderCamera.position.multiplyScalar(1.15);
                    if (exploderCamera.position.length() > 15) exploderCamera.position.setLength(15);
                } else {
                    document.body.style.zoom = Math.max(0.5, (parseFloat(document.body.style.zoom || 1) - 0.1));
                }
                break;
            case 'rotate_left':
                if (exploderModel) exploderRotation.y -= 0.5;
                break;
            case 'rotate_right':
                if (exploderModel) exploderRotation.y += 0.5;
                break;
            case 'reset_view':
                if (exploderModel) {
                    exploderRotation = { x: 0, y: 0 }; exploderRotTarget = { x: 0, y: 0 }; exploderExploded = false; exploderExplodeProgress = 0;
                    exploderCamTarget.set(0, 2, 6);
                }
                break;
            case 'explode_view':
                if (exploderModel) {
                    triggerExplodeToggle();
                    const btn = document.getElementById('btn-explode');
                    if (btn) btn.textContent = exploderExploded ? '🔧 Assemble' : '💥 Explode';
                }
                break;
        }
        logAction('gesture_trigger', action);
    }

    function startGestureRecording() {
        const name = document.getElementById('gesture-name').value.trim();
        const action = document.getElementById('gesture-action').value;
        if (!name) { alert('Enter gesture name'); return; }
        if (!JarvisGestures.isRunning()) {
            alert('Enable camera first before recording gestures');
            return;
        }
        if (JarvisGestures.getMode() === 'basic') {
            alert('Custom gesture recording requires MediaPipe hand tracking. Current mode only supports basic swipe detection.');
            return;
        }

        state.gestureRecording = true;
        state.gestureSamples = [];
        state._gestureTarget = { name, action };

        JarvisGestures.startRecording();

        document.getElementById('gesture-record-start').textContent = 'Recording...';
        document.getElementById('gesture-record-start').disabled = true;
        document.getElementById('gesture-status').textContent = 'Hold your gesture for 2 seconds...';
    }

    function finishGestureRecording() {
        state.gestureRecording = false;
        const { name, action } = state._gestureTarget;

        // Get the recorded frames from the gesture engine
        const recordedFrames = JarvisGestures.stopRecording();

        // Use the landmarks captured via our state as the template
        const template = state.gestureSamples.length > 0 ? state.gestureSamples : recordedFrames;

        // Detect the primary gesture type from the last frame
        let simpleType = null;
        if (template.length > 0) {
            const lastFrame = template[template.length - 1];
            if (lastFrame.length === 21) {
                // It's full landmark data — determine finger states
                const lm = lastFrame;
                const indexExt = lm[8].y < lm[6].y;
                const middleExt = lm[12].y < lm[10].y;
                const ringExt = lm[16].y < lm[14].y;
                const pinkyExt = lm[20].y < lm[18].y;
                const ext = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
                if (ext === 0) simpleType = 'fist';
                else if (ext === 4) simpleType = 'open_palm';
                else if (indexExt && !middleExt && !ringExt && !pinkyExt) simpleType = 'point';
                else if (indexExt && middleExt && !ringExt && !pinkyExt) simpleType = 'peace';
            }
        }

        const gesture = {
            id: crypto.randomUUID().slice(0, 8),
            name, action,
            template,
            simpleType,
            created: Date.now(),
        };

        state.gestureModels.push(gesture);
        db.put('gestures', gesture);

        renderGestures();
        document.getElementById('gesture-record-panel').classList.add('hidden');
        document.getElementById('gesture-name').value = '';
        document.getElementById('gesture-record-start').textContent = 'Start Recording';
        document.getElementById('gesture-record-start').disabled = false;
        document.getElementById('gesture-status').textContent = `Gesture "${name}" saved! (${template.length} frames captured)`;
    }

    async function loadGestures() {
        state.gestureModels = await db.getAll('gestures');
        renderGestures();
    }

    function renderGestures() {
        const container = document.getElementById('gesture-items');
        container.innerHTML = '';
        state.gestureModels.forEach(g => {
            const el = document.createElement('div');
            el.className = 'gesture-entry';
            const typeLabel = g.simpleType ? `[${g.simpleType.replace(/_/g, ' ')}]` : `[${g.template?.length || 0} frames]`;
            el.innerHTML = `
                <span class="g-name">${g.name} ${typeLabel}</span>
                <span class="g-action">${g.action.replace(/_/g, ' ')}</span>
                <button class="g-delete" data-id="${g.id}">✕</button>
            `;
            el.querySelector('.g-delete').addEventListener('click', async () => {
                await db.del('gestures', g.id);
                state.gestureModels = state.gestureModels.filter(x => x.id !== g.id);
                renderGestures();
            });
            container.appendChild(el);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // UPLOAD SECTION
    // ═══════════════════════════════════════════════════════════
    function initUploadSection() {
        const dropzone = document.getElementById('upload-dropzone');
        const input = document.getElementById('upload-input');

        dropzone.addEventListener('click', () => input.click());
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) processUpload(file);
        });
        input.addEventListener('change', () => { if (input.files[0]) processUpload(input.files[0]); });

        document.getElementById('upload-add-to-home').addEventListener('click', addUploadedProject);
    }

    async function processUpload(file) {
        if (!file.name.match(/\.glb$/i)) { alert('Please upload a .glb file'); return; }

        document.getElementById('upload-dropzone').classList.add('hidden');
        document.getElementById('upload-preview').classList.remove('hidden');
        document.getElementById('upload-name').textContent = file.name;

        initUploadRenderer();

        const arrayBuffer = await file.arrayBuffer();
        const loader = new THREE.GLTFLoader();

        loader.parse(arrayBuffer, '', (gltf) => {
            if (uploadModel) uploadScene.remove(uploadModel);
            uploadModel = gltf.scene;

            // Center and scale
            const box = new THREE.Box3().setFromObject(uploadModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            uploadModel.scale.setScalar(3 / maxDim);
            const center = box.getCenter(new THREE.Vector3());
            uploadModel.position.sub(center.multiplyScalar(3 / maxDim));

            uploadScene.add(uploadModel);

            // Extract parts from mesh names
            const parts = [];
            const groupMap = {};
            uploadModel.traverse(child => {
                if (child.isMesh) {
                    const name = child.name || `Part_${parts.length}`;
                    const color = child.material?.color?.getHex() || 0x00d4ff;
                    const group = child.parent?.name || 'Default';
                    parts.push({ id: name.toLowerCase().replace(/\s+/g, '_'), name, desc: `Mesh component from ${file.name}`, color, group });
                    groupMap[group] = (groupMap[group] || 0) + 1;
                }
            });

            // Auto-group if too many parts
            let finalParts = parts;
            let groupsInfo = '';
            if (parts.length > 50) {
                finalParts = autoGroupParts(parts);
                groupsInfo = `Auto-grouped into ${Object.keys(groupMap).length} categories`;
            } else {
                groupsInfo = `${Object.keys(groupMap).length} groups detected`;
            }

            state._uploadData = { name: file.name.replace('.glb', '').toUpperCase(), parts: finalParts, buffer: arrayBuffer };

            document.getElementById('upload-parts-count').textContent = `${finalParts.length} selectable parts`;
            document.getElementById('upload-groups-count').textContent = groupsInfo;

            const listEl = document.getElementById('upload-parts-list');
            listEl.innerHTML = '';
            finalParts.forEach(p => {
                const item = document.createElement('div');
                item.className = 'upload-part-item';
                item.textContent = p.name;
                listEl.appendChild(item);
            });

            animateUpload();
        }, (err) => {
            console.error('GLB parse error:', err);
            alert('Failed to parse 3D model');
        });
    }

    function autoGroupParts(parts) {
        // Advanced grouping for high-density models (bikes, cars, rockets)
        // Strategy: hierarchy-based + name similarity + spatial clustering

        // Step 1: Group by parent hierarchy
        const hierarchyGroups = {};
        parts.forEach(p => {
            const g = p.group || 'Ungrouped';
            if (!hierarchyGroups[g]) hierarchyGroups[g] = [];
            hierarchyGroups[g].push(p);
        });

        const result = [];

        Object.entries(hierarchyGroups).forEach(([gName, gParts]) => {
            if (gParts.length <= 15) {
                // Small enough — keep as individual parts
                result.push(...gParts);
                return;
            }

            // Step 2: Sub-group by naming patterns
            const subgroups = {};
            gParts.forEach(p => {
                const name = p.name.toLowerCase();

                // Detect common naming patterns
                let category = 'Other';

                // Body/frame parts
                if (/body|frame|chassis|shell|hull|casing|panel|cover|cap/.test(name)) category = 'Body';
                // Mechanical parts
                else if (/engine|motor|piston|cylinder|crank|shaft|gear|bearing/.test(name)) category = 'Mechanical';
                // Wheels/tires
                else if (/wheel|tire|rim|hub|axle|brake|suspension|shock/.test(name)) category = 'Wheels & Suspension';
                // Electronics
                else if (/wire|cable|sensor|board|chip|led|light|lamp|bulb|connector/.test(name)) category = 'Electronics';
                // Exhaust/emissions
                else if (/exhaust|pipe|muffler|emission|catalytic/.test(name)) category = 'Exhaust';
                // Interior
                else if (/seat|dashboard|steering|console|door|window|mirror|handle/.test(name)) category = 'Interior';
                // Aerodynamics
                else if (/wing|spoiler|fin|flap|aileron|rudder|elevator|fairing/.test(name)) category = 'Aerodynamics';
                // Propulsion
                else if (/thruster|nozzle|prop|rotor|blade|combustion|turbine|injector/.test(name)) category = 'Propulsion';
                // Structural
                else if (/bolt|screw|nut|bracket|mount|support|strut|rib|spar|stringer/.test(name)) category = 'Fasteners & Structure';
                // Fluid systems
                else if (/tank|hose|pipe|valve|pump|filter|radiator|coolant|fuel|oil/.test(name)) category = 'Fluid Systems';
                // Weapon/defense (for military models)
                else if (/gun|cannon|missile|rocket|warhead|magazine|turret|armor|shield/.test(name)) category = 'Weaponry';
                // Optics/sensors
                else if (/camera|lens|sensor|radar|sonar|antenna|dish|transmitter|receiver/.test(name)) category = 'Sensors & Optics';
                // Glass/transparent
                else if (/glass|window|windshield|visor|lens|transparent/.test(name)) category = 'Glass';
                // Rubber/seal
                else if (/rubber|seal|gasket|o-ring|bumper|pad/.test(name)) category = 'Rubber & Seals';

                if (!subgroups[category]) subgroups[category] = [];
                subgroups[category].push(p);
            });

            Object.entries(subgroups).forEach(([catName, catParts]) => {
                if (catParts.length <= 5) {
                    // Small subgroup — keep individual
                    result.push(...catParts);
                } else {
                    // Create a grouped entry
                    result.push({
                        id: `group_${gName}_${catName}`.toLowerCase().replace(/\s+/g, '_'),
                        name: `${catName} (${catParts.length})`,
                        desc: `${catParts.length} parts: ${catParts.slice(0, 5).map(p => p.name).join(', ')}${catParts.length > 5 ? '...' : ''}`,
                        color: catParts[0].color,
                        group: gName,
                        subParts: catParts,
                        expandable: true,
                    });
                }
            });
        });

        return result;
    }

    async function addUploadedProject() {
        if (!state._uploadData) return;
        const { name, parts, buffer } = state._uploadData;

        const proj = {
            id: 'user-' + crypto.randomUUID().slice(0, 8),
            name, type: 'user', color: 0xff6600, icon: '📦',
            desc: 'User uploaded model',
            parts,
        };

        // Save to IndexedDB
        await db.put('projects', { id: proj.id, ...proj, buffer });

        state.projects.push(proj);
        renderProjectGrid();
        showSection('home');

        // Reset upload view
        document.getElementById('upload-preview').classList.add('hidden');
        document.getElementById('upload-dropzone').classList.remove('hidden');
        state._uploadData = null;
    }

    async function loadUserProjects() {
        const saved = await db.getAll('projects');
        saved.forEach(p => {
            if (!state.projects.find(x => x.id === p.id)) {
                state.projects.push(p);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // AI CHAT
    // ═══════════════════════════════════════════════════════════
    function initAIChat() {
        const bubble = document.getElementById('ai-bubble');
        const panel = document.getElementById('ai-panel');

        bubble.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            logAction('ai_toggle', panel.classList.contains('hidden') ? 'close' : 'open');
        });

        document.getElementById('ai-close').addEventListener('click', () => panel.classList.add('hidden'));

        document.getElementById('api-key-submit').addEventListener('click', () => {
            const key = document.getElementById('api-key-field').value.trim();
            if (!key) return;
            state.apiKey = key;
            state.apiProvider = document.getElementById('api-provider').value;
            document.getElementById('ai-key-input').classList.add('hidden');
            document.getElementById('ai-chat-input').classList.remove('hidden');
            addAIMessage('assistant', 'Connected. How can I help you?');
        });

        const sendBtn = document.getElementById('ai-send');
        const input = document.getElementById('ai-input');
        sendBtn.addEventListener('click', sendAI);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') sendAI(); });
    }

    function sendAI() {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text || !state.apiKey) return;
        input.value = '';
        addAIMessage('user', text);
        logAction('ai_query', text);
        callAI(text);
    }

    function addAIMessage(role, text) {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    async function callAI(userMessage) {
        const context = getAIContext();
        const systemPrompt = window.AI_SYSTEM_PROMPT;
        const contextMsg = `CURRENT APP STATE:\n${JSON.stringify(context, null, 2)}`;

        let url, body;

        if (state.apiProvider === 'openai') {
            url = '/api/openai';
            body = JSON.stringify({
                _auth: { authorization: `Bearer ${state.apiKey}` },
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'system', content: contextMsg },
                    { role: 'user', content: userMessage },
                ],
                max_tokens: 500,
            });
        } else if (state.apiProvider === 'anthropic') {
            url = '/api/anthropic';
            body = JSON.stringify({
                _auth: { apiKey: state.apiKey, version: '2023-06-01' },
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 500,
                system: systemPrompt + '\n\n' + contextMsg,
                messages: [{ role: 'user', content: userMessage }],
            });
        } else if (state.apiProvider === 'gemini') {
            // Gemini supports CORS natively — call directly
            url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`;
            body = JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt + '\n\n' + contextMsg + '\n\nUser: ' + userMessage }] }],
            });
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            const res = await fetch(url, { method: 'POST', headers, body });
            const data = await res.json();
            let reply;
            if (state.apiProvider === 'openai') reply = data.choices?.[0]?.message?.content;
            else if (state.apiProvider === 'anthropic') reply = data.content?.[0]?.text;
            else if (state.apiProvider === 'gemini') reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!reply && data.error) {
                addAIMessage('assistant', `API Error: ${data.error.message || data.error}`);
            } else {
                addAIMessage('assistant', reply || 'No response received');
            }
        } catch (err) {
            addAIMessage('assistant', `Connection Error: ${err.message}. Make sure server.js is running.`);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SCREENSHOT SYSTEM
    // ═══════════════════════════════════════════════════════════
    function initScreenshot() {
        document.getElementById('screenshot-btn').addEventListener('click', takeScreenshot);
        document.getElementById('btn-screenshot-view').addEventListener('click', takeScreenshot);
    }

    function takeScreenshot() {
        JarvisSounds.click();
        const flash = document.getElementById('screenshot-flash');
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 200);

        // Create a composite canvas
        const exportCanvas = document.createElement('canvas');
        const w = 1920, h = 1080;
        exportCanvas.width = w;
        exportCanvas.height = h;
        const ctx = exportCanvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        // Capture the appropriate 3D canvas
        let sourceCanvas = null;
        if (state.selectedProject && !document.getElementById('exploder-view').classList.contains('hidden')) {
            sourceCanvas = document.getElementById('part-detail-canvas');
        } else {
            sourceCanvas = document.getElementById('three-canvas');
        }

        if (sourceCanvas && sourceCanvas.width > 0) {
            try {
                ctx.drawImage(sourceCanvas, 0, 0, w, h);
            } catch (e) {
                // Canvas tainted or not ready
            }
        }

        // Overlay text info
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, h - 60, w, 60);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#00d4ff';
        ctx.font = '16px Orbitron, monospace';
        ctx.fillText('JARVIS 3D', 20, h - 35);
        ctx.fillStyle = '#888';
        ctx.font = '12px Rajdhani, sans-serif';
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const info = state.selectedProject ? `${state.selectedProject.name}${state.selectedPart ? ' → ' + state.selectedPart.name : ''}` : 'Project Grid';
        ctx.fillText(`${info}  |  ${timestamp}`, 20, h - 15);

        // Download
        const link = document.createElement('a');
        link.download = `jarvis3d-${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    // ═══════════════════════════════════════════════════════════
    // THEME ENGINE
    // ═══════════════════════════════════════════════════════════
    const THEME_COLORS = {
        cyan:   { grid: 0x00d4ff, particle: 0x00d4ff, ambient: 0x00d4ff },
        red:    { grid: 0xff3333, particle: 0xff3333, ambient: 0xff3333 },
        green:  { grid: 0x00ff66, particle: 0x00ff66, ambient: 0x00ff66 },
        gold:   { grid: 0xffaa00, particle: 0xffaa00, ambient: 0xffaa00 },
        purple: { grid: 0xaa44ff, particle: 0xaa44ff, ambient: 0xaa44ff },
        white:  { grid: 0xffffff, particle: 0xaaccff, ambient: 0xffffff },
    };

    function initThemeEngine() {
        const btn = document.getElementById('theme-btn');
        const selector = document.getElementById('theme-selector');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willShow = selector.classList.contains('hidden');
            selector.classList.toggle('hidden');
            if (willShow) {
                const rect = btn.getBoundingClientRect();
                selector.style.left = rect.left + 'px';
                selector.style.top = (rect.bottom + 8) + 'px';
            }
        });

        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target) && e.target !== btn) {
                selector.classList.add('hidden');
            }
        });

        selector.querySelectorAll('.theme-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const theme = opt.dataset.theme;
                applyTheme(theme);
                selector.classList.add('hidden');
                JarvisSounds.success();
            });
        });

        // Restore saved theme
        const saved = localStorage.getItem('jarvis3d-theme');
        if (saved && THEME_COLORS[saved]) applyTheme(saved);
    }

    function applyTheme(themeName) {
        if (themeName === 'cyan') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', themeName);
        }
        localStorage.setItem('jarvis3d-theme', themeName);

        // Update active indicator
        document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('active', o.dataset.theme === themeName));

        // Update Three.js colors
        const colors = THEME_COLORS[themeName] || THEME_COLORS.cyan;
        if (gridLines) gridLines.material.color.setHex(colors.grid);
        if (particles) particles.material.color.setHex(colors.particle);
        if (scene) {
            scene.children.forEach(c => {
                if (c.isAmbientLight) c.color.setHex(colors.ambient);
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MEASUREMENT TOOL
    // ═══════════════════════════════════════════════════════════
    let measureMode = false;
    let measurePoints = [];
    let measureMarkers = [];
    let measureInfoEl = null;

    function initMeasurement() {
        const btn = document.getElementById('btn-measure');
        btn.addEventListener('click', () => {
            measureMode = !measureMode;
            btn.classList.toggle('active-measure', measureMode);
            btn.textContent = measureMode ? '📏 Measuring' : '📏 Measure';

            if (!measureMode) clearMeasurement();
            else {
                document.getElementById('exploder-hint').textContent = '📏 Click two points on the model to measure distance';
            }
        });
    }

    function handleMeasureClick(intersect) {
        if (!measureMode || !intersect) return;

        const point = intersect.point.clone();
        measurePoints.push(point);

        // Create visual marker
        const canvas = document.getElementById('part-detail-canvas');
        const rect = canvas.getBoundingClientRect();
        const screenPos = point.clone().project(exploderCamera);
        const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-screenPos.y * 0.5 + 0.5) * rect.height + rect.top;

        const marker = document.createElement('div');
        marker.className = 'measure-point';
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.textContent = measurePoints.length;
        marker.style.fontSize = '0';
        document.body.appendChild(marker);
        measureMarkers.push(marker);

        if (measurePoints.length >= 2) {
            const dist = measurePoints[0].distanceTo(measurePoints[1]);
            showMeasureResult(dist);
            measurePoints = [];
        }
    }

    function showMeasureResult(distance) {
        if (measureInfoEl) measureInfoEl.remove();
        measureInfoEl = document.createElement('div');
        measureInfoEl.id = 'measure-info';
        measureInfoEl.textContent = `📏 Distance: ${distance.toFixed(3)} units`;
        document.getElementById('exploder-center').appendChild(measureInfoEl);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (measureInfoEl) { measureInfoEl.remove(); measureInfoEl = null; }
            clearMeasurement();
        }, 5000);
    }

    function clearMeasurement() {
        measurePoints = [];
        measureMarkers.forEach(m => m.remove());
        measureMarkers = [];
        if (measureInfoEl) { measureInfoEl.remove(); measureInfoEl = null; }
    }

    // Hook into existing click handler
    const origHandlePartClick = handlePartClick;

    // ═══════════════════════════════════════════════════════════
    // COMPARE MODE
    // ═══════════════════════════════════════════════════════════
    function initCompareSection() {
        const leftSel = document.getElementById('compare-left');
        const rightSel = document.getElementById('compare-right');
        const runBtn = document.getElementById('compare-run');

        // Populate dropdowns
        function populateDropdowns() {
            [leftSel, rightSel].forEach(sel => {
                sel.innerHTML = '';
                state.projects.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = `${p.icon} ${p.name}`;
                    sel.appendChild(opt);
                });
            });
            if (state.projects.length > 1) rightSel.selectedIndex = 1;
        }

        // Re-populate when section is shown
        const observer = new MutationObserver(() => {
            if (!document.getElementById('compare-section').classList.contains('hidden')) {
                populateDropdowns();
            }
        });
        observer.observe(document.getElementById('compare-section'), { attributes: true, attributeFilter: ['class'] });

        runBtn.addEventListener('click', () => {
            const leftProj = state.projects.find(p => p.id === leftSel.value);
            const rightProj = state.projects.find(p => p.id === rightSel.value);
            if (!leftProj || !rightProj || leftProj.id === rightProj.id) {
                alert('Select two different projects');
                return;
            }
            runComparison(leftProj, rightProj);
            JarvisSounds.success();
        });
    }

    function runComparison(a, b) {
        document.getElementById('compare-result').classList.remove('hidden');

        // Calculate stats
        const statsA = analyzeProject(a);
        const statsB = analyzeProject(b);

        // Render cards
        renderCompareCard('compare-card-left', a, statsA);
        renderCompareCard('compare-card-right', b, statsB);

        // Render comparison bars
        renderCompareBars(statsA, statsB, a.name, b.name);
    }

    function analyzeProject(proj) {
        const groups = {};
        let totalParts = proj.parts.length;
        let maxDepth = 0;

        proj.parts.forEach(p => {
            const g = p.group || 'Other';
            groups[g] = (groups[g] || 0) + 1;
            // Check for children (modelbuilder data)
            const modelDef = window.JarvisModelBuilder?.PROJECT_MODELS[proj.id];
            if (modelDef) {
                const partDef = modelDef.parts.find(pd => pd.id === p.id);
                if (partDef?.children) {
                    totalParts += countChildren(partDef.children);
                    maxDepth = Math.max(maxDepth, getDepth(partDef.children));
                }
            }
        });

        return { totalParts, groupCount: Object.keys(groups).length, groups, maxDepth };
    }

    function countChildren(children) {
        let count = children.length;
        children.forEach(c => { if (c.children) count += countChildren(c.children); });
        return count;
    }

    function getDepth(children, d) {
        d = d || 1;
        let max = d;
        children.forEach(c => { if (c.children) max = Math.max(max, getDepth(c.children, d + 1)); });
        return max;
    }

    function renderCompareCard(elId, proj, stats) {
        const el = document.getElementById(elId);
        el.innerHTML = `
            <h3>${proj.icon} ${proj.name}</h3>
            <div class="stat-row"><span>Top-Level Parts</span><span>${proj.parts.length}</span></div>
            <div class="stat-row"><span>Total Components</span><span>${stats.totalParts}</span></div>
            <div class="stat-row"><span>Categories</span><span>${stats.groupCount}</span></div>
            <div class="stat-row"><span>Max Drill Depth</span><span>${stats.maxDepth} levels</span></div>
            <div class="stat-row"><span>Type</span><span>${proj.type === 'user' ? 'UPLOADED' : 'BUILT-IN'}</span></div>
        `;
    }

    function renderCompareBars(statsA, statsB, nameA, nameB) {
        const container = document.getElementById('compare-stats');
        const metrics = [
            { label: 'Parts', a: statsA.totalParts, b: statsB.totalParts },
            { label: 'Categories', a: statsA.groupCount, b: statsB.groupCount },
            { label: 'Depth', a: statsA.maxDepth, b: statsB.maxDepth },
        ];

        container.innerHTML = '<h4>COMPARISON</h4>';
        metrics.forEach(m => {
            const max = Math.max(m.a, m.b, 1);
            const row = document.createElement('div');
            row.className = 'compare-bar';
            row.innerHTML = `
                <span class="compare-bar-label">${m.a}</span>
                <div class="compare-bar-track">
                    <div class="compare-bar-fill left" style="width:${(m.a / max) * 100}%"></div>
                </div>
                <span style="font-size:10px;color:#888;width:60px;text-align:center;font-family:var(--font-display)">${m.label}</span>
                <div class="compare-bar-track">
                    <div class="compare-bar-fill right" style="width:${(m.b / max) * 100}%"></div>
                </div>
                <span class="compare-bar-label" style="text-align:left">${m.b}</span>
            `;
            container.appendChild(row);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // SHARE LINK + ANNOTATION EXPORT
    // ═══════════════════════════════════════════════════════════
    function initShareExport() {
        document.getElementById('exploder-share').addEventListener('click', copyShareLink);
        document.getElementById('exploder-export-annotations').addEventListener('click', exportAnnotations);

        // Restore state from URL hash on load
        restoreFromHash();
    }

    function copyShareLink() {
        if (!state.selectedProject) return;
        const hash = btoa(JSON.stringify({
            p: state.selectedProject.id,
            part: state.selectedPart?.name || null,
        }));
        const url = window.location.origin + window.location.pathname + '#' + hash;

        navigator.clipboard.writeText(url).then(() => {
            document.getElementById('exploder-share').textContent = '✅ COPIED';
            setTimeout(() => {
                document.getElementById('exploder-share').textContent = '🔗 SHARE';
            }, 2000);
            JarvisSounds.success();
        }).catch(() => {
            // Fallback: show in prompt
            prompt('Copy this link:', url);
        });
    }

    function restoreFromHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return;
        try {
            const data = JSON.parse(atob(hash));
            const proj = state.projects.find(p => p.id === data.p);
            if (proj) {
                setTimeout(() => {
                    openExploder(proj);
                    if (data.part) {
                        setTimeout(() => {
                            const mesh = exploderFlatParts.find(m => m.userData.partName === data.part);
                            if (mesh) handlePartClick(mesh);
                        }, 500);
                    }
                }, 1000);
            }
        } catch (e) {
            // Invalid hash, ignore
        }
    }

    async function exportAnnotations() {
        const annotations = await db.getAll('annotations');
        if (!annotations.length) {
            alert('No annotations to export');
            return;
        }

        // Build CSV
        let csv = 'Part ID,Note,Created\n';
        annotations.forEach(a => {
            const date = new Date(a.created).toISOString();
            const text = (a.text || '').replace(/"/g, '""');
            csv += `"${a.id}","${text}","${date}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.download = `jarvis3d-annotations-${Date.now()}.csv`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        JarvisSounds.success();
    }

    // ═══════════════════════════════════════════════════════════
    // PWA REGISTRATION
    // ═══════════════════════════════════════════════════════════
    function initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.warn('[PWA] Service worker registration failed:', err);
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SKIP SCAN + INIT
    // ═══════════════════════════════════════════════════════════
    document.getElementById('skip-scan').addEventListener('click', () => {
        document.getElementById('face-video').srcObject?.getTracks().forEach(t => t.stop());
        transitionToMain();
    });

    // Search button
    document.getElementById('search-btn').addEventListener('click', () => {
        JarvisSearch.openSearch();
    });

    // Sound toggle
    document.getElementById('sound-btn').addEventListener('click', () => {
        const enabled = JarvisSounds.toggle();
        document.getElementById('sound-btn').textContent = enabled ? '🔊' : '🔇';
        document.getElementById('sound-btn').classList.toggle('muted', !enabled);
    });

    async function init() {
        await db.open();
        initThree();
        animate();
        initFaceScan();
    }

    init();
})();

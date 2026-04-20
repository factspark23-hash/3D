// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — High-End Procedural Geometry Builder v2
// Realistic Three.js geometry for every built-in project part
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ─── Material presets for realistic look ───
    const MAT = {
        metal(color) {
            return new THREE.MeshStandardMaterial({
                color, metalness: 0.85, roughness: 0.25,
                emissive: color, emissiveIntensity: 0.05,
            });
        },
        chrome(color) {
            return new THREE.MeshStandardMaterial({
                color: color || 0xcccccc, metalness: 0.95, roughness: 0.1,
                emissive: color || 0xcccccc, emissiveIntensity: 0.08,
            });
        },
        glow(color) {
            return new THREE.MeshStandardMaterial({
                color, metalness: 0.3, roughness: 0.4,
                emissive: color, emissiveIntensity: 0.6,
            });
        },
        matte(color) {
            return new THREE.MeshStandardMaterial({
                color, metalness: 0.1, roughness: 0.8,
                emissive: color, emissiveIntensity: 0.03,
            });
        },
        carbon(color) {
            return new THREE.MeshStandardMaterial({
                color: color || 0x222222, metalness: 0.4, roughness: 0.6,
                emissive: color || 0x222222, emissiveIntensity: 0.02,
            });
        },
        rubber(color) {
            return new THREE.MeshStandardMaterial({
                color: color || 0x111111, metalness: 0.0, roughness: 0.95,
                emissive: 0x000000, emissiveIntensity: 0,
            });
        },
        glass(color) {
            return new THREE.MeshStandardMaterial({
                color: color || 0x88ccff, metalness: 0.1, roughness: 0.05,
                transparent: true, opacity: 0.4,
                emissive: color || 0x88ccff, emissiveIntensity: 0.2,
            });
        },
        heat(color) {
            return new THREE.MeshStandardMaterial({
                color: color || 0xff4400, metalness: 0.6, roughness: 0.3,
                emissive: color || 0xff4400, emissiveIntensity: 0.5,
            });
        },
    };

    // ─── Helper: stack multiple meshes vertically ───
    function stack(meshes) {
        const g = new THREE.Group();
        let y = 0;
        meshes.forEach(m => {
            const box = new THREE.Box3().setFromObject(m);
            const size = box.getSize(new THREE.Vector3());
            m.position.y = y - size.y / 2;
            y -= size.y;
            g.add(m);
        });
        return g;
    }

    // ─── Helper: ring of meshes ───
    function ringOf(geoFn, mat, count, radius, yPos) {
        const g = new THREE.Group();
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const m = new THREE.Mesh(typeof geoFn === 'function' ? geoFn() : geoFn, mat);
            m.position.set(Math.cos(a) * radius, yPos, Math.sin(a) * radius);
            g.add(m);
        }
        return g;
    }

    // ─── Helper: merge group to single geometry ───
    function mergeGroup(group) {
        group.updateMatrixWorld(true);
        const geometries = [];
        group.traverse(child => {
            if (child.isMesh && child.geometry) {
                const geo = child.geometry.clone();
                geo.applyMatrix4(child.matrixWorld);
                geometries.push(geo);
            }
        });
        if (geometries.length === 0) return new THREE.BoxGeometry(0.1, 0.1, 0.1);
        if (geometries.length === 1) return geometries[0];

        let totalVerts = 0, hasIndices = true;
        geometries.forEach(g => { totalVerts += g.getAttribute('position').count; if (!g.index) hasIndices = false; });

        const mergedPositions = [];
        const mergedNormals = [];
        const mergedUvs = [];
        const mergedIndices = [];
        let vertOffset = 0;

        geometries.forEach(g => {
            const pos = g.getAttribute('position');
            const norm = g.getAttribute('normal');
            const uv = g.getAttribute('uv');
            let idx;
            if (g.index) idx = g.index.array;
            else { idx = new Uint32Array(pos.count); for (let i = 0; i < pos.count; i++) idx[i] = i; }

            for (let i = 0; i < pos.count; i++) {
                mergedPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                if (norm) mergedNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                else mergedNormals.push(0, 1, 0);
                if (uv) mergedUvs.push(uv.getX(i), uv.getY(i));
                else mergedUvs.push(0, 0);
            }
            for (let i = 0; i < idx.length; i++) mergedIndices.push(idx[i] + vertOffset);
            vertOffset += pos.count;
        });

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
        merged.setAttribute('normal', new THREE.Float32BufferAttribute(mergedNormals, 3));
        merged.setAttribute('uv', new THREE.Float32BufferAttribute(mergedUvs, 2));
        merged.setIndex(mergedIndices);
        return merged;
    }

    // ─── Build mesh with material ───
    function mesh(geo, color, matType) {
        const mat = (MAT[matType] || MAT.metal)(color);
        return new THREE.Mesh(geo, mat);
    }

    // ═══════════════════════════════════════════════════════════
    // GEOMETRY BUILDERS
    // ═══════════════════════════════════════════════════════════
    const Geometries = {};

    // ════════ FALCON ROCKET ════════
    Geometries['nose'] = () => {
        const g = new THREE.Group();
        // Ogive nose cone shape using lathe
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const r = 0.32 * Math.sqrt(1 - t * t);
            pts.push(new THREE.Vector2(r, t * 1.4));
        }
        const cone = mesh(new THREE.LatheGeometry(pts, 32), 0xcccccc, 'chrome');
        g.add(cone);
        // Tip
        const tip = mesh(new THREE.SphereGeometry(0.04, 12, 12), 0xff3300, 'glow');
        tip.position.y = 1.4;
        g.add(tip);
        // Antenna stub
        const ant = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), 0xaaaaaa, 'chrome');
        ant.position.y = 1.5;
        g.add(ant);
        return mergeGroup(g);
    };

    Geometries['payload'] = () => {
        const g = new THREE.Group();
        const body = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 32), 0xaaaaaa, 'metal');
        g.add(body);
        // Panel lines (rings)
        [-0.3, 0, 0.3].forEach(y => {
            const ring = mesh(new THREE.TorusGeometry(0.345, 0.005, 8, 32), 0x888888, 'chrome');
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            g.add(ring);
        });
        return mergeGroup(g);
    };

    Geometries['second-stage'] = () => {
        const g = new THREE.Group();
        // Tapered cylinder
        const body = mesh(new THREE.CylinderGeometry(0.33, 0.37, 1.2, 32), 0x888888, 'metal');
        g.add(body);
        // Nozzle at bottom
        const nozzle = mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.2, 16), 0x444444, 'metal');
        nozzle.position.y = -0.7;
        g.add(nozzle);
        // Interstage ring at top
        const ring = mesh(new THREE.TorusGeometry(0.35, 0.015, 8, 32), 0x666666, 'chrome');
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.6;
        g.add(ring);
        return mergeGroup(g);
    };

    Geometries['interstage'] = () => {
        const g = new THREE.Group();
        const body = mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.35, 32), 0x666666, 'carbon');
        g.add(body);
        // Separation bolts
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const bolt = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), 0x999999, 'chrome');
            bolt.position.set(Math.cos(a) * 0.39, 0, Math.sin(a) * 0.39);
            g.add(bolt);
        }
        return mergeGroup(g);
    };

    Geometries['first-stage'] = () => {
        const g = new THREE.Group();
        // Main body - tapered
        const body = mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.0, 32), 0x00d4ff, 'metal');
        g.add(body);
        // Raceway (cable conduit)
        const raceway = mesh(new THREE.BoxGeometry(0.04, 1.8, 0.03), 0x333333, 'carbon');
        raceway.position.set(0.44, 0, 0);
        g.add(raceway);
        // Grid pattern lines
        for (let i = 0; i < 8; i++) {
            const ring = mesh(new THREE.TorusGeometry(0.46, 0.004, 6, 32), 0x0099bb, 'chrome');
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -0.9 + i * 0.25;
            g.add(ring);
        }
        // LOX label area
        const loxPanel = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.01), 0x00aacc, 'glow');
        loxPanel.position.set(0, 0.3, 0.47);
        g.add(loxPanel);
        return mergeGroup(g);
    };

    Geometries['legs'] = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const legGroup = new THREE.Group();
            // Main strut
            const strut = mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.4, 8), 0xcccccc, 'chrome');
            strut.rotation.z = 0.35;
            legGroup.add(strut);
            // Hydraulic piston
            const piston = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), 0x888888, 'chrome');
            piston.position.set(0.15, -0.3, 0);
            piston.rotation.z = 0.2;
            legGroup.add(piston);
            // Foot pad
            const foot = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 12), 0x666666, 'metal');
            foot.position.set(0.35, -0.7, 0);
            legGroup.add(foot);
            legGroup.rotation.y = a;
            g.add(legGroup);
        }
        return mergeGroup(g);
    };

    Geometries['grid-fins'] = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const finGroup = new THREE.Group();
            // Fin body with grid pattern
            const fin = mesh(new THREE.BoxGeometry(0.32, 0.32, 0.025), 0x006688, 'metal');
            finGroup.add(fin);
            // Grid lines (horizontal)
            for (let j = -2; j <= 2; j++) {
                const line = mesh(new THREE.BoxGeometry(0.3, 0.005, 0.03), 0x004466, 'metal');
                line.position.y = j * 0.06;
                finGroup.add(line);
            }
            // Grid lines (vertical)
            for (let j = -2; j <= 2; j++) {
                const line = mesh(new THREE.BoxGeometry(0.005, 0.3, 0.03), 0x004466, 'metal');
                line.position.x = j * 0.06;
                finGroup.add(line);
            }
            // Mount bracket
            const bracket = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), 0x444444, 'metal');
            bracket.position.z = -0.02;
            finGroup.add(bracket);

            finGroup.position.set(Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5);
            finGroup.rotation.y = a + Math.PI / 2;
            g.add(finGroup);
        }
        return mergeGroup(g);
    };

    Geometries['engine-bell'] = () => {
        const g = new THREE.Group();
        const makeEngine = () => {
            const eg = new THREE.Group();
            // Bell
            const bell = mesh(new THREE.CylinderGeometry(0.14, 0.06, 0.45, 16), 0xff6600, 'heat');
            eg.add(bell);
            // Gimbal mount
            const mount = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), 0x555555, 'metal');
            mount.position.y = 0.25;
            eg.add(mount);
            // Turbopump (small cylinder on side)
            const pump = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), 0x444444, 'metal');
            pump.position.set(0.1, 0.15, 0);
            pump.rotation.z = Math.PI / 2;
            eg.add(pump);
            return eg;
        };
        // 9 engines in circle + center
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const e = makeEngine();
            e.position.set(Math.cos(a) * 0.22, -1.2, Math.sin(a) * 0.22);
            g.add(e);
        }
        const center = makeEngine();
        center.position.set(0, -1.25, 0);
        g.add(center);
        return mergeGroup(g);
    };

    Geometries['fuel-tanks'] = () => {
        const g = new THREE.Group();
        // Main tank body
        const tank = mesh(new THREE.CylinderGeometry(0.4, 0.44, 1.8, 32), 0xff4400, 'heat');
        g.add(tank);
        // Dome top
        const domeTop = mesh(new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xff4400, 'heat');
        domeTop.position.y = 0.9;
        g.add(domeTop);
        // Dome bottom
        const domeBot = mesh(new THREE.SphereGeometry(0.44, 32, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0xff4400, 'heat');
        domeBot.position.y = -0.9;
        g.add(domeBot);
        // Pipe connectors
        const pipe1 = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), 0x666666, 'chrome');
        pipe1.position.set(0.35, 0.5, 0);
        pipe1.rotation.z = 0.5;
        g.add(pipe1);
        return mergeGroup(g);
    };

    // ════════ QUAD DRONE ════════
    Geometries['frame'] = () => {
        const g = new THREE.Group();
        // X-frame body
        const main = mesh(new THREE.BoxGeometry(1.0, 0.05, 1.0), 0x333333, 'carbon');
        g.add(main);
        // Arm channels (X pattern)
        [-1, 1].forEach(sx => {
            [-1, 1].forEach(sz => {
                const arm = mesh(new THREE.BoxGeometry(0.55, 0.04, 0.06), 0x2a2a2a, 'carbon');
                arm.position.set(sx * 0.25, 0, sz * 0.25);
                arm.rotation.y = Math.atan2(sz, sx);
                g.add(arm);
            });
        });
        // Center plate
        const center = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16), 0x222222, 'carbon');
        g.add(center);
        return mergeGroup(g);
    };

    Geometries['top-plate'] = () => {
        const g = new THREE.Group();
        const plate = mesh(new THREE.BoxGeometry(0.35, 0.03, 0.35), 0x444444, 'carbon');
        g.add(plate);
        // Mounting posts
        [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([x, z]) => {
            const post = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), 0x555555, 'metal');
            post.position.set(x, 0.035, z);
            g.add(post);
        });
        return mergeGroup(g);
    };

    function buildDroneArm(x, z) {
        const g = new THREE.Group();
        const angle = Math.atan2(z, x);
        // Arm tube
        const arm = mesh(new THREE.BoxGeometry(0.55, 0.04, 0.05), 0x00ff88, 'metal');
        g.add(arm);
        // Motor mount (circle at end)
        const mount = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), 0x333333, 'metal');
        mount.position.set(0.25, 0.02, 0);
        g.add(mount);
        // LED strip
        const led = mesh(new THREE.BoxGeometry(0.4, 0.005, 0.005), 0x00ff88, 'glow');
        led.position.set(0, -0.025, 0);
        g.add(led);
        // ESC (small box)
        const esc = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.04), 0x222222, 'carbon');
        esc.position.set(-0.1, 0.03, 0);
        g.add(esc);

        g.position.set(x * 0.25, 0, z * 0.25);
        g.rotation.y = -angle;
        return mergeGroup(g);
    }
    Geometries['arm-fl'] = () => buildDroneArm(-0.5, -0.5);
    Geometries['arm-fr'] = () => buildDroneArm(0.5, -0.5);
    Geometries['arm-bl'] = () => buildDroneArm(-0.5, 0.5);
    Geometries['arm-br'] = () => buildDroneArm(0.5, 0.5);

    Geometries['motor'] = () => {
        const g = new THREE.Group();
        // Stator
        const stator = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 16), 0x666666, 'metal');
        g.add(stator);
        // Bell (rotor)
        const bell = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.04, 16), 0x555555, 'chrome');
        bell.position.y = 0.06;
        g.add(bell);
        // Shaft
        const shaft = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), 0x888888, 'chrome');
        shaft.position.y = 0.1;
        g.add(shaft);
        return mergeGroup(g);
    };

    Geometries['prop'] = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const blade = mesh(new THREE.BoxGeometry(0.24, 0.006, 0.035), 0x888888, 'matte');
            blade.rotation.y = (i / 3) * Math.PI;
            blade.position.y = 0.003;
            // Slight pitch
            blade.rotation.z = 0.05;
            g.add(blade);
        }
        // Hub
        const hub = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), 0x555555, 'chrome');
        g.add(hub);
        return mergeGroup(g);
    };

    Geometries['battery'] = () => {
        const g = new THREE.Group();
        const body = mesh(new THREE.BoxGeometry(0.32, 0.1, 0.16), 0xff4444, 'matte');
        g.add(body);
        // Connector
        const conn = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.06), 0x222222, 'rubber');
        conn.position.set(0.18, 0, 0);
        g.add(conn);
        // Label
        const label = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.002), 0xffcc00, 'glow');
        label.position.set(0, 0, 0.081);
        g.add(label);
        return mergeGroup(g);
    };

    Geometries['fc'] = () => {
        const g = new THREE.Group();
        const board = mesh(new THREE.BoxGeometry(0.14, 0.025, 0.14), 0x006600, 'matte');
        g.add(board);
        // MCU chip
        const chip = mesh(new THREE.BoxGeometry(0.04, 0.01, 0.04), 0x111111, 'matte');
        chip.position.y = 0.018;
        g.add(chip);
        // Gyro chip
        const gyro = mesh(new THREE.BoxGeometry(0.02, 0.008, 0.02), 0x222222, 'matte');
        gyro.position.set(0.04, 0.017, 0.03);
        g.add(gyro);
        // USB connector
        const usb = mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), 0x888888, 'chrome');
        usb.position.set(-0.07, 0.02, 0);
        g.add(usb);
        // Capacitors
        [0.03, -0.03].forEach(x => {
            const cap = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), 0x000088, 'matte');
            cap.position.set(x, 0.024, -0.04);
            g.add(cap);
        });
        return mergeGroup(g);
    };

    Geometries['gps'] = () => {
        const g = new THREE.Group();
        const pcb = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.06), 0x003366, 'matte');
        g.add(pcb);
        const antenna = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 12), 0x000033, 'matte');
        antenna.position.y = 0.012;
        g.add(antenna);
        const conn = mesh(new THREE.BoxGeometry(0.02, 0.008, 0.015), 0xcccccc, 'chrome');
        conn.position.set(0, 0.012, -0.03);
        g.add(conn);
        return mergeGroup(g);
    };

    Geometries['camera'] = () => {
        const g = new THREE.Group();
        // Lens
        const lens = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.04, 16), 0x111111, 'rubber');
        g.add(lens);
        // Glass element
        const glass = mesh(new THREE.CircleGeometry(0.03, 16), 0x223344, 'glass');
        glass.position.y = 0.021;
        glass.rotation.x = -Math.PI / 2;
        g.add(glass);
        // Housing
        const housing = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), 0x222222, 'carbon');
        housing.position.y = -0.03;
        g.add(housing);
        return mergeGroup(g);
    };

    // ════════ MECH SUIT ════════
    Geometries['helmet'] = () => {
        const g = new THREE.Group();
        // Main dome
        const dome = mesh(new THREE.SphereGeometry(0.38, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65), 0xff8800, 'metal');
        g.add(dome);
        // Visor
        const visor = mesh(new THREE.SphereGeometry(0.36, 32, 16, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.15, Math.PI * 0.3), 0x00ddff, 'glass');
        visor.position.y = 0.02;
        g.add(visor);
        // Jaw guards
        [-1, 1].forEach(side => {
            const jaw = mesh(new THREE.BoxGeometry(0.08, 0.15, 0.12), 0xdd6600, 'metal');
            jaw.position.set(side * 0.25, -0.15, 0.1);
            g.add(jaw);
        });
        // Ear comms
        [-1, 1].forEach(side => {
            const ear = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), 0x333333, 'carbon');
            ear.position.set(side * 0.38, 0, 0);
            ear.rotation.z = Math.PI / 2;
            g.add(ear);
        });
        return mergeGroup(g);
    };

    Geometries['torso'] = () => {
        const g = new THREE.Group();
        // Chest plate
        const chest = mesh(new THREE.BoxGeometry(0.85, 0.6, 0.5), 0xcc6600, 'metal');
        g.add(chest);
        // Back plate
        const back = mesh(new THREE.BoxGeometry(0.75, 0.55, 0.1), 0xaa5500, 'metal');
        back.position.set(0, 0, -0.3);
        g.add(back);
        // Abdomen (narrower)
        const abs = mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), 0xbb5500, 'metal');
        abs.position.y = -0.5;
        g.add(abs);
        // Spine ridge
        const spine = mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), 0x444444, 'chrome');
        spine.position.set(0, -0.2, -0.33);
        g.add(spine);
        // Reactor housing (hole in chest)
        const housing = mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 24), 0x444444, 'chrome');
        housing.position.set(0, 0.05, 0.26);
        g.add(housing);
        return mergeGroup(g);
    };

    Geometries['reactor'] = () => {
        const g = new THREE.Group();
        // Outer ring
        const outerRing = mesh(new THREE.TorusGeometry(0.15, 0.04, 12, 32), 0x444444, 'chrome');
        g.add(outerRing);
        // Inner ring
        const innerRing = mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 24), 0x666666, 'chrome');
        g.add(innerRing);
        // Core glow
        const core = mesh(new THREE.SphereGeometry(0.06, 16, 16), 0x00ddff, 'glow');
        g.add(core);
        // Spokes
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const spoke = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), 0x444444, 'chrome');
            spoke.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0);
            spoke.rotation.z = a + Math.PI / 2;
            g.add(spoke);
        }
        return mergeGroup(g);
    };

    function buildArm(side) {
        const g = new THREE.Group();
        // Shoulder pauldron
        const pauldron = mesh(new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xdd6600, 'metal');
        g.add(pauldron);
        // Upper arm
        const upper = mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), 0xff6600, 'metal');
        upper.position.y = -0.35;
        g.add(upper);
        // Elbow joint
        const elbow = mesh(new THREE.SphereGeometry(0.08, 12, 12), 0x444444, 'chrome');
        elbow.position.y = -0.6;
        g.add(elbow);
        // Forearm
        const lower = mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), 0xff5500, 'metal');
        lower.position.y = -0.88;
        g.add(lower);
        // Wrist ring
        const wrist = mesh(new THREE.TorusGeometry(0.065, 0.015, 8, 16), 0x444444, 'chrome');
        wrist.rotation.x = Math.PI / 2;
        wrist.position.y = -1.1;
        g.add(wrist);

        g.position.x = side * 0.5;
        return mergeGroup(g);
    }
    Geometries['l-arm'] = () => buildArm(-1);
    Geometries['r-arm'] = () => buildArm(1);

    function buildHand(side) {
        const g = new THREE.Group();
        // Palm
        const palm = mesh(new THREE.BoxGeometry(0.13, 0.16, 0.06), 0xff5500, 'metal');
        g.add(palm);
        // Fingers (3 segments each)
        for (let i = 0; i < 4; i++) {
            const fx = -0.045 + i * 0.03;
            [-0.04, -0.08, -0.11].forEach((fy, si) => {
                const seg = mesh(new THREE.BoxGeometry(0.018, 0.03, 0.016), 0xee5500, 'metal');
                seg.position.set(fx, fy, 0);
                g.add(seg);
            });
        }
        // Thumb
        const thumb1 = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.018), 0xee5500, 'metal');
        thumb1.position.set(-0.075, -0.03, 0);
        thumb1.rotation.z = 0.5;
        g.add(thumb1);
        const thumb2 = mesh(new THREE.BoxGeometry(0.018, 0.04, 0.016), 0xdd4400, 'metal');
        thumb2.position.set(-0.095, -0.07, 0);
        thumb2.rotation.z = 0.5;
        g.add(thumb2);
        // Repulsor (for right hand)
        if (side === 1) {
            const repulsor = mesh(new THREE.CircleGeometry(0.04, 16), 0x00ddff, 'glow');
            repulsor.position.set(0, 0, 0.035);
            g.add(repulsor);
        }

        g.position.set(side * 0.5, -1.05, 0);
        return mergeGroup(g);
    }
    Geometries['l-hand'] = () => buildHand(-1);
    Geometries['r-hand'] = () => buildHand(1);

    function buildLeg(side) {
        const g = new THREE.Group();
        // Hip joint
        const hip = mesh(new THREE.SphereGeometry(0.1, 12, 12), 0x444444, 'chrome');
        g.add(hip);
        // Upper leg (thigh)
        const thigh = mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), 0xff6600, 'metal');
        thigh.position.y = -0.38;
        g.add(thigh);
        // Knee
        const knee = mesh(new THREE.SphereGeometry(0.1, 12, 12), 0x444444, 'chrome');
        knee.position.y = -0.65;
        g.add(knee);
        // Shin guard
        const shin = mesh(new THREE.BoxGeometry(0.14, 0.5, 0.15), 0xff5500, 'metal');
        shin.position.y = -0.96;
        g.add(shin);
        // Hydraulic lines
        const hydro = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), 0x888888, 'chrome');
        hydro.position.set(0.1, -0.8, 0);
        g.add(hydro);

        g.position.x = side * 0.2;
        return mergeGroup(g);
    }
    Geometries['l-leg'] = () => buildLeg(-1);
    Geometries['r-leg'] = () => buildLeg(1);

    function buildThruster() {
        const g = new THREE.Group();
        // Housing
        const housing = mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 12), 0xffaa00, 'metal');
        g.add(housing);
        // Nozzle
        const nozzle = mesh(new THREE.CylinderGeometry(0.13, 0.06, 0.15, 12), 0x444444, 'metal');
        nozzle.position.y = -0.28;
        g.add(nozzle);
        // Flame glow
        const flame = mesh(new THREE.ConeGeometry(0.05, 0.2, 8), 0x00aaff, 'glow');
        flame.position.y = -0.45;
        flame.rotation.x = Math.PI;
        g.add(flame);
        return mergeGroup(g);
    }
    Geometries['thruster-l'] = () => buildThruster();
    Geometries['thruster-r'] = () => buildThruster();

    Geometries['boot-jet'] = () => {
        const g = new THREE.Group();
        // Jet housing
        const housing = mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.18, 10), 0xff9900, 'metal');
        g.add(housing);
        // Thrust cone
        const cone = mesh(new THREE.ConeGeometry(0.05, 0.15, 10), 0x00ddff, 'glow');
        cone.position.y = -0.16;
        cone.rotation.x = Math.PI;
        g.add(cone);
        return mergeGroup(g);
    };

    // ════════ SATELLITE ════════
    Geometries['bus'] = () => {
        const g = new THREE.Group();
        const body = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), 0xcccccc, 'metal');
        g.add(body);
        // MLI panels (gold foil look)
        [-0.41, 0.41].forEach(x => {
            const panel = mesh(new THREE.BoxGeometry(0.01, 0.5, 0.7), 0xccaa44, 'matte');
            panel.position.x = x;
            g.add(panel);
        });
        // Equipment shelves (visible lines)
        for (let i = -2; i <= 2; i++) {
            const line = mesh(new THREE.BoxGeometry(0.81, 0.005, 0.005), 0x999999, 'chrome');
            line.position.set(0, i * 0.12, 0.41);
            g.add(line);
        }
        return mergeGroup(g);
    };

    Geometries['antenna-dish'] = () => {
        const g = new THREE.Group();
        // Parabolic dish
        const dish = mesh(new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.28), 0xdddddd, 'chrome');
        dish.rotation.x = Math.PI;
        g.add(dish);
        // Support struts
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const strut = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), 0x999999, 'chrome');
            strut.position.set(Math.cos(a) * 0.15, -0.2, Math.sin(a) * 0.15);
            strut.rotation.z = 0.3 * Math.cos(a);
            strut.rotation.x = 0.3 * Math.sin(a);
            g.add(strut);
        }
        return mergeGroup(g);
    };

    Geometries['antenna-horn'] = () => {
        const g = new THREE.Group();
        const horn = mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.3, 16), 0xbbbbbb, 'chrome');
        g.add(horn);
        // Waveguide
        const waveguide = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), 0x999999, 'chrome');
        waveguide.position.y = 0.2;
        g.add(waveguide);
        return mergeGroup(g);
    };

    Geometries['solar-l'] = () => {
        const g = new THREE.Group();
        // Panel array
        for (let i = 0; i < 3; i++) {
            const panel = mesh(new THREE.BoxGeometry(0.48, 0.012, 0.55), 0x0000aa, 'matte');
            panel.position.x = i * 0.5 - 0.5;
            g.add(panel);
            // Cell grid
            const grid = mesh(new THREE.BoxGeometry(0.46, 0.013, 0.53), 0x000088, 'matte');
            grid.position.x = i * 0.5 - 0.5;
            g.add(grid);
        }
        // Deployment hinge
        const hinge = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), 0x888888, 'chrome');
        hinge.position.set(-0.75, 0, 0);
        hinge.rotation.z = Math.PI / 2;
        g.add(hinge);
        return mergeGroup(g);
    };

    Geometries['solar-r'] = () => {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const panel = mesh(new THREE.BoxGeometry(0.48, 0.012, 0.55), 0x0000aa, 'matte');
            panel.position.x = -(i * 0.5 - 0.5);
            g.add(panel);
            const grid = mesh(new THREE.BoxGeometry(0.46, 0.013, 0.53), 0x000088, 'matte');
            grid.position.x = -(i * 0.5 - 0.5);
            g.add(grid);
        }
        const hinge = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), 0x888888, 'chrome');
        hinge.position.set(0.75, 0, 0);
        hinge.rotation.z = Math.PI / 2;
        g.add(hinge);
        return mergeGroup(g);
    };

    Geometries['battery-pak'] = () => {
        const g = new THREE.Group();
        const pack = mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), 0x444444, 'metal');
        g.add(pack);
        // Cells visible
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const cell = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.23, 8), 0x333333, 'chrome');
                cell.position.set(x * 0.09, 0, z * 0.09);
                g.add(cell);
            }
        }
        return mergeGroup(g);
    };

    Geometries['radiator'] = () => {
        const g = new THREE.Group();
        const panel = mesh(new THREE.BoxGeometry(0.5, 0.015, 0.4), 0x888888, 'metal');
        g.add(panel);
        // Heat pipes
        for (let i = 0; i < 5; i++) {
            const pipe = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.48, 6), 0x666666, 'chrome');
            pipe.position.set(0, 0.01, -0.15 + i * 0.08);
            pipe.rotation.z = Math.PI / 2;
            g.add(pipe);
        }
        return mergeGroup(g);
    };

    Geometries['thruster-cluster'] = () => {
        const g = new THREE.Group();
        const positions = [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]];
        positions.forEach(([x, z]) => {
            const thruster = new THREE.Group();
            const body = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), 0x555555, 'metal');
            thruster.add(body);
            const nozzle = mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.05, 10), 0x4400ff, 'glow');
            nozzle.position.y = -0.08;
            thruster.add(nozzle);
            thruster.position.set(x, 0, z);
            g.add(thruster);
        });
        // Mounting plate
        const plate = mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), 0x444444, 'metal');
        g.add(plate);
        return mergeGroup(g);
    };

    Geometries['fuel-tank-sat'] = () => {
        const g = new THREE.Group();
        const tank = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 16), 0x666666, 'metal');
        g.add(tank);
        // Hemispherical caps
        const topCap = mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x666666, 'metal');
        topCap.position.y = 0.25;
        g.add(topCap);
        const botCap = mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0x666666, 'metal');
        botCap.position.y = -0.25;
        g.add(botCap);
        return mergeGroup(g);
    };

    // ════════ SPORTS CAR ════════
    Geometries['body'] = () => {
        const g = new THREE.Group();
        // Car body using lathe + extrusion
        const shape = new THREE.Shape();
        shape.moveTo(-1.1, 0);
        shape.lineTo(-0.9, 0.12);
        shape.bezierCurveTo(-0.6, 0.2, -0.4, 0.35, -0.2, 0.38);
        shape.lineTo(0.3, 0.38);
        shape.bezierCurveTo(0.5, 0.35, 0.7, 0.25, 0.9, 0.15);
        shape.lineTo(1.1, 0.08);
        shape.lineTo(1.1, 0);
        shape.lineTo(-1.1, 0);

        const body = mesh(new THREE.ExtrudeGeometry(shape, {
            depth: 0.65, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 3
        }), 0xff0044, 'metal');
        body.position.z = -0.325;
        g.add(body);

        // Windshield
        const ws = mesh(new THREE.BoxGeometry(0.35, 0.2, 0.55), 0x88ccff, 'glass');
        ws.position.set(-0.15, 0.42, 0);
        ws.rotation.z = -0.4;
        g.add(ws);

        // Side mirrors
        [-1, 1].forEach(side => {
            const mirror = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), 0xff0044, 'metal');
            mirror.position.set(-0.2, 0.3, side * 0.38);
            g.add(mirror);
            const mirrorGlass = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.005), 0xaabbcc, 'glass');
            mirrorGlass.position.set(-0.2, 0.3, side * 0.42);
            g.add(mirrorGlass);
        });
        return mergeGroup(g);
    };

    Geometries['hood'] = () => {
        const g = new THREE.Group();
        const hood = mesh(new THREE.BoxGeometry(0.65, 0.04, 0.55), 0xcc0033, 'metal');
        g.add(hood);
        // Air intake vents
        for (let i = 0; i < 3; i++) {
            const vent = mesh(new THREE.BoxGeometry(0.08, 0.005, 0.4), 0x111111, 'carbon');
            vent.position.set(-0.15 + i * 0.15, 0.025, 0);
            g.add(vent);
        }
        return mergeGroup(g);
    };

    Geometries['spoiler'] = () => {
        const g = new THREE.Group();
        // Wing
        const wing = mesh(new THREE.BoxGeometry(0.85, 0.015, 0.16), 0xaa0022, 'carbon');
        wing.position.y = 0.08;
        // Slight angle
        wing.rotation.z = 0.02;
        g.add(wing);
        // Wing endplates
        [-1, 1].forEach(side => {
            const plate = mesh(new THREE.BoxGeometry(0.01, 0.1, 0.18), 0xaa0022, 'carbon');
            plate.position.set(side * 0.42, 0.04, 0);
            g.add(plate);
        });
        // Support pillars
        [-0.25, 0.25].forEach(x => {
            const pillar = mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.16, 8), 0x333333, 'chrome');
            pillar.position.set(x, -0.005, 0);
            g.add(pillar);
        });
        // DRS actuator
        const actuator = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), 0x555555, 'chrome');
        actuator.position.set(0, 0.02, 0.08);
        g.add(actuator);
        return mergeGroup(g);
    };

    Geometries['diffuser'] = () => {
        const g = new THREE.Group();
        // Main diffuser shape
        const diff = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), 0x880011, 'carbon');
        g.add(diff);
        // Vertical fins
        for (let i = 0; i < 4; i++) {
            const fin = mesh(new THREE.BoxGeometry(0.005, 0.1, 0.3), 0x660011, 'carbon');
            fin.position.set(-0.2 + i * 0.13, 0, 0);
            g.add(fin);
        }
        // Exhaust tips
        [-0.15, 0.15].forEach(x => {
            const tip = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 12), 0x444444, 'chrome');
            tip.position.set(x, -0.02, -0.2);
            tip.rotation.x = Math.PI / 2;
            g.add(tip);
        });
        return mergeGroup(g);
    };

    function buildWheel() {
        const g = new THREE.Group();
        // Tire
        const tire = mesh(new THREE.TorusGeometry(0.12, 0.05, 16, 32), 0x111111, 'rubber');
        g.add(tire);
        // Tread pattern
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const tread = mesh(new THREE.BoxGeometry(0.005, 0.005, 0.1), 0x0a0a0a, 'rubber');
            tread.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
            tread.rotation.z = a;
            g.add(tread);
        }
        // Rim
        const rim = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24), 0x888888, 'chrome');
        rim.rotation.x = Math.PI / 2;
        g.add(rim);
        // Spokes
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const spoke = mesh(new THREE.BoxGeometry(0.015, 0.08, 0.02), 0x777777, 'chrome');
            spoke.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0);
            spoke.rotation.z = a;
            g.add(spoke);
        }
        // Center cap
        const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12), 0xff0044, 'metal');
        cap.rotation.x = Math.PI / 2;
        g.add(cap);
        // Brake disc (visible through spokes)
        const disc = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 20), 0x666666, 'metal');
        disc.rotation.x = Math.PI / 2;
        g.add(disc);
        // Brake caliper
        const caliper = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.015), 0xff4400, 'metal');
        caliper.position.set(0.05, 0.05, 0);
        g.add(caliper);
        return mergeGroup(g);
    }
    Geometries['wheel-fl'] = () => buildWheel();
    Geometries['wheel-fr'] = () => buildWheel();
    Geometries['wheel-rl'] = () => buildWheel();
    Geometries['wheel-rr'] = () => buildWheel();

    Geometries['motor-f'] = () => {
        const g = new THREE.Group();
        const housing = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 24), 0x00aaff, 'metal');
        g.add(housing);
        // Cooling fins
        for (let i = 0; i < 8; i++) {
            const fin = mesh(new THREE.BoxGeometry(0.01, 0.2, 0.03), 0x0088cc, 'metal');
            const a = (i / 8) * Math.PI * 2;
            fin.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
            fin.rotation.y = a;
            g.add(fin);
        }
        // Axle
        const axle = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8), 0x888888, 'chrome');
        axle.rotation.x = Math.PI / 2;
        g.add(axle);
        return mergeGroup(g);
    };

    Geometries['motor-r'] = () => {
        const g = new THREE.Group();
        [-0.12, 0.12].forEach(z => {
            const motor = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 24), 0x00aaff, 'metal');
            motor.position.z = z;
            g.add(motor);
            // Cooling fins
            for (let i = 0; i < 6; i++) {
                const fin = mesh(new THREE.BoxGeometry(0.01, 0.2, 0.025), 0x0088cc, 'metal');
                const a = (i / 6) * Math.PI * 2;
                fin.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14 + z);
                fin.rotation.y = a;
                g.add(fin);
            }
        });
        return mergeGroup(g);
    };

    Geometries['battery-car'] = () => {
        const g = new THREE.Group();
        // Battery pack housing
        const housing = mesh(new THREE.BoxGeometry(1.0, 0.14, 0.55), 0x00ff00, 'metal');
        g.add(housing);
        // Cell modules
        for (let i = 0; i < 6; i++) {
            const mod = mesh(new THREE.BoxGeometry(0.14, 0.1, 0.48), 0x00aa00, 'metal');
            mod.position.set(-0.42 + i * 0.17, 0, 0);
            g.add(mod);
        }
        // Cooling channels
        for (let i = 0; i < 5; i++) {
            const channel = mesh(new THREE.BoxGeometry(0.14, 0.01, 0.5), 0x004400, 'metal');
            channel.position.set(-0.35 + i * 0.17, 0.075, 0);
            g.add(channel);
        }
        // High voltage connectors
        [-0.4, 0.4].forEach(x => {
            const conn = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), 0xff8800, 'glow');
            conn.position.set(x, 0.09, 0);
            g.add(conn);
        });
        return mergeGroup(g);
    };

    // ════════ SUBMARINE ════════
    Geometries['hull'] = () => {
        const g = new THREE.Group();
        // Main pressure hull (tapered cylinder)
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            let r = 0.48;
            // Taper at nose and tail
            if (t < 0.15) r *= 0.3 + 0.7 * (t / 0.15);
            if (t > 0.85) r *= 0.3 + 0.7 * ((1 - t) / 0.15);
            pts.push(new THREE.Vector2(r, t * 3 - 1.5));
        }
        const hullGeo = new THREE.LatheGeometry(pts, 32);
        hullGeo.rotateZ(Math.PI / 2);
        const hull = mesh(hullGeo, 0x445566, 'metal');
        g.add(hull);
        // Hull seams
        for (let i = 0; i < 6; i++) {
            const seam = mesh(new THREE.TorusGeometry(0.49, 0.008, 6, 32), 0x334455, 'chrome');
            seam.position.x = -1.2 + i * 0.48;
            seam.rotation.y = Math.PI / 2;
            g.add(seam);
        }
        // Anodes (zinc sacrificial anodes)
        for (let i = 0; i < 4; i++) {
            const anode = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.06), 0xccaa44, 'matte');
            anode.position.set(-0.8 + i * 0.5, -0.48, 0);
            g.add(anode);
        }
        return mergeGroup(g);
    };

    Geometries['tower'] = () => {
        const g = new THREE.Group();
        // Sail (conning tower)
        const sail = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), 0x556677, 'metal');
        g.add(sail);
        // Fairwater (rounded front)
        const fairwater = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.6, 12), 0x556677, 'metal');
        fairwater.position.set(-0.1, 0, 0);
        g.add(fairwater);
        // Periscope
        const peri = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), 0x444444, 'chrome');
        peri.position.set(0.05, 0.5, 0);
        g.add(peri);
        // Periscope housing
        const periHousing = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), 0x444444, 'chrome');
        periHousing.position.set(0.05, 0.25, 0);
        g.add(periHousing);
        // Mast
        const mast = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6), 0x666666, 'chrome');
        mast.position.set(-0.1, 0.47, 0);
        g.add(mast);
        // Antenna
        const ant = mesh(new THREE.SphereGeometry(0.015, 8, 8), 0xff4444, 'glow');
        ant.position.set(-0.1, 0.65, 0);
        g.add(ant);
        return mergeGroup(g);
    };

    Geometries['ballast-f'] = () => {
        const g = new THREE.Group();
        const tank = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16), 0x334455, 'metal');
        g.add(tank);
        // Blow valve
        const valve = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), 0x555555, 'chrome');
        valve.position.set(0.2, 0.28, 0);
        g.add(valve);
        // Vent
        const vent = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6), 0x444444, 'metal');
        vent.position.set(-0.15, 0.28, 0.1);
        g.add(vent);
        return mergeGroup(g);
    };

    Geometries['ballast-a'] = () => {
        const g = new THREE.Group();
        const tank = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16), 0x334455, 'metal');
        g.add(tank);
        // Trim indicators
        [-1, 1].forEach(side => {
            const ind = mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), 0x00ff88, 'glow');
            ind.position.set(0.28, 0, side * 0.1);
            g.add(ind);
        });
        return mergeGroup(g);
    };

    Geometries['prop-sub'] = () => {
        const g = new THREE.Group();
        // Hub
        const hub = mesh(new THREE.SphereGeometry(0.07, 12, 12), 0x666666, 'chrome');
        g.add(hub);
        // Pump-jet shroud
        const shroud = mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24), 0x555555, 'metal');
        shroud.rotation.y = Math.PI / 2;
        g.add(shroud);
        // Blades (7 blades for pump jet)
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const blade = mesh(new THREE.BoxGeometry(0.01, 0.25, 0.08), 0x555555, 'metal');
            blade.position.set(0, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
            blade.rotation.x = a;
            // Slight pitch
            blade.rotation.y = 0.15;
            g.add(blade);
        }
        g.position.x = -1.6;
        return mergeGroup(g);
    };

    Geometries['thruster-sub'] = () => {
        const g = new THREE.Group();
        const body = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.15, 10), 0x555555, 'metal');
        body.rotation.z = Math.PI / 2;
        g.add(body);
        // Nozzle
        const nozzle = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.04, 10), 0x444444, 'metal');
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.x = 0.09;
        g.add(nozzle);
        // Grate
        const grate = mesh(new THREE.CircleGeometry(0.05, 8), 0x333333, 'metal');
        grate.position.x = -0.08;
        grate.rotation.y = Math.PI / 2;
        g.add(grate);
        return mergeGroup(g);
    };

    Geometries['sonar'] = () => {
        const g = new THREE.Group();
        // Spherical array
        const sphere = mesh(new THREE.SphereGeometry(0.2, 24, 24), 0x00ccaa, 'metal');
        g.add(sphere);
        // Transducer elements
        for (let i = 0; i < 12; i++) {
            const phi = Math.acos(-1 + (2 * i + 1) / 12);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const x = 0.21 * Math.sin(phi) * Math.cos(theta);
            const y = 0.21 * Math.sin(phi) * Math.sin(theta);
            const z = 0.21 * Math.cos(phi);
            const elem = mesh(new THREE.SphereGeometry(0.015, 6, 6), 0x00ffcc, 'glow');
            elem.position.set(x, y, z);
            g.add(elem);
        }
        return mergeGroup(g);
    };

    Geometries['camera-sub'] = () => {
        const g = new THREE.Group();
        // Housing
        const housing = mesh(new THREE.SphereGeometry(0.07, 16, 16), 0x222222, 'metal');
        g.add(housing);
        // Lens dome
        const dome = mesh(new THREE.SphereGeometry(0.055, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x445566, 'glass');
        dome.position.y = 0.02;
        g.add(dome);
        // LED ring
        const ledRing = mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 16), 0xffffff, 'glow');
        ledRing.rotation.x = Math.PI / 2;
        ledRing.position.y = 0.04;
        g.add(ledRing);
        // Mount bracket
        const bracket = mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), 0x333333, 'metal');
        bracket.position.y = -0.08;
        g.add(bracket);
        return mergeGroup(g);
    };

    // ════════ SPACE STATION ════════
    Geometries['core'] = () => {
        const g = new THREE.Group();
        // Main module
        const module = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 24), 0xccccdd, 'metal');
        g.add(module);
        // End caps
        const topCap = mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xccccdd, 'metal');
        topCap.position.y = 0.75;
        g.add(topCap);
        const botCap = mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0xccccdd, 'metal');
        botCap.position.y = -0.75;
        g.add(botCap);
        // Docking ports (3 around the middle)
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const port = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), 0x888888, 'chrome');
            port.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
            port.rotation.z = Math.PI / 2;
            port.rotation.y = a;
            g.add(port);
        }
        // Window strip
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const win = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), 0x88ccff, 'glow');
            win.position.set(Math.cos(a) * 0.41, 0.3, Math.sin(a) * 0.41);
            win.rotation.y = a;
            g.add(win);
        }
        return mergeGroup(g);
    };

    Geometries['lab'] = () => {
        const g = new THREE.Group();
        const module = mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16), 0xbbbbcc, 'metal');
        g.add(module);
        // Experiment racks (visible as colored panels)
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const rack = mesh(new THREE.BoxGeometry(0.15, 0.3, 0.01), [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff][i], 'glow');
            rack.position.set(Math.cos(a) * 0.355, 0, Math.sin(a) * 0.355);
            rack.rotation.y = a;
            g.add(rack);
        }
        return mergeGroup(g);
    };

    Geometries['node'] = () => {
        const g = new THREE.Group();
        // Cylindrical node
        const body = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12), 0xaaaabb, 'metal');
        g.add(body);
        // 6 docking ports
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const port = mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), 0x888888, 'chrome');
            port.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
            port.rotation.y = a;
            g.add(port);
        }
        // Top and bottom ports
        [-1, 1].forEach(y => {
            const port = mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), 0x888888, 'chrome');
            port.position.y = y * 0.22;
            port.rotation.x = Math.PI / 2;
            g.add(port);
        });
        return mergeGroup(g);
    };

    Geometries['arm'] = () => {
        const g = new THREE.Group();
        // 5-segment robotic arm
        for (let i = 0; i < 5; i++) {
            const seg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 8), 0x888888, 'chrome');
            seg.position.x = i * 0.36;
            seg.rotation.z = Math.PI / 2;
            g.add(seg);
            // Joint
            if (i < 4) {
                const joint = mesh(new THREE.SphereGeometry(0.04, 8, 8), 0x666666, 'chrome');
                joint.position.x = i * 0.36 + 0.19;
                g.add(joint);
            }
        }
        // End effector (gripper)
        const grip1 = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.01), 0xaaaaaa, 'chrome');
        grip1.position.set(1.85, 0.03, 0);
        g.add(grip1);
        const grip2 = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.01), 0xaaaaaa, 'chrome');
        grip2.position.set(1.85, -0.03, 0);
        g.add(grip2);
        return mergeGroup(g);
    };

    Geometries['solar-station'] = () => {
        const g = new THREE.Group();
        // 3 panel arrays
        for (let i = 0; i < 3; i++) {
            const panel = mesh(new THREE.BoxGeometry(1.5, 0.015, 0.48), 0x0044aa, 'matte');
            panel.position.z = i * 0.52 - 0.52;
            g.add(panel);
            // Cell grid lines
            for (let j = 0; j < 6; j++) {
                const line = mesh(new THREE.BoxGeometry(0.005, 0.016, 0.46), 0x003388, 'matte');
                line.position.set(-0.7 + j * 0.28, 0, i * 0.52 - 0.52);
                g.add(line);
            }
            for (let j = 0; j < 3; j++) {
                const line = mesh(new THREE.BoxGeometry(1.48, 0.016, 0.005), 0x003388, 'matte');
                line.position.set(0, 0, i * 0.52 - 0.52 - 0.15 + j * 0.15);
                g.add(line);
            }
        }
        // Boom
        const boom = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), 0x888888, 'chrome');
        boom.position.z = -0.85;
        g.add(boom);
        return mergeGroup(g);
    };

    Geometries['radiator-station'] = () => {
        const g = new THREE.Group();
        const panel = mesh(new THREE.BoxGeometry(0.8, 0.015, 0.5), 0x999999, 'metal');
        g.add(panel);
        // Ammonia loop pipes
        for (let i = 0; i < 6; i++) {
            const pipe = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.78, 6), 0x777777, 'chrome');
            pipe.position.set(0, 0.01, -0.2 + i * 0.08);
            pipe.rotation.z = Math.PI / 2;
            g.add(pipe);
        }
        // Manifold
        [-0.42, 0.42].forEach(x => {
            const manifold = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), 0x666666, 'chrome');
            manifold.position.set(x, 0.01, 0);
            g.add(manifold);
        });
        return mergeGroup(g);
    };

    // ════════ BATTLE TANK ════════
    Geometries['turret'] = () => {
        const g = new THREE.Group();
        // Turret body (angular)
        const body = mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.35, 8), 0x556644, 'metal');
        g.add(body);
        // Turret bustle (rear)
        const bustle = mesh(new THREE.BoxGeometry(0.35, 0.25, 0.3), 0x556644, 'metal');
        bustle.position.set(0, 0.05, -0.35);
        g.add(bustle);
        // Commander's hatch
        const hatch = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), 0x445533, 'metal');
        hatch.position.set(-0.1, 0.2, 0.1);
        g.add(hatch);
        // CROWS (remote weapon station)
        const crows = mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), 0x333333, 'carbon');
        crows.position.set(-0.1, 0.3, 0.1);
        g.add(crows);
        // Sights
        const sight = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.08), 0x222222, 'carbon');
        sight.position.set(0.15, 0.22, 0.2);
        g.add(sight);
        return mergeGroup(g);
    };

    Geometries['barrel'] = () => {
        const g = new THREE.Group();
        // Main barrel
        const barrel = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 16), 0x445533, 'metal');
        barrel.rotation.z = -Math.PI / 2;
        g.add(barrel);
        // Muzzle brake
        const muzzle = mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), 0x445533, 'metal');
        muzzle.rotation.z = -Math.PI / 2;
        muzzle.position.x = -0.8;
        g.add(muzzle);
        // Bore evacuator
        const evac = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), 0x445533, 'metal');
        evac.rotation.z = -Math.PI / 2;
        evac.position.x = -0.3;
        g.add(evac);
        // Thermal sleeve
        const sleeve = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12), 0x556644, 'metal');
        sleeve.rotation.z = -Math.PI / 2;
        sleeve.position.x = -0.1;
        g.add(sleeve);
        return mergeGroup(g);
    };

    Geometries['hull-tank'] = () => {
        const g = new THREE.Group();
        // Main hull (angular wedge shape)
        const hull = mesh(new THREE.BoxGeometry(1.6, 0.35, 0.95), 0x667744, 'metal');
        g.add(hull);
        // Glacis plate (angled front)
        const glacis = mesh(new THREE.BoxGeometry(0.4, 0.35, 0.95), 0x667744, 'metal');
        glacis.position.set(0.85, 0.08, 0);
        glacis.rotation.z = -0.3;
        g.add(glacis);
        // Front mud guards
        [-1, 1].forEach(side => {
            const guard = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.15), 0x556644, 'metal');
            guard.position.set(0.6, -0.15, side * 0.5);
            g.add(guard);
        });
        // Engine deck grilles
        for (let i = 0; i < 4; i++) {
            const grill = mesh(new THREE.BoxGeometry(0.3, 0.01, 0.04), 0x333333, 'metal');
            grill.position.set(-0.5 + i * 0.1, 0.18, -0.2);
            g.add(grill);
        }
        return mergeGroup(g);
    };

    Geometries['reactive'] = () => {
        const g = new THREE.Group();
        // ERA tiles (arranged on hull surface)
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const tile = mesh(new THREE.BoxGeometry(0.22, 0.2, 0.04), 0x778855, 'metal');
                tile.position.set(-0.3 + col * 0.25, 0.18 + row * 0.22, 0.48);
                g.add(tile);
                // Tile seam
                const seam = mesh(new THREE.BoxGeometry(0.23, 0.21, 0.005), 0x556633, 'metal');
                seam.position.set(-0.3 + col * 0.25, 0.18 + row * 0.22, 0.5);
                g.add(seam);
            }
        }
        // Side ERA
        for (let col = 0; col < 3; col++) {
            const tile = mesh(new THREE.BoxGeometry(0.25, 0.18, 0.04), 0x778855, 'metal');
            tile.position.set(0.2 + col * 0.25, 0.05, 0.52);
            g.add(tile);
        }
        return mergeGroup(g);
    };

    function buildTrack() {
        const g = new THREE.Group();
        // Track links (individual segments)
        const numLinks = 24;
        for (let i = 0; i < numLinks; i++) {
            const a = (i / numLinks) * Math.PI * 2;
            const r = 0.3;
            const link = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), 0x333333, 'rubber');
            link.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
            link.rotation.z = a;
            g.add(link);
        }
        // Road wheels
        for (let i = 0; i < 6; i++) {
            const wheel = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), 0x444444, 'metal');
            wheel.position.set(-0.5 + i * 0.22, -0.2, 0);
            wheel.rotation.x = Math.PI / 2;
            g.add(wheel);
        }
        // Drive sprocket
        const sprocket = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), 0x555555, 'chrome');
        sprocket.position.set(0.6, -0.05, 0);
        sprocket.rotation.x = Math.PI / 2;
        g.add(sprocket);
        // Idler wheel
        const idler = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), 0x444444, 'metal');
        idler.position.set(-0.6, -0.05, 0);
        idler.rotation.x = Math.PI / 2;
        g.add(idler);
        return mergeGroup(g);
    }
    Geometries['track-l'] = () => buildTrack();
    Geometries['track-r'] = () => buildTrack();

    Geometries['engine-tank'] = () => {
        const g = new THREE.Group();
        // Turbine body
        const body = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.45, 16), 0x884400, 'metal');
        g.add(body);
        // Intake
        const intake = mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.15, 12), 0x555555, 'metal');
        intake.position.set(0.15, 0.15, 0);
        intake.rotation.z = 0.8;
        g.add(intake);
        // Exhaust
        const exhaust = mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.2, 10), 0x444444, 'heat');
        exhaust.position.set(-0.15, 0, -0.2);
        exhaust.rotation.x = Math.PI / 2;
        g.add(exhaust);
        // Access panels
        const panel = mesh(new THREE.BoxGeometry(0.15, 0.2, 0.01), 0x774400, 'metal');
        panel.position.set(0, 0, 0.23);
        g.add(panel);
        return mergeGroup(g);
    };

    // ════════ STEALTH JET ════════
    Geometries['fuselage'] = () => {
        const g = new THREE.Group();
        // Low-observable fuselage (faceted shape)
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            let r = 0.28;
            // Sharper nose
            if (t < 0.2) r *= 0.1 + 0.9 * Math.pow(t / 0.2, 0.6);
            // Tapered tail
            if (t > 0.8) r *= 0.3 + 0.7 * ((1 - t) / 0.2);
            // Flat bottom for stealth
            pts.push(new THREE.Vector2(r, t * 3 - 1.5));
        }
        const fuseGeo = new THREE.LatheGeometry(pts, 6); // 6 sides = faceted stealth look
        fuseGeo.rotateZ(-Math.PI / 2);
        const fuse = mesh(fuseGeo, 0x555566, 'matte');
        g.add(fuse);

        // Weapons bay doors (lines on bottom)
        const bayDoor1 = mesh(new THREE.BoxGeometry(1.0, 0.005, 0.005), 0x444455, 'matte');
        bayDoor1.position.set(0, -0.28, 0.06);
        g.add(bayDoor1);
        const bayDoor2 = mesh(new THREE.BoxGeometry(1.0, 0.005, 0.005), 0x444455, 'matte');
        bayDoor2.position.set(0, -0.28, -0.06);
        g.add(bayDoor2);
        return mergeGroup(g);
    };

    function buildWing(side) {
        const g = new THREE.Group();
        // Blended wing-body (delta-like)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(side * 1.6, -0.6);
        shape.lineTo(side * 1.4, -0.15);
        shape.lineTo(side * 0.3, 0.1);
        shape.lineTo(0, 0.05);

        const wing = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), 0x666677, 'matte');
        wing.position.z = -0.015;
        g.add(wing);

        // Control surfaces (ailerons)
        const aileron = mesh(new THREE.BoxGeometry(0.4, 0.005, 0.3), 0x555566, 'matte');
        aileron.position.set(side * 1.2, -0.01, -0.35);
        g.add(aileron);

        // Wingtip
        const tip = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.15), 0x444455, 'matte');
        tip.position.set(side * 1.55, 0, -0.5);
        g.add(tip);
        return mergeGroup(g);
    }
    Geometries['wing-l'] = () => buildWing(-1);
    Geometries['wing-r'] = () => buildWing(1);

    Geometries['tail-v'] = () => {
        const g = new THREE.Group();
        // Canted twin vertical stabilizers
        [-1, 1].forEach(side => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(side * 0.15, 0.7);
            shape.lineTo(side * 0.05, 0.65);
            shape.lineTo(0, 0.08);
            const fin = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), 0x444455, 'matte');
            fin.position.set(-0.01, 0, side * 0.05);
            g.add(fin);
            // Rudder
            const rudder = mesh(new THREE.BoxGeometry(0.01, 0.3, 0.08), 0x333344, 'matte');
            rudder.position.set(-0.02, 0.4, side * 0.1);
            g.add(rudder);
        });
        return mergeGroup(g);
    };

    Geometries['intake'] = () => {
        const g = new THREE.Group();
        // S-duct intake
        const duct = mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.7, 12), 0x333344, 'metal');
        duct.rotation.z = Math.PI / 2;
        g.add(duct);
        // Intake lip
        const lip = mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 16), 0x444455, 'metal');
        lip.position.x = -0.35;
        lip.rotation.y = Math.PI / 2;
        g.add(lip);
        // DSI bump (diverterless supersonic inlet)
        const bump = mesh(new THREE.SphereGeometry(0.08, 12, 8), 0x333344, 'metal');
        bump.position.set(-0.35, 0.05, 0);
        bump.scale.set(1, 0.5, 1.5);
        g.add(bump);
        return mergeGroup(g);
    };

    Geometries['engine-jet'] = () => {
        const g = new THREE.Group();
        // Turbofan core
        const core = mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 16), 0x664422, 'metal');
        g.add(core);
        // Fan face
        const fan = mesh(new THREE.CircleGeometry(0.14, 16), 0x555555, 'chrome');
        fan.position.y = 0.43;
        fan.rotation.x = -Math.PI / 2;
        g.add(fan);
        // Fan blades (simplified)
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const blade = mesh(new THREE.BoxGeometry(0.005, 0.002, 0.12), 0x888888, 'chrome');
            blade.position.set(Math.cos(a) * 0.06, 0.435, Math.sin(a) * 0.06);
            blade.rotation.y = a + 0.2;
            g.add(blade);
        }
        // Afterburner ring
        const abRing = mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 16), 0x775533, 'heat');
        abRing.position.y = -0.43;
        abRing.rotation.x = Math.PI / 2;
        g.add(abRing);
        return mergeGroup(g);
    };

    Geometries['nozzle'] = () => {
        const g = new THREE.Group();
        // 3D thrust vectoring nozzle petals
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const petal = mesh(new THREE.BoxGeometry(0.04, 0.01, 0.08), 0x775533, 'metal');
            const r = 0.1;
            petal.position.set(Math.cos(a) * r, -0.15, Math.sin(a) * r);
            petal.rotation.y = a;
            // Slight convergence
            petal.rotation.z = 0.1;
            g.add(petal);
        }
        // Outer ring
        const outerRing = mesh(new THREE.TorusGeometry(0.12, 0.01, 8, 24), 0x666666, 'chrome');
        outerRing.position.y = -0.1;
        outerRing.rotation.x = Math.PI / 2;
        g.add(outerRing);
        return mergeGroup(g);
    };

    Geometries['radar'] = () => {
        const g = new THREE.Group();
        // AESA array face
        const array = mesh(new THREE.BoxGeometry(0.32, 0.015, 0.27), 0x00aaff, 'metal');
        g.add(array);
        // T/R modules (grid of dots)
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 6; z++) {
                const mod = mesh(new THREE.BoxGeometry(0.025, 0.005, 0.025), 0x0088cc, 'glow');
                mod.position.set(-0.12 + x * 0.035, 0.01, -0.08 + z * 0.035);
                g.add(mod);
            }
        }
        // Back plate
        const back = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.25), 0x333333, 'carbon');
        back.position.y = -0.025;
        g.add(back);
        return mergeGroup(g);
    };

    Geometries['cockpit'] = () => {
        const g = new THREE.Group();
        // Canopy (bubble)
        const canopy = mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x222233, 'glass');
        g.add(canopy);
        // Frame rails
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const rail = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 4), 0x444455, 'metal');
            rail.position.set(Math.cos(a) * 0.21, 0.08, Math.sin(a) * 0.21);
            rail.rotation.z = -Math.cos(a) * 0.3;
            rail.rotation.x = -Math.sin(a) * 0.3;
            g.add(rail);
        }
        // HUD
        const hud = mesh(new THREE.PlaneGeometry(0.12, 0.06), 0x00ff88, 'glass');
        hud.position.set(0, 0.12, 0.15);
        hud.rotation.x = -0.3;
        g.add(hud);
        // Ejection seat (visible through canopy)
        const seat = mesh(new THREE.BoxGeometry(0.1, 0.15, 0.08), 0x333333, 'carbon');
        seat.position.set(0, -0.02, 0);
        g.add(seat);
        // Headrest
        const headrest = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), 0x222222, 'carbon');
        headrest.position.set(0, 0.08, -0.02);
        g.add(headrest);
        return mergeGroup(g);
    };

    // ═══════════════════════════════════════════════════════════
    // BUILDERS
    // ═══════════════════════════════════════════════════════════

    function buildProjectModel(projectId) {
        const group = new THREE.Group();
        const proj = (window.getDemoProjects || (() => []))().find(p => p.id === projectId);
        if (!proj) return group;

        let yOffset = 0;
        const spacing = 0.4;

        proj.parts.forEach((part) => {
            const geoBuilder = Geometries[part.id];
            if (!geoBuilder) return;
            const geo = geoBuilder();
            const mat = MAT.metal(part.color);
            const meshObj = new THREE.Mesh(geo, mat);
            meshObj.userData = { partId: part.id, partName: part.name };
            meshObj.position.y = yOffset;
            yOffset -= spacing;
            group.add(meshObj);
        });

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.children.forEach(c => c.position.sub(center));
        return group;
    }

    function buildPartMesh(partId, color) {
        const geoBuilder = Geometries[partId];
        if (!geoBuilder) {
            return new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.5, 2),
                MAT.metal(color)
            );
        }
        const geo = geoBuilder();
        return new THREE.Mesh(geo, MAT.metal(color));
    }

    function buildCardModel(projectId) {
        const group = new THREE.Group();
        const proj = (window.getDemoProjects || (() => []))().find(p => p.id === projectId);
        if (!proj) return group;

        const count = proj.parts.length;
        const rows = Math.ceil(Math.sqrt(count));

        proj.parts.forEach((part, i) => {
            const geoBuilder = Geometries[part.id];
            if (!geoBuilder) return;

            const geo = geoBuilder();
            const mat = MAT.metal(part.color);
            mat.transparent = true;
            mat.opacity = 0.85;
            const meshObj = new THREE.Mesh(geo, mat);

            const row = Math.floor(i / rows);
            const col = i % rows;
            meshObj.position.set(
                (col - rows / 2) * 0.5,
                (row - rows / 2) * 0.5,
                0
            );
            meshObj.scale.setScalar(0.3);
            group.add(meshObj);
        });

        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) group.scale.setScalar(2.5 / maxDim);

        return group;
    }

    // Export
    window.JarvisGeometries = {
        builders: Geometries,
        buildPartMesh,
        buildProjectModel,
        buildCardModel,
    };
})();

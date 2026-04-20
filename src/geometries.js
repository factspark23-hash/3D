// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Real 3D Geometry Builder
// Generates actual Three.js geometry for every built-in project part
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const Geometries = {
        // ─── FALCON ROCKET ───
        'nose': () => {
            const g = new THREE.ConeGeometry(0.3, 1.2, 16);
            g.translate(0, 0.6, 0);
            return g;
        },
        'payload': () => {
            return new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
        },
        'second-stage': () => {
            return new THREE.CylinderGeometry(0.35, 0.38, 1.2, 16);
        },
        'interstage': () => {
            const g = new THREE.CylinderGeometry(0.38, 0.4, 0.3, 16);
            return g;
        },
        'first-stage': () => {
            return new THREE.CylinderGeometry(0.4, 0.45, 2.0, 16);
        },
        'legs': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 1.2, 8));
                leg.position.set(Math.cos(angle) * 0.4, -0.6, Math.sin(angle) * 0.4);
                leg.rotation.z = Math.cos(angle) * 0.4;
                leg.rotation.x = Math.sin(angle) * 0.4;
                group.add(leg);
            }
            // Merge into single geometry
            return mergeGroup(group);
        },
        'grid-fins': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.02));
                fin.position.set(Math.cos(angle) * 0.5, 0.5, Math.sin(angle) * 0.5);
                fin.rotation.y = angle;
                group.add(fin);
            }
            return mergeGroup(group);
        },
        'engine-bell': () => {
            const g = new THREE.CylinderGeometry(0.15, 0.08, 0.4, 12);
            const group = new THREE.Group();
            // 9 engines in a circle + center
            for (let i = 0; i < 9; i++) {
                const angle = (i / 9) * Math.PI * 2;
                const r = i === 0 ? 0 : 0.25;
                const m = new THREE.Mesh(g);
                m.position.set(Math.cos(angle) * r, -1.2, Math.sin(angle) * r);
                group.add(m);
            }
            const center = new THREE.Mesh(g);
            center.position.set(0, -1.2, 0);
            group.add(center);
            return mergeGroup(group);
        },
        'fuel-tanks': () => {
            return new THREE.CylinderGeometry(0.38, 0.42, 1.8, 16);
        },

        // ─── QUAD DRONE ───
        'frame': () => {
            return new THREE.BoxGeometry(1.2, 0.06, 1.2);
        },
        'top-plate': () => {
            return new THREE.BoxGeometry(0.4, 0.04, 0.4);
        },
        'arm-fl': () => buildDroneArm(-0.5, -0.5),
        'arm-fr': () => buildDroneArm(0.5, -0.5),
        'arm-bl': () => buildDroneArm(-0.5, 0.5),
        'arm-br': () => buildDroneArm(0.5, 0.5),
        'motor': () => {
            const g = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
            return g;
        },
        'prop': () => {
            const g = new THREE.BoxGeometry(0.5, 0.01, 0.06);
            const group = new THREE.Group();
            const p1 = new THREE.Mesh(g);
            const p2 = new THREE.Mesh(g);
            p2.rotation.y = Math.PI / 2;
            group.add(p1, p2);
            return mergeGroup(group);
        },
        'battery': () => {
            return new THREE.BoxGeometry(0.3, 0.1, 0.15);
        },
        'fc': () => {
            return new THREE.BoxGeometry(0.12, 0.03, 0.12);
        },
        'gps': () => {
            return new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8);
        },
        'camera': () => {
            const g = new THREE.SphereGeometry(0.04, 8, 8);
            return g;
        },

        // ─── MECH SUIT ───
        'helmet': () => {
            const g = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7);
            return g;
        },
        'torso': () => {
            return new THREE.BoxGeometry(0.8, 1.0, 0.5);
        },
        'reactor': () => {
            const g = new THREE.TorusGeometry(0.15, 0.05, 8, 16);
            return g;
        },
        'l-arm': () => buildArm(-1),
        'r-arm': () => buildArm(1),
        'l-hand': () => buildHand(-1),
        'r-hand': () => buildHand(1),
        'l-leg': () => buildLeg(-1),
        'r-leg': () => buildLeg(1),
        'thruster-l': () => {
            const g = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8);
            return g;
        },
        'thruster-r': () => {
            const g = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8);
            return g;
        },
        'boot-jet': () => {
            const g = new THREE.ConeGeometry(0.1, 0.2, 8);
            return g;
        },

        // ─── SATELLITE ───
        'bus': () => new THREE.BoxGeometry(0.8, 0.6, 0.8),
        'antenna-dish': () => {
            const g = new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.3);
            g.rotateX(Math.PI);
            return g;
        },
        'antenna-horn': () => new THREE.ConeGeometry(0.08, 0.3, 8),
        'solar-l': () => new THREE.BoxGeometry(1.5, 0.02, 0.6),
        'solar-r': () => new THREE.BoxGeometry(1.5, 0.02, 0.6),
        'battery-pak': () => new THREE.BoxGeometry(0.3, 0.2, 0.3),
        'radiator': () => new THREE.BoxGeometry(0.5, 0.02, 0.4),
        'thruster-cluster': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 4; i++) {
                const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6));
                t.position.set((i % 2) * 0.12 - 0.06, 0, Math.floor(i / 2) * 0.12 - 0.06);
                group.add(t);
            }
            return mergeGroup(group);
        },
        'fuel-tank-sat': () => new THREE.CylinderGeometry(0.15, 0.15, 0.5, 12),

        // ─── SPORTS CAR ───
        'body': () => {
            // Car body shape using extrude
            const shape = new THREE.Shape();
            shape.moveTo(-1, 0);
            shape.lineTo(-0.8, 0.15);
            shape.lineTo(-0.3, 0.35);
            shape.lineTo(0.3, 0.35);
            shape.lineTo(0.8, 0.2);
            shape.lineTo(1, 0.1);
            shape.lineTo(1, 0);
            shape.lineTo(-1, 0);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 });
            geo.center();
            return geo;
        },
        'hood': () => new THREE.BoxGeometry(0.6, 0.05, 0.5),
        'spoiler': () => {
            const group = new THREE.Group();
            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.15));
            wing.position.y = 0.05;
            const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6));
            pillar1.position.set(-0.25, -0.02, 0);
            const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6));
            pillar2.position.set(0.25, -0.02, 0);
            group.add(wing, pillar1, pillar2);
            return mergeGroup(group);
        },
        'diffuser': () => {
            const g = new THREE.BoxGeometry(0.6, 0.1, 0.3);
            return g;
        },
        'wheel-fl': () => buildWheel(),
        'wheel-fr': () => buildWheel(),
        'wheel-rl': () => buildWheel(),
        'wheel-rr': () => buildWheel(),
        'motor-f': () => new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12),
        'motor-r': () => {
            const group = new THREE.Group();
            const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12));
            m1.position.z = -0.1;
            const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12));
            m2.position.z = 0.1;
            group.add(m1, m2);
            return mergeGroup(group);
        },
        'battery-car': () => new THREE.BoxGeometry(1.0, 0.12, 0.5),

        // ─── SUBMARINE ───
        'hull': () => {
            const g = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
            g.rotateZ(Math.PI / 2);
            return g;
        },
        'tower': () => {
            const g = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8);
            return g;
        },
        'ballast-f': () => new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12),
        'ballast-a': () => new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12),
        'prop-sub': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 5; i++) {
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.1));
                blade.rotation.z = (i / 5) * Math.PI * 2;
                group.add(blade);
            }
            const hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8));
            group.add(hub);
            group.position.x = -1.6;
            return mergeGroup(group);
        },
        'thruster-sub': () => {
            const g = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8);
            g.rotateZ(Math.PI / 2);
            return g;
        },
        'sonar': () => new THREE.SphereGeometry(0.2, 12, 12),
        'camera-sub': () => new THREE.SphereGeometry(0.06, 8, 8),

        // ─── SPACE STATION ───
        'core': () => new THREE.CylinderGeometry(0.4, 0.4, 1.5, 12),
        'lab': () => new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8),
        'node': () => {
            const g = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 6);
            return g;
        },
        'arm': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6));
                seg.position.x = i * 0.35;
                seg.rotation.z = Math.PI / 2;
                group.add(seg);
            }
            return mergeGroup(group);
        },
        'solar-station': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.5));
                panel.position.z = i * 0.55 - 0.55;
                group.add(panel);
            }
            return mergeGroup(group);
        },
        'radiator-station': () => new THREE.BoxGeometry(0.8, 0.02, 0.5),

        // ─── BATTLE TANK ───
        'turret': () => {
            const g = new THREE.CylinderGeometry(0.4, 0.45, 0.35, 8);
            return g;
        },
        'barrel': () => {
            const g = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
            g.rotateZ(-Math.PI / 2);
            return g;
        },
        'hull-tank': () => new THREE.BoxGeometry(1.5, 0.4, 0.9),
        'reactive': () => {
            const group = new THREE.Group();
            for (let i = 0; i < 6; i++) {
                const tile = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04));
                tile.position.set(-0.5 + i * 0.2, 0.22, 0);
                group.add(tile);
            }
            return mergeGroup(group);
        },
        'track-l': () => {
            const g = new THREE.TorusGeometry(0.3, 0.08, 8, 16);
            return g;
        },
        'track-r': () => {
            const g = new THREE.TorusGeometry(0.3, 0.08, 8, 16);
            return g;
        },
        'engine-tank': () => new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12),

        // ─── STEALTH JET ───
        'fuselage': () => {
            const g = new THREE.ConeGeometry(0.3, 3, 6);
            g.rotateZ(-Math.PI / 2);
            return g;
        },
        'wing-l': () => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(-1.5, -0.5);
            shape.lineTo(-1.3, -0.1);
            shape.lineTo(0, 0.1);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
            geo.center();
            return geo;
        },
        'wing-r': () => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(1.5, -0.5);
            shape.lineTo(1.3, -0.1);
            shape.lineTo(0, 0.1);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
            geo.center();
            return geo;
        },
        'tail-v': () => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(-0.3, 0.6);
            shape.lineTo(0, 0.1);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
            geo.center();
            return geo;
        },
        'intake': () => {
            const g = new THREE.CylinderGeometry(0.15, 0.1, 0.6, 8);
            g.rotateZ(Math.PI / 2);
            return g;
        },
        'engine-jet': () => new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12),
        'nozzle': () => {
            const g = new THREE.CylinderGeometry(0.12, 0.06, 0.3, 12);
            return g;
        },
        'radar': () => {
            const g = new THREE.BoxGeometry(0.3, 0.02, 0.25);
            return g;
        },
        'cockpit': () => {
            const g = new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
            return g;
        },
    };

    // ─── Helper builders ───
    function buildDroneArm(x, z) {
        const group = new THREE.Group();
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04));
        const angle = Math.atan2(z, x);
        arm.position.set(x * 0.25, 0, z * 0.25);
        arm.rotation.y = -angle;
        group.add(arm);
        return mergeGroup(group);
    }

    function buildArm(side) {
        const group = new THREE.Group();
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12));
        upper.position.y = -0.3;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1));
        lower.position.y = -0.75;
        group.add(upper, lower);
        group.position.x = side * 0.5;
        return mergeGroup(group);
    }

    function buildHand(side) {
        const group = new THREE.Group();
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.06));
        for (let i = 0; i < 4; i++) {
            const finger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02));
            finger.position.set(-0.04 + i * 0.028, -0.13, 0);
            group.add(finger);
        }
        const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02));
        thumb.position.set(-0.07, -0.05, 0);
        thumb.rotation.z = 0.5;
        group.add(palm, thumb);
        group.position.set(side * 0.5, -1.05, 0);
        return mergeGroup(group);
    }

    function buildLeg(side) {
        const group = new THREE.Group();
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15));
        upper.position.y = -0.3;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12));
        lower.position.y = -0.8;
        group.add(upper, lower);
        group.position.x = side * 0.2;
        return mergeGroup(group);
    }

    function buildWheel() {
        const group = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16));
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8));
        rim.rotation.x = Math.PI / 2;
        group.add(tire, rim);
        return mergeGroup(group);
    }

    function mergeGroup(group) {
        // Return the first child's geometry or a combined buffer
        // For simplicity, merge all children into one geometry
        const geometries = [];
        group.updateMatrixWorld(true);
        group.traverse(child => {
            if (child.isMesh && child.geometry) {
                const geo = child.geometry.clone();
                geo.applyMatrix4(child.matrixWorld);
                geometries.push(geo);
            }
        });

        if (geometries.length === 0) return new THREE.BoxGeometry(0.1, 0.1, 0.1);
        if (geometries.length === 1) return geometries[0];

        // Simple merge using BufferGeometryUtils if available, otherwise return first
        try {
            return THREE.BufferGeometryUtils
                ? THREE.BufferGeometryUtils.mergeBufferGeometries(geometries)
                : geometries[0];
        } catch (e) {
            return geometries[0];
        }
    }

    // ─── Build full project 3D model ───
    function buildProjectModel(projectId) {
        const group = new THREE.Group();
        const proj = getDemoProjects().find(p => p.id === projectId);
        if (!proj) return group;

        let yOffset = 0;
        const spacing = 0.4;

        proj.parts.forEach((part, i) => {
            const geoBuilder = Geometries[part.id];
            if (!geoBuilder) return;

            const geo = geoBuilder();
            const mat = new THREE.MeshPhongMaterial({
                color: part.color,
                transparent: true,
                opacity: 0.85,
                emissive: part.color,
                emissiveIntensity: 0.1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { partId: part.id, partName: part.name };

            // Position parts vertically stacked
            mesh.position.y = yOffset;
            yOffset -= spacing;

            group.add(mesh);
        });

        // Center the group
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.children.forEach(c => c.position.sub(center));

        return group;
    }

    // ─── Build single part mesh ───
    function buildPartMesh(partId, color) {
        const geoBuilder = Geometries[partId];
        if (!geoBuilder) {
            return new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.5, 1),
                new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.2 })
            );
        }

        const geo = geoBuilder();
        const mat = new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.9,
            shininess: 80,
        });
        return new THREE.Mesh(geo, mat);
    }

    // ─── Card preview model (compact arrangement) ───
    function buildCardModel(projectId) {
        const group = new THREE.Group();
        const proj = getDemoProjects().find(p => p.id === projectId);
        if (!proj) return group;

        const count = proj.parts.length;
        const rows = Math.ceil(Math.sqrt(count));

        proj.parts.forEach((part, i) => {
            const geoBuilder = Geometries[part.id];
            if (!geoBuilder) return;

            const geo = geoBuilder();
            const mat = new THREE.MeshPhongMaterial({
                color: part.color,
                transparent: true,
                opacity: 0.8,
            });
            const mesh = new THREE.Mesh(geo, mat);

            // Arrange in a compact stack
            const row = Math.floor(i / rows);
            const col = i % rows;
            mesh.position.set(
                (col - rows / 2) * 0.5,
                (row - rows / 2) * 0.5,
                0
            );
            mesh.scale.setScalar(0.3);

            group.add(mesh);
        });

        // Auto-fit
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

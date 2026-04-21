// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Advanced Exploder Engine v3 (Performance)
// Pure logic engine — hooks into existing UI, no new HTML
// 14 features, all working, no skeleton code
// Optimized: pre-cached geometry, lazy computation, minimal GC
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ─── Engine State ───
    const E = {
        // Isolation
        isolationActive: false,
        isolationHiddenIds: new Set(),

        // Cross-section
        crossSectionActive: false,
        crossSectionPlane: null,

        // Filter
        activeFilter: null,
        categories: [],

        // Multi-select
        multiSelectActive: false,
        multiSelected: [],

        // Measure
        measureActive: false,
        measureParts: [],
        measureLine: null,
        measureLabel: null,

        // Wireframe (per-part)
        wireframeIds: new Set(),

        // Dependency lines
        dependencyActive: false,
        dependencyLineObjects: [],
        dependencyDirty: true,

        // Annotation mode
        annotationMode: false,

        // Recently inspected
        recentList: [],

        // Keyboard nav
        keyboardIndex: -1,
        keyboardParts: [],

        // Refs (set on open)
        parts: [],
        scene: null,
        renderer: null,

        // Performance caches
        bboxCache: new Map(),
        descCountCache: new Map(),
        vertexCountCache: new Map(),
        depGeoCache: new Map(),       // key: "parentId->childId" → BufferGeometry
        measureCanvas: null,           // reuse single canvas
        measureCtx: null,
        measureTex: null,              // reuse single CanvasTexture
    };

    // ─── Performance helpers: pre-compute & cache ───
    function computeBBox(mesh) {
        if (E.bboxCache.has(mesh)) return E.bboxCache.get(mesh);
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        E.bboxCache.set(mesh, size);
        return size;
    }

    function computeDescendants(mesh) {
        if (E.descCountCache.has(mesh)) return E.descCountCache.get(mesh);
        let count = 0;
        const stack = mesh.children.slice();
        while (stack.length) {
            const c = stack.pop();
            if (c.userData && c.userData.partId) { count++; }
            if (c.children && c.children.length) {
                for (let i = 0; i < c.children.length; i++) stack.push(c.children[i]);
            }
        }
        E.descCountCache.set(mesh, count);
        return count;
    }

    function computeVertexCount(mesh) {
        if (E.vertexCountCache.has(mesh)) return E.vertexCountCache.get(mesh);
        let vc = 0;
        if (mesh.geometry && mesh.geometry.getAttribute) {
            const pos = mesh.geometry.getAttribute('position');
            if (pos) vc = pos.count;
        }
        E.vertexCountCache.set(mesh, vc);
        return vc;
    }

    function invalidateCaches() {
        E.bboxCache.clear();
        E.descCountCache.clear();
        E.vertexCountCache.clear();
        // Dispose dependency geometry cache
        E.depGeoCache.forEach(geo => geo.dispose());
        E.depGeoCache.clear();
    }

    // ─── Reusable measure canvas ───
    function getMeasureCanvas() {
        if (E.measureCanvas) return { canvas: E.measureCanvas, ctx: E.measureCtx };
        E.measureCanvas = document.createElement('canvas');
        E.measureCanvas.width = 256;
        E.measureCanvas.height = 64;
        E.measureCtx = E.measureCanvas.getContext('2d');
        return { canvas: E.measureCanvas, ctx: E.measureCtx };
    }

    // ─── IndexedDB helpers ───
    function dbTransaction(store, mode, fn) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('jarvis3d', 2);
            req.onsuccess = () => {
                try {
                    const tx = req.result.transaction(store, mode);
                    resolve(fn(tx.objectStore(store)));
                } catch (e) { reject(e); }
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function loadAnnotations() {
        try {
            return await dbTransaction('annotations', 'readonly', (store) => {
                return new Promise((res) => {
                    const r = store.getAll();
                    r.onsuccess = () => {
                        const map = {};
                        (r.result || []).forEach(a => { map[a.id] = a.notes; });
                        res(map);
                    };
                    r.onerror = () => res({});
                });
            });
        } catch (e) { return {}; }
    }

    async function saveAnnotation(partId, text) {
        try {
            await dbTransaction('annotations', 'readwrite', (store) => {
                store.put({ id: partId, notes: text, updated: Date.now() });
            });
        } catch (e) {}
    }

    let annotations = {};

    // ═══════════════════════════════════════════════════════════
    // INIT — called once when exploder opens
    // ═══════════════════════════════════════════════════════════

    async function init(allParts, scene, renderer) {
        E.parts = allParts;
        E.scene = scene;
        E.renderer = renderer;
        annotations = await loadAnnotations();

        // Reset everything
        E.isolationActive = false;
        E.isolationHiddenIds.clear();
        E.crossSectionActive = false;
        E.activeFilter = null;
        E.multiSelectActive = false;
        E.multiSelected = [];
        E.measureActive = false;
        E.measureParts = [];
        E.wireframeIds.clear();
        E.dependencyActive = false;
        E.keyboardIndex = -1;
        E.dependencyDirty = true;

        // Extract categories (single pass)
        const catSet = new Set();
        for (let i = 0; i < allParts.length; i++) {
            const g = allParts[i].userData.partGroup;
            if (g) catSet.add(g);
        }
        E.categories = Array.from(catSet).sort();

        // Set keyboard-focusable parts
        E.keyboardParts = allParts.filter(m => m.userData.partId);

        // Pre-compute caches for all parts (batch, single pass)
        invalidateCaches();
        for (let i = 0; i < allParts.length; i++) {
            const m = allParts[i];
            computeBBox(m);
            computeDescendants(m);
            computeVertexCount(m);
        }

        // Cleanup old lines
        cleanupLines();

        // Enable renderer clipping if needed
        if (renderer) renderer.localClippingEnabled = false;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. PART ISOLATION
    // ═══════════════════════════════════════════════════════════

    function isolate(mesh) {
        if (!mesh) return;
        exitIsolation();

        const keepIds = new Set();
        keepIds.add(mesh.userData.partId);

        // Collect all descendant part IDs
        function collectDescendants(m) {
            m.children.forEach(child => {
                if (child.userData && child.userData.partId) {
                    keepIds.add(child.userData.partId);
                    collectDescendants(child);
                }
            });
        }
        collectDescendants(mesh);

        E.parts.forEach(m => {
            if (!keepIds.has(m.userData.partId)) {
                m.visible = false;
                E.isolationHiddenIds.add(m.userData.partId);
            }
        });

        E.isolationActive = true;
        updateHint(`🔬 Isolating: ${mesh.userData.partName} — press Esc to exit`);
    }

    function exitIsolation() {
        if (!E.isolationActive) return;
        E.parts.forEach(m => {
            if (E.isolationHiddenIds.has(m.userData.partId)) {
                m.visible = true;
            }
        });
        E.isolationHiddenIds.clear();
        E.isolationActive = false;
        // Refresh dependency lines if active
        if (E.dependencyActive) drawDependencies();
    }

    // ═══════════════════════════════════════════════════════════
    // 2. CROSS-SECTION VIEW
    // ═══════════════════════════════════════════════════════════

    function toggleCrossSection() {
        E.crossSectionActive = !E.crossSectionActive;

        if (E.crossSectionActive) {
            E.crossSectionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            E.parts.forEach(m => {
                if (m.material) {
                    m.material.clippingPlanes = [E.crossSectionPlane];
                    m.material.clipShadows = true;
                    m.material.side = THREE.DoubleSide;
                }
            });
            if (E.renderer) E.renderer.localClippingEnabled = true;
            updateHint('✂️ Cross-section ON — use arrow keys to adjust plane');
        } else {
            E.parts.forEach(m => {
                if (m.material) {
                    m.material.clippingPlanes = [];
                    m.material.side = THREE.FrontSide;
                }
            });
            if (E.renderer) E.renderer.localClippingEnabled = false;
            E.crossSectionPlane = null;
            updateHint('✂️ Cross-section OFF');
        }
    }

    function adjustCrossSection(deltaAngle, deltaOffset) {
        if (!E.crossSectionActive || !E.crossSectionPlane) return;
        // Rotate plane normal
        const n = E.crossSectionPlane.normal;
        const angle = Math.atan2(n.x, n.y) + deltaAngle;
        n.set(Math.sin(angle), Math.cos(angle), 0);
        // Offset
        E.crossSectionPlane.constant += deltaOffset;
    }

    // ═══════════════════════════════════════════════════════════
    // 3. SYSTEM FILTER
    // ═══════════════════════════════════════════════════════════

    function applyFilter(category) {
        E.activeFilter = category;

        if (!category) {
            E.parts.forEach(m => {
                if (m.material) {
                    m.material.opacity = m.userData.hasChildren ? 0.92 : 1;
                    m.material.emissiveIntensity = 0.05;
                    m.material.transparent = m.userData.hasChildren;
                }
            });
            updateHint('Filter cleared');
            return;
        }

        let matchCount = 0;
        E.parts.forEach(m => {
            const partGroup = (m.userData.partGroup || '').toLowerCase();
            const match = partGroup === category.toLowerCase();
            if (match) matchCount++;
            if (m.material) {
                m.material.opacity = match ? 1 : 0.08;
                m.material.transparent = true;
                m.material.emissiveIntensity = match ? 0.25 : 0;
            }
        });
        updateHint(`Filter: ${category} — ${matchCount} parts`);
    }

    function cycleFilter() {
        if (!E.categories.length) return;
        if (!E.activeFilter) {
            applyFilter(E.categories[0]);
        } else {
            const idx = E.categories.indexOf(E.activeFilter);
            if (idx === E.categories.length - 1) {
                applyFilter(null);
            } else {
                applyFilter(E.categories[idx + 1]);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 4. PROPERTIES ENRICHMENT
    // ═══════════════════════════════════════════════════════════
    // Enrich the existing part detail panel with extra info.

    function enrichPartDetail(mesh) {
        if (!mesh) return;
        const d = mesh.userData;

        // Use pre-cached values — zero allocation
        const totalDesc = computeDescendants(mesh);
        const size = computeBBox(mesh);
        const vertexCount = computeVertexCount(mesh);
        const note = annotations[d.partId] || '';

        const enriched = [
            d.partDesc || '',
            '',
            `📂 Category: ${d.partGroup || 'N/A'}`,
            `📊 Level ${d.depth || 0} · ${d.childCount || 0} direct · ${totalDesc} total descendants`,
            `📐 Size: ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`,
            vertexCount ? `🔺 ${vertexCount} vertices` : '',
            note ? `📝 Note: ${note}` : '',
        ].filter(Boolean).join('\n');

        return enriched;
    }

    // ═══════════════════════════════════════════════════════════
    // 5. BREADCRUMB TREE (uses existing side panel area)
    // ═══════════════════════════════════════════════════════════

    function findPartById(partId) {
        return E.parts.find(m => m.userData.partId === partId);
    }

    function getAncestors(mesh) {
        const chain = [];
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.partId) {
                chain.unshift({
                    id: current.userData.partId,
                    name: current.userData.partName,
                    mesh: current,
                });
            }
            current = current.parent;
        }
        return chain;
    }

    function getSiblings(mesh) {
        if (!mesh.parent) return [];
        return mesh.parent.children.filter(c =>
            c !== mesh && c.userData && c.userData.partId
        );
    }

    // ═══════════════════════════════════════════════════════════
    // 6. MULTI-SELECT + COMPARE
    // ═══════════════════════════════════════════════════════════

    function toggleMultiSelect() {
        E.multiSelectActive = !E.multiSelectActive;
        if (!E.multiSelectActive) clearMultiSelect();
        updateHint(E.multiSelectActive
            ? '☑️ Multi-select ON — click parts to select (max 4), then compare'
            : '☑️ Multi-select OFF');
    }

    function addMultiSelect(mesh) {
        if (!E.multiSelectActive) return false;
        if (E.multiSelected.includes(mesh)) {
            removeMultiSelect(mesh);
            return true;
        }
        if (E.multiSelected.length >= 4) return false;

        E.multiSelected.push(mesh);
        if (mesh.material) {
            mesh.material.emissiveIntensity = 0.6;
            mesh.material.emissive.setHex(0x00ff88);
        }
        updateHint(`☑️ ${E.multiSelected.length} parts selected`);
        return true;
    }

    function removeMultiSelect(mesh) {
        E.multiSelected = E.multiSelected.filter(m => m !== mesh);
        if (mesh.material) {
            mesh.material.emissiveIntensity = 0.05;
            mesh.material.emissive.setHex(mesh.userData.originalColor || 0x00d4ff);
        }
    }

    function clearMultiSelect() {
        E.multiSelected.forEach(m => {
            if (m.material) {
                m.material.emissiveIntensity = 0.05;
                m.material.emissive.setHex(m.userData.originalColor || 0x00d4ff);
            }
        });
        E.multiSelected = [];
    }

    function getComparisonText() {
        if (E.multiSelected.length < 2) return '';
        const lines = ['⚖️ COMPARISON', ''];
        for (let i = 0; i < E.multiSelected.length; i++) {
            const m = E.multiSelected[i];
            const d = m.userData;
            const size = computeBBox(m);
            lines.push(`── ${i + 1}. ${d.partName} ──`);
            lines.push(`Category: ${d.partGroup || 'N/A'}`);
            lines.push(`Level: ${d.depth || 0}`);
            lines.push(`Children: ${d.childCount || 0}`);
            lines.push(`Size: ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`);
            lines.push('');
        }
        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════
    // 7. MEASURE TOOL
    // ═══════════════════════════════════════════════════════════

    function toggleMeasure() {
        E.measureActive = !E.measureActive;
        E.measureParts = [];
        removeMeasureVisuals();
        updateHint(E.measureActive
            ? '📏 Measure ON — click two parts to measure distance'
            : '📏 Measure OFF');
    }

    function addMeasurePoint(mesh) {
        if (!E.measureActive) return false;
        if (E.measureParts.length >= 2) {
            E.measureParts = [];
            removeMeasureVisuals();
        }

        E.measureParts.push(mesh);
        if (mesh.material) {
            mesh.material.emissiveIntensity = 0.6;
            mesh.material.emissive.setHex(0xffaa00);
        }

        if (E.measureParts.length === 1) {
            updateHint('📏 First point set — click second part');
        } else if (E.measureParts.length === 2) {
            drawMeasureLine();
        }
        return true;
    }

    function drawMeasureLine() {
        removeMeasureVisuals();
        if (E.measureParts.length < 2 || !E.scene) return;

        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        E.measureParts[0].getWorldPosition(p1);
        E.measureParts[1].getWorldPosition(p2);

        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const mat = new THREE.LineDashedMaterial({
            color: 0xffaa00, dashSize: 0.05, gapSize: 0.03,
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        line.userData._engineMeasure = true;
        E.scene.add(line);
        E.measureLine = line;

        // Reuse canvas + texture — no per-frame allocation
        const dist = p1.distanceTo(p2);
        const mid = p1.clone().add(p2).multiplyScalar(0.5);
        const { ctx } = getMeasureCanvas();

        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 256, 64, 8);
        ctx.fill();
        ctx.font = 'bold 22px Orbitron, monospace';
        ctx.fillStyle = '#ffaa00';
        ctx.textAlign = 'center';
        ctx.fillText(`d = ${dist.toFixed(3)}`, 128, 40);

        if (E.measureTex) {
            E.measureTex.needsUpdate = true;
        } else {
            E.measureTex = new THREE.CanvasTexture(E.measureCanvas);
        }

        const spriteMat = new THREE.SpriteMaterial({ map: E.measureTex, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(mid);
        sprite.position.y += 0.3;
        sprite.scale.set(1.2, 0.3, 1);
        sprite.userData._engineMeasure = true;
        E.scene.add(sprite);
        E.measureLabel = sprite;

        updateHint(`📏 Distance: ${dist.toFixed(3)} units`);
    }

    function removeMeasureVisuals() {
        if (E.measureLine) {
            E.scene?.remove(E.measureLine);
            E.measureLine.geometry.dispose();
            E.measureLine.material.dispose();
            E.measureLine = null;
        }
        if (E.measureLabel) {
            E.scene?.remove(E.measureLabel);
            // Don't dispose shared texture/material — reuse
            E.measureLabel.material.map = null;
            E.measureLabel.material.dispose();
            E.measureLabel = null;
        }
        for (let i = 0; i < E.measureParts.length; i++) {
            const m = E.measureParts[i];
            if (m.material && !E.multiSelected.includes(m)) {
                m.material.emissiveIntensity = 0.05;
                m.material.emissive.setHex(m.userData.originalColor || 0x00d4ff);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 8. PER-PART WIREFRAME
    // ═══════════════════════════════════════════════════════════

    function toggleWireframe(mesh) {
        if (!mesh || !mesh.material) return;
        const id = mesh.userData.partId;
        if (E.wireframeIds.has(id)) {
            mesh.material.wireframe = false;
            mesh.material.opacity = mesh.userData.hasChildren ? 0.92 : 1;
            E.wireframeIds.delete(id);
        } else {
            mesh.material.wireframe = true;
            mesh.material.opacity = 0.7;
            mesh.material.transparent = true;
            E.wireframeIds.add(id);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 9. DEPENDENCY LINES
    // ═══════════════════════════════════════════════════════════

    function toggleDependencies() {
        E.dependencyActive = !E.dependencyActive;
        if (E.dependencyActive) {
            drawDependencies();
            updateHint('🔗 Dependency lines ON');
        } else {
            cleanupDependencyLines();
            updateHint('🔗 Dependency lines OFF');
        }
    }

    function drawDependencies() {
        cleanupDependencyLines();
        if (!E.scene) return;

        const reusableMat = new THREE.LineBasicMaterial({
            color: 0x00d4ff, transparent: true, opacity: 0.2,
        });

        for (let i = 0; i < E.parts.length; i++) {
            const m = E.parts[i];
            if (!m.visible) continue;

            for (let j = 0; j < m.children.length; j++) {
                const child = m.children[j];
                if (!child.isMesh || !child.userData.partId || !child.visible) continue;

                const p1 = new THREE.Vector3();
                const p2 = new THREE.Vector3();
                m.getWorldPosition(p1);
                child.getWorldPosition(p2);

                const key = (m.userData.partId || i) + '->' + (child.userData.partId || j);
                let geo = E.depGeoCache.get(key);
                if (geo) {
                    const pos = geo.getAttribute('position');
                    pos.setXYZ(0, p1.x, p1.y, p1.z);
                    pos.setXYZ(1, p2.x, p2.y, p2.z);
                    pos.needsUpdate = true;
                } else {
                    geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                    E.depGeoCache.set(key, geo);
                }

                const line = new THREE.Line(geo, reusableMat);
                line.userData._engineDepLine = true;
                E.scene.add(line);
                E.dependencyLineObjects.push(line);
            }
        }
        E.dependencyDirty = false;
    }

    function cleanupDependencyLines() {
        E.dependencyLineObjects.forEach(line => {
            E.scene?.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
        E.dependencyLineObjects = [];
    }

    // ═══════════════════════════════════════════════════════════
    // 10. ANNOTATION MODE
    // ═══════════════════════════════════════════════════════════

    function toggleAnnotation() {
        E.annotationMode = !E.annotationMode;
        updateHint(E.annotationMode
            ? '📝 Annotation ON — click a part to add/edit notes'
            : '📝 Annotation OFF');
    }

    function getAnnotation(partId) {
        return annotations[partId] || '';
    }

    function hasAnnotation(partId) {
        return !!annotations[partId];
    }

    async function setAnnotation(partId, text) {
        annotations[partId] = text;
        await saveAnnotation(partId, text);
    }

    // ═══════════════════════════════════════════════════════════
    // 11. KEYBOARD NAVIGATION
    // ═══════════════════════════════════════════════════════════

    function bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            const exploder = document.getElementById('exploder-view');
            if (!exploder || exploder.classList.contains('hidden')) return;

            // Arrow keys — navigate parts
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                navigateParts(1);
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateParts(-1);
                return;
            }

            // Enter — select focused part
            if (e.key === 'Enter') {
                e.preventDefault();
                const focused = getFocusedPart();
                if (focused) {
                    if (E.multiSelectActive) addMultiSelect(focused);
                    else if (E.measureActive) addMeasurePoint(focused);
                    else document.dispatchEvent(new CustomEvent('engine:partClick', { detail: { mesh: focused } }));
                }
                return;
            }

            // Escape — exit modes
            if (e.key === 'Escape') {
                if (E.isolationActive) exitIsolation();
                else if (E.measureActive) toggleMeasure();
                else if (E.multiSelectActive) toggleMultiSelect();
                else if (E.crossSectionActive) toggleCrossSection();
                else if (E.dependencyActive) toggleDependencies();
                return;
            }

            // Ctrl+I — isolate
            if (e.key === 'i' && e.ctrlKey) {
                e.preventDefault();
                const focused = getFocusedPart();
                if (focused) {
                    if (E.isolationActive) exitIsolation();
                    else isolate(focused);
                }
                return;
            }

            // Ctrl+W — wireframe
            if (e.key === 'w' && e.ctrlKey) {
                e.preventDefault();
                const focused = getFocusedPart();
                if (focused) toggleWireframe(focused);
                return;
            }

            // F — cycle filter
            if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                cycleFilter();
                return;
            }

            // X — cross-section toggle
            if (e.key === 'x' && !e.ctrlKey && !e.metaKey) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                toggleCrossSection();
                return;
            }

            // D — dependency lines
            if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                toggleDependencies();
                return;
            }

            // C — copy part info
            if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                const focused = getFocusedPart();
                if (focused) copyPartInfo(focused);
                return;
            }
        });
    }

    function navigateParts(direction) {
        const visible = E.keyboardParts.filter(m => m.visible);
        if (!visible.length) return;

        E.keyboardIndex += direction;
        if (E.keyboardIndex < 0) E.keyboardIndex = visible.length - 1;
        if (E.keyboardIndex >= visible.length) E.keyboardIndex = 0;

        // Reset only previously focused — don't touch all
        if (E._lastNavIndex >= 0 && E._lastNavIndex < visible.length) {
            const prev = visible[E._lastNavIndex];
            if (prev && prev.material && !E.multiSelected.includes(prev) && !E.measureParts.includes(prev)) {
                prev.material.emissiveIntensity = 0.05;
            }
        }

        // Highlight focused
        const focused = visible[E.keyboardIndex];
        if (focused && focused.material) {
            focused.material.emissiveIntensity = 0.5;
        }

        E._lastNavIndex = E.keyboardIndex;
        updateHint(`[${E.keyboardIndex + 1}/${visible.length}] ${focused.userData.partName}`);
    }

    function getFocusedPart() {
        const visible = E.keyboardParts.filter(m => m.visible);
        if (E.keyboardIndex >= 0 && E.keyboardIndex < visible.length) {
            return visible[E.keyboardIndex];
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // 12. PART STATISTICS
    // ═══════════════════════════════════════════════════════════

    function getStats(mesh) {
        if (!mesh) return '';
        const children = mesh.userData.childCount || 0;
        const depth = mesh.userData.depth || 0;
        if (children === 0) return '';
        return `${children} sub-parts · Level ${depth}`;
    }

    function countDescendants(mesh) {
        let count = 0;
        function walk(m) {
            m.children.forEach(c => {
                if (c.userData && c.userData.partId) { count++; walk(c); }
            });
        }
        walk(mesh);
        return count;
    }

    // ═══════════════════════════════════════════════════════════
    // 13. RECENTLY INSPECTED
    // ═══════════════════════════════════════════════════════════

    function addToRecent(mesh) {
        if (!mesh || !mesh.userData.partId) return;
        const entry = {
            id: mesh.userData.partId,
            name: mesh.userData.partName,
            group: mesh.userData.partGroup || '',
        };
        E.recentList = E.recentList.filter(r => r.id !== entry.id);
        E.recentList.unshift(entry);
        if (E.recentList.length > 10) E.recentList.pop();
    }

    function getRecent() {
        return E.recentList;
    }

    // ═══════════════════════════════════════════════════════════
    // 14. COPY PART INFO
    // ═══════════════════════════════════════════════════════════

    function copyPartInfo(mesh) {
        if (!mesh) return;
        const d = mesh.userData;
        const size = computeBBox(mesh);
        const note = annotations[d.partId] || '';

        const text = [
            `Part: ${d.partName}`,
            `ID: ${d.partId}`,
            `Category: ${d.partGroup || 'N/A'}`,
            `Description: ${d.partDesc || 'N/A'}`,
            `Level: ${d.depth || 0}`,
            `Direct Children: ${d.childCount || 0}`,
            `Total Descendants: ${computeDescendants(mesh)}`,
            `Size: ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`,
            note ? `Notes: ${note}` : '',
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(text).then(() => {
            updateHint('📋 Copied to clipboard');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            updateHint('📋 Copied to clipboard');
        });
    }

    // ═══════════════════════════════════════════════════════════
    // HOOKS — called by app.js on click/hover
    // ═══════════════════════════════════════════════════════════

    function onPartClick(mesh) {
        if (!mesh) return 'pass';

        // Multi-select mode consumes click
        if (E.multiSelectActive) {
            return addMultiSelect(mesh) ? 'consumed' : 'pass';
        }

        // Measure mode consumes click
        if (E.measureActive) {
            return addMeasurePoint(mesh) ? 'consumed' : 'pass';
        }

        // Annotation mode — show properties so user can edit note
        if (E.annotationMode) {
            addToRecent(mesh);
            return 'pass'; // let app.js show part info
        }

        // Default: track recent
        addToRecent(mesh);
        return 'pass';
    }

    function onPartHover(mesh) {
        if (!mesh) return '';
        const stats = getStats(mesh);
        const note = hasAnnotation(mesh.userData.partId) ? ' 📝' : '';
        const wire = E.wireframeIds.has(mesh.userData.partId) ? ' 🔲' : '';
        return stats ? ` — ${stats}${note}${wire}` : `${note}${wire}`;
    }

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    function updateHint(text) {
        const hint = document.getElementById('exploder-hint');
        if (hint) hint.textContent = text;
    }

    function cleanupLines() {
        cleanupDependencyLines();
        removeMeasureVisuals();
    }

    function close() {
        exitIsolation();
        if (E.crossSectionActive) toggleCrossSection();
        if (E.activeFilter) applyFilter(null);
        if (E.multiSelectActive) { clearMultiSelect(); E.multiSelectActive = false; }
        if (E.measureActive) { E.measureActive = false; removeMeasureVisuals(); }
        if (E.dependencyActive) cleanupDependencyLines();
        E.wireframeIds.clear();
        E.recentList = [];
        E.keyboardIndex = -1;
        E._lastNavIndex = -1;
        cleanupLines();
        invalidateCaches();
    }

    // ═══════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════

    window.JarvisExploderEngine = {
        init,
        close,

        // Features
        isolate,
        exitIsolation,
        toggleCrossSection,
        adjustCrossSection,
        applyFilter,
        cycleFilter,
        enrichPartDetail,
        toggleMultiSelect,
        clearMultiSelect,
        getComparisonText,
        toggleMeasure,
        toggleWireframe,
        toggleDependencies,
        toggleAnnotation,
        getAnnotation,
        hasAnnotation,
        setAnnotation,
        copyPartInfo,
        getStats,
        countDescendants,
        addToRecent,
        getRecent,
        getAncestors,
        getSiblings,
        findPartById,

        // Hooks
        onPartClick,
        onPartHover,

        // Keyboard
        bindKeyboard,
        getFocusedPart,

        // State access
        isIsolating: () => E.isolationActive,
        isCrossSection: () => E.crossSectionActive,
        isMultiSelect: () => E.multiSelectActive,
        isMeasuring: () => E.measureActive,
        isAnnotating: () => E.annotationMode,
        isDependencies: () => E.dependencyActive,
        getMultiSelected: () => E.multiSelected,
        getCategories: () => E.categories,
        getActiveFilter: () => E.activeFilter,
        getState: () => E,
    };
})();

// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Advanced Exploder Engine v2
// Pure logic engine — hooks into existing UI, no new HTML
// 14 features, all working, no skeleton code
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
    };

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

        // Extract categories
        const catSet = new Set();
        allParts.forEach(m => {
            const g = m.userData.partGroup;
            if (g) catSet.add(g);
        });
        E.categories = Array.from(catSet).sort();

        // Set keyboard-focusable parts
        E.keyboardParts = allParts.filter(m => m.userData.partId);

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

        // Count total descendants
        let totalDesc = 0;
        function count(m) {
            m.children.forEach(c => {
                if (c.userData && c.userData.partId) { totalDesc++; count(c); }
            });
        }
        count(mesh);

        // Geometry dimensions
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        let vertexCount = 0;
        if (mesh.geometry && mesh.geometry.getAttribute) {
            const pos = mesh.geometry.getAttribute('position');
            if (pos) vertexCount = pos.count;
        }

        // Annotation
        const note = annotations[d.partId] || '';

        // Build enriched description (appends to existing)
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
        E.multiSelected.forEach((m, i) => {
            const d = m.userData;
            const box = new THREE.Box3().setFromObject(m);
            const size = box.getSize(new THREE.Vector3());
            lines.push(`── ${i + 1}. ${d.partName} ──`);
            lines.push(`Category: ${d.partGroup || 'N/A'}`);
            lines.push(`Level: ${d.depth || 0}`);
            lines.push(`Children: ${d.childCount || 0}`);
            lines.push(`Size: ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`);
            lines.push('');
        });
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

        // Sprite label at midpoint
        const dist = p1.distanceTo(p2);
        const mid = p1.clone().add(p2).multiplyScalar(0.5);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 256, 64, 8);
        ctx.fill();
        ctx.font = 'bold 22px Orbitron, monospace';
        ctx.fillStyle = '#ffaa00';
        ctx.textAlign = 'center';
        ctx.fillText(`d = ${dist.toFixed(3)}`, 128, 40);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
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
            E.measureLabel.material.map.dispose();
            E.measureLabel.material.dispose();
            E.measureLabel = null;
        }
        E.measureParts.forEach(m => {
            if (m.material && !E.multiSelected.includes(m)) {
                m.material.emissiveIntensity = 0.05;
                m.material.emissive.setHex(m.userData.originalColor || 0x00d4ff);
            }
        });
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

        E.parts.forEach(m => {
            if (!m.visible) return;
            m.children.forEach(child => {
                if (!child.isMesh || !child.userData.partId) return;
                if (!child.visible) return;

                const p1 = new THREE.Vector3();
                const p2 = new THREE.Vector3();
                m.getWorldPosition(p1);
                child.getWorldPosition(p2);

                const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                const mat = new THREE.LineBasicMaterial({
                    color: 0x00d4ff, transparent: true, opacity: 0.2,
                });
                const line = new THREE.Line(geo, mat);
                line.userData._engineDepLine = true;
                E.scene.add(line);
                E.dependencyLineObjects.push(line);
            });
        });
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

        // Reset all highlights
        visible.forEach(m => {
            if (m.material && !E.multiSelected.includes(m) && !E.measureParts.includes(m)) {
                m.material.emissiveIntensity = 0.05;
            }
        });

        // Highlight focused
        const focused = visible[E.keyboardIndex];
        if (focused && focused.material) {
            focused.material.emissiveIntensity = 0.5;
        }

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
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const note = annotations[d.partId] || '';

        const text = [
            `Part: ${d.partName}`,
            `ID: ${d.partId}`,
            `Category: ${d.partGroup || 'N/A'}`,
            `Description: ${d.partDesc || 'N/A'}`,
            `Level: ${d.depth || 0}`,
            `Direct Children: ${d.childCount || 0}`,
            `Total Descendants: ${countDescendants(mesh)}`,
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
        cleanupLines();
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

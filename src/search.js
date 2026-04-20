// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Search Engine + Keyboard Shortcuts + Annotations
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════════════════════════
    let searchOverlay = null;
    let searchInput = null;
    let searchResults = null;
    let onSearchSelect = null;

    function initSearch(onSelect) {
        onSearchSelect = onSelect;

        // Create search overlay
        searchOverlay = document.createElement('div');
        searchOverlay.id = 'search-overlay';
        searchOverlay.className = 'hidden';
        searchOverlay.innerHTML = `
            <div class="search-container">
                <div class="search-header">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="search-field" placeholder="Search projects, parts, actions..." autocomplete="off">
                    <span class="search-hint">ESC to close</span>
                </div>
                <div id="search-results" class="search-results"></div>
            </div>
        `;
        document.body.appendChild(searchOverlay);

        searchInput = document.getElementById('search-field');
        searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', () => performSearch(searchInput.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSearch();
            if (e.key === 'Enter') {
                const first = searchResults.querySelector('.search-result-item');
                if (first) first.click();
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateResults(e.key === 'ArrowDown' ? 1 : -1);
            }
        });

        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearch();
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #search-overlay {
                position: fixed; inset: 0; z-index: 500;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(10px);
                display: flex; align-items: flex-start; justify-content: center;
                padding-top: 15vh;
            }
            #search-overlay.hidden { display: none; }
            .search-container {
                width: 600px; max-width: 90vw;
                background: rgba(0, 10, 20, 0.95);
                border: 1px solid rgba(0, 212, 255, 0.4);
                box-shadow: 0 0 40px rgba(0, 212, 255, 0.2);
            }
            .search-header {
                display: flex; align-items: center; gap: 12px;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 212, 255, 0.2);
            }
            .search-icon { font-size: 20px; }
            #search-field {
                flex: 1; background: none; border: none; outline: none;
                color: #e0e0e0; font-family: 'Rajdhani', sans-serif;
                font-size: 18px; letter-spacing: 1px;
            }
            #search-field::placeholder { color: #666; }
            .search-hint {
                font-family: 'Orbitron', monospace; font-size: 9px;
                letter-spacing: 2px; color: #555;
                border: 1px solid #333; padding: 3px 8px;
            }
            .search-results {
                max-height: 400px; overflow-y: auto;
                padding: 8px 0;
            }
            .search-result-item {
                display: flex; align-items: center; gap: 14px;
                padding: 12px 20px; cursor: pointer;
                transition: background 0.15s;
            }
            .search-result-item:hover, .search-result-item.focused {
                background: rgba(0, 212, 255, 0.1);
            }
            .search-result-icon { font-size: 18px; width: 28px; text-align: center; }
            .search-result-info { flex: 1; }
            .search-result-name {
                font-family: 'Orbitron', monospace; font-size: 12px;
                letter-spacing: 2px; color: #00d4ff;
            }
            .search-result-desc { font-size: 12px; color: #888; margin-top: 2px; }
            .search-result-type {
                font-family: 'Orbitron', monospace; font-size: 9px;
                letter-spacing: 1px; color: #555;
                border: 1px solid #333; padding: 2px 8px;
            }
            .search-category {
                font-family: 'Orbitron', monospace; font-size: 9px;
                letter-spacing: 3px; color: #555;
                padding: 8px 20px 4px;
                border-bottom: 1px solid rgba(0, 212, 255, 0.1);
            }
        `;
        document.head.appendChild(style);
    }

    function openSearch() {
        searchOverlay.classList.remove('hidden');
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchInput.focus();

        // Show all projects by default
        performSearch('');
    }

    function closeSearch() {
        searchOverlay.classList.add('hidden');
    }

    function performSearch(query) {
        const q = query.toLowerCase().trim();
        const results = [];

        // Access state through global if available
        const projects = window._jarvisProjects || [];

        if (!q) {
            // Show all projects
            results.push({ type: 'category', label: 'PROJECTS' });
            projects.forEach(p => {
                results.push({
                    type: 'project',
                    icon: p.icon,
                    name: p.name,
                    desc: `${p.parts.length} parts · ${p.desc}`,
                    badge: p.type === 'user' ? 'UPLOADED' : 'BUILT-IN',
                    action: () => { if (onSearchSelect) onSearchSelect('project', p); },
                });
            });
        } else {
            // Search projects
            const matchedProjects = projects.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.desc.toLowerCase().includes(q)
            );
            if (matchedProjects.length) {
                results.push({ type: 'category', label: 'PROJECTS' });
                matchedProjects.forEach(p => {
                    results.push({
                        type: 'project',
                        icon: p.icon,
                        name: highlight(p.name, q),
                        desc: `${p.parts.length} parts · ${p.desc}`,
                        badge: p.type === 'user' ? 'UPLOADED' : 'BUILT-IN',
                        action: () => { if (onSearchSelect) onSearchSelect('project', p); },
                    });
                });
            }

            // Search parts
            const matchedParts = [];
            projects.forEach(p => {
                p.parts.forEach(part => {
                    if (part.name.toLowerCase().includes(q) ||
                        (part.desc && part.desc.toLowerCase().includes(q)) ||
                        (part.group && part.group.toLowerCase().includes(q))) {
                        matchedParts.push({ project: p, part });
                    }
                });
            });
            if (matchedParts.length) {
                results.push({ type: 'category', label: `PARTS (${matchedParts.length})` });
                matchedParts.slice(0, 20).forEach(({ project, part }) => {
                    results.push({
                        type: 'part',
                        icon: '🔩',
                        name: highlight(part.name, q),
                        desc: `${project.name} → ${part.group || 'Other'}`,
                        badge: project.icon,
                        action: () => { if (onSearchSelect) onSearchSelect('part', { project, part }); },
                    });
                });
            }

            // Search actions
            const actions = [
                { name: 'Open API Settings', desc: 'Configure AI assistant', icon: '🔌', section: 'api' },
                { name: 'Create Room', desc: 'Start P2P collaboration', icon: '🚪', section: 'room' },
                { name: 'Upload Model', desc: 'Import .glb file', icon: '📤', section: 'upload' },
                { name: 'Gesture Settings', desc: 'Configure hand gestures', icon: '🤌', section: 'gesture' },
                { name: 'Go Home', desc: 'Back to project grid', icon: '🏠', section: 'home' },
            ];
            const matchedActions = actions.filter(a =>
                a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
            );
            if (matchedActions.length) {
                results.push({ type: 'category', label: 'ACTIONS' });
                matchedActions.forEach(a => {
                    results.push({
                        type: 'action',
                        icon: a.icon,
                        name: highlight(a.name, q),
                        desc: a.desc,
                        action: () => { if (onSearchSelect) onSearchSelect('section', a.section); },
                    });
                });
            }

            if (!results.length) {
                results.push({ type: 'category', label: 'NO RESULTS' });
            }
        }

        renderResults(results);
    }

    function highlight(text, query) {
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return text.slice(0, idx) + '<mark style="color:#00d4ff;background:none">' + text.slice(idx, idx + query.length) + '</mark>' + text.slice(idx + query.length);
    }

    function renderResults(results) {
        searchResults.innerHTML = '';
        results.forEach(r => {
            if (r.type === 'category') {
                const cat = document.createElement('div');
                cat.className = 'search-category';
                cat.textContent = r.label;
                searchResults.appendChild(cat);
            } else {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <span class="search-result-icon">${r.icon}</span>
                    <div class="search-result-info">
                        <div class="search-result-name">${r.name}</div>
                        <div class="search-result-desc">${r.desc}</div>
                    </div>
                    <span class="search-result-type">${r.badge || ''}</span>
                `;
                item.addEventListener('click', () => {
                    closeSearch();
                    if (r.action) r.action();
                });
                searchResults.appendChild(item);
            }
        });
    }

    function navigateResults(dir) {
        const items = searchResults.querySelectorAll('.search-result-item');
        const focused = searchResults.querySelector('.search-result-item.focused');
        let idx = focused ? Array.from(items).indexOf(focused) : -1;
        if (focused) focused.classList.remove('focused');
        idx = Math.max(0, Math.min(items.length - 1, idx + dir));
        if (items[idx]) {
            items[idx].classList.add('focused');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════════════════════════
    let shortcutHandlers = {};

    function initKeyboard(handlers) {
        shortcutHandlers = handlers;

        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Ctrl/Cmd + K = Search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openSearch();
                return;
            }

            // Number keys for navigation
            if (e.key === '1' && shortcutHandlers.home) { shortcutHandlers.home(); return; }
            if (e.key === '2' && shortcutHandlers.api) { shortcutHandlers.api(); return; }
            if (e.key === '3' && shortcutHandlers.room) { shortcutHandlers.room(); return; }
            if (e.key === '4' && shortcutHandlers.gesture) { shortcutHandlers.gesture(); return; }
            if (e.key === '5' && shortcutHandlers.upload) { shortcutHandlers.upload(); return; }

            // Escape = back/close
            if (e.key === 'Escape') {
                if (!searchOverlay.classList.contains('hidden')) {
                    closeSearch();
                    return;
                }
                if (shortcutHandlers.back) shortcutHandlers.back();
                return;
            }

            // M = toggle sound
            if (e.key === 'm' || e.key === 'M') {
                if (window.JarvisSounds) window.JarvisSounds.toggle();
                return;
            }

            // / = focus search
            if (e.key === '/') {
                e.preventDefault();
                openSearch();
                return;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // ANNOTATIONS
    // ═══════════════════════════════════════════════════════════
    const annotations = {}; // { partId: { text, created } }

    async function loadAnnotations() {
        if (window._jarvisDB) {
            const saved = await window._jarvisDB.getAll('annotations');
            saved.forEach(a => { annotations[a.id] = a; });
        }
    }

    function getAnnotation(partId) {
        return annotations[partId] || null;
    }

    async function setAnnotation(partId, text) {
        const ann = { id: partId, text, created: Date.now() };
        annotations[partId] = ann;
        if (window._jarvisDB) {
            await window._jarvisDB.put('annotations', ann);
        }
        return ann;
    }

    function createAnnotationUI(partId, container) {
        const existing = getAnnotation(partId);
        const wrapper = document.createElement('div');
        wrapper.className = 'annotation-wrapper';
        wrapper.innerHTML = `
            <div class="annotation-toggle">
                <span class="annotation-icon">${existing ? '📝' : '📌'}</span>
                <span class="annotation-label">${existing ? 'View Note' : 'Add Note'}</span>
            </div>
            <div class="annotation-panel hidden">
                <textarea class="annotation-textarea" placeholder="Add notes about this part...">${existing?.text || ''}</textarea>
                <div class="annotation-actions">
                    <button class="annotation-save btn-primary">Save</button>
                    ${existing ? '<button class="annotation-delete btn-danger">Delete</button>' : ''}
                </div>
            </div>
        `;

        const toggle = wrapper.querySelector('.annotation-toggle');
        const panel = wrapper.querySelector('.annotation-panel');
        const textarea = wrapper.querySelector('.annotation-textarea');
        const saveBtn = wrapper.querySelector('.annotation-save');
        const deleteBtn = wrapper.querySelector('.annotation-delete');

        toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
        saveBtn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (text) {
                await setAnnotation(partId, text);
                toggle.querySelector('.annotation-icon').textContent = '📝';
                toggle.querySelector('.annotation-label').textContent = 'View Note';
                if (window.JarvisSounds) window.JarvisSounds.success();
            }
        });
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                delete annotations[partId];
                if (window._jarvisDB) await window._jarvisDB.del('annotations', partId);
                toggle.querySelector('.annotation-icon').textContent = '📌';
                toggle.querySelector('.annotation-label').textContent = 'Add Note';
                textarea.value = '';
                panel.classList.add('hidden');
            });
        }

        container.appendChild(wrapper);
    }

    // Add annotation styles
    const annStyle = document.createElement('style');
    annStyle.textContent = `
        .annotation-wrapper { margin-top: 12px; }
        .annotation-toggle {
            display: flex; align-items: center; gap: 8px;
            cursor: pointer; padding: 6px 10px;
            border: 1px solid rgba(0, 212, 255, 0.2);
            transition: border-color 0.3s;
        }
        .annotation-toggle:hover { border-color: rgba(0, 212, 255, 0.5); }
        .annotation-icon { font-size: 14px; }
        .annotation-label { font-family: 'Orbitron', monospace; font-size: 10px; letter-spacing: 2px; color: #888; }
        .annotation-panel { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
        .annotation-panel.hidden { display: none; }
        .annotation-textarea {
            width: 100%; min-height: 80px; resize: vertical;
            background: rgba(0, 212, 255, 0.05); border: 1px solid rgba(0, 212, 255, 0.2);
            color: #e0e0e0; font-family: 'Rajdhani', sans-serif; font-size: 14px;
            padding: 10px; outline: none;
        }
        .annotation-textarea:focus { border-color: rgba(0, 212, 255, 0.5); }
        .annotation-actions { display: flex; gap: 8px; }
    `;
    document.head.appendChild(annStyle);

    // Export
    window.JarvisSearch = {
        initSearch,
        openSearch,
        closeSearch,
        initKeyboard,
        getAnnotation,
        setAnnotation,
        createAnnotationUI,
        loadAnnotations,
    };
})();

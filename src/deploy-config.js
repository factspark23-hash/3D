// ═══════════════════════════════════════════════════════════════
// Deploy Config — Overrides API calls for Supabase Edge Functions
// Injected AFTER app.js, overrides callAI for Supabase proxy
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // Supabase project URL — set at build time
    const SUPABASE_FN_URL = window.__SUPABASE_FN_URL || '';

    if (!SUPABASE_FN_URL) {
        console.log('[Deploy] No Supabase URL set, using local server.js');
        return;
    }

    console.log('[Deploy] API proxy:', SUPABASE_FN_URL + '/api-proxy');

    // Override the callAI function if it exists on window or inside the app
    // We patch it by intercepting fetch calls to /api/*
    const originalFetch = window.fetch;
    window.fetch = function (url, options) {
        if (typeof url === 'string' && url.startsWith('/api/')) {
            const provider = url.split('/api/')[1]; // 'openai' or 'anthropic'

            try {
                const originalBody = JSON.parse(options.body);
                const { _auth, ...payload } = originalBody;

                // Build Supabase proxy request
                const proxyBody = {
                    provider,
                    apiKey: _auth?.authorization?.replace('Bearer ', '') || _auth?.apiKey || '',
                    payload,
                };

                return originalFetch(SUPABASE_FN_URL + '/api-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(proxyBody),
                });
            } catch (e) {
                console.error('[Deploy] Failed to proxy request:', e);
                return originalFetch(url, options);
            }
        }

        // Non-API requests pass through
        return originalFetch(url, options);
    };
})();

#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Dev Server with API Proxy
// Serves static files + proxies AI API calls (no CORS issues)
// ═══════════════════════════════════════════════════════════════
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

// MIME types
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.bin': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ─── API Proxy ───
    if (req.url === '/api/openai' && req.method === 'POST') {
        return proxyRequest(req, res, 'api.openai.com', 443, '/v1/chat/completions');
    }
    if (req.url === '/api/anthropic' && req.method === 'POST') {
        return proxyRequest(req, res, 'api.anthropic.com', 443, '/v1/messages');
    }

    // ─── Static Files ───
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

function proxyRequest(req, res, hostname, port, path) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        // Parse the request to get auth headers
        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        // Forward auth headers from the client request
        if (parsed._auth) {
            if (parsed._auth.authorization) headers['Authorization'] = parsed._auth.authorization;
            if (parsed._auth.apiKey) headers['x-api-key'] = parsed._auth.apiKey;
            if (parsed._auth.version) headers['anthropic-version'] = parsed._auth.version;
            delete parsed._auth;
        }

        const postData = JSON.stringify(parsed);

        const options = {
            hostname,
            port,
            path,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let responseData = '';
            proxyRes.on('data', chunk => responseData += chunk);
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                });
                res.end(responseData);
            });
        });

        proxyReq.on('error', (err) => {
            res.writeHead(502);
            res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(postData);
        proxyReq.end();
    });
}

server.listen(PORT, () => {
    console.log(`🚀 JARVIS 3D running at http://localhost:${PORT}`);
    console.log(`   API proxy: /api/openai, /api/anthropic`);
});

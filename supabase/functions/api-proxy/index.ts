// ═══════════════════════════════════════════════════════════════
// Supabase Edge Function — AI API Proxy
// Forwards requests to OpenAI / Anthropic / Gemini
// Fixes CORS issues from browser-side API calls
// ═══════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version",
};

const UPSTREAM: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models/",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { provider, apiKey, payload } = body;

    if (!provider || !apiKey || !payload) {
      return new Response(JSON.stringify({ error: "Missing provider, apiKey, or payload" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let upstreamUrl = UPSTREAM[provider];
    if (!upstreamUrl) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Build upstream request
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let fetchBody: string;

    switch (provider) {
      case "openai":
        headers["Authorization"] = `Bearer ${apiKey}`;
        fetchBody = JSON.stringify(payload);
        break;

      case "anthropic":
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        fetchBody = JSON.stringify(payload);
        break;

      case "gemini":
        upstreamUrl += `${payload.model || "gemini-pro"}:generateContent?key=${apiKey}`;
        fetchBody = JSON.stringify(payload.body || payload);
        break;

      default:
        return new Response(JSON.stringify({ error: "Unsupported provider" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: fetchBody,
    });

    const data = await upstreamRes.text();

    return new Response(data, {
      status: upstreamRes.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

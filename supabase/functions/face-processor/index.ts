// ═══════════════════════════════════════════════════════════════
// Supabase Edge Function — Face Processor
// Offloads face embedding comparison to server
// Client just sends landmarks, server does the heavy math
// ═══════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
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
    const { action, embedding, userId } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── STORE FACE EMBEDDING ───
    if (action === "store" && embedding && userId) {
      const { error } = await supabase
        .from("face_embeddings")
        .upsert({ id: userId, embedding, created_at: new Date().toISOString() });

      return new Response(JSON.stringify({ success: !error, error: error?.message }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ─── COMPARE FACE EMBEDDING ───
    if (action === "identify" && embedding) {
      // Fetch all stored embeddings
      const { data: faces, error } = await supabase
        .from("face_embeddings")
        .select("id, embedding");

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!faces || faces.length === 0) {
        // No existing faces — register new
        const newId = crypto.randomUUID();
        await supabase
          .from("face_embeddings")
          .insert({ id: newId, embedding, created_at: new Date().toISOString() });

        return new Response(JSON.stringify({
          match: false,
          userId: newId,
          isNew: true,
        }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Compare against all stored embeddings
      let bestMatch = null;
      let bestScore = 0;

      for (const face of faces) {
        const stored = face.embedding;
        if (!Array.isArray(stored) || stored.length !== embedding.length) continue;

        const score = cosineSimilarity(embedding, stored);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = face.id;
        }
      }

      if (bestScore > 0.85) {
        return new Response(JSON.stringify({
          match: true,
          userId: bestMatch,
          confidence: bestScore,
          isNew: false,
        }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } else {
        // No match — register new
        const newId = crypto.randomUUID();
        await supabase
          .from("face_embeddings")
          .insert({ id: newId, embedding, created_at: new Date().toISOString() });

        return new Response(JSON.stringify({
          match: false,
          userId: newId,
          isNew: true,
        }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

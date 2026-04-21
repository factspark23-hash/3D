// ═══════════════════════════════════════════════════════════════
// Supabase Edge Function — Static File Server
// Serves the JARVIS 3D site from bundled static files
// ═══════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
};

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  let filePath = url.pathname;

  // Default to index.html
  if (filePath === "/" || filePath === "") filePath = "/index.html";

  // Remove leading slash for relative path
  const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

  try {
    // Try to read the file from the public directory
    const content = await Deno.readFile(`./public/${relativePath}`);
    const contentType = getContentType(relativePath);

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    // File not found — serve index.html for SPA routing
    try {
      const indexContent = await Deno.readFile("./public/index.html");
      return new Response(indexContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
});

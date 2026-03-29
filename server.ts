
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[SERVER] ${new Date().toISOString()} ${req.method} ${req.url}`);
      console.log(`[SERVER] Headers: ${JSON.stringify(req.headers)}`);
    }
    next();
  });

  // Debug endpoint
  app.get("/api/debug", (req, res) => {
    res.json({
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HAS_API_KEY: !!process.env.API_KEY,
        HAS_VITE_PROXY_URL: !!process.env.VITE_PROXY_URL,
        VITE_PROXY_URL_VALUE: process.env.VITE_PROXY_URL ? `${process.env.VITE_PROXY_URL.substring(0, 15)}...` : "not set"
      },
      headers: req.headers
    });
  });

  // API Routes
  // Use a more flexible route pattern to handle trailing slashes and subpaths
  app.post(["/api/chat", "/api/chat/", "/api/chat/completions", "/api/chat/completions/"], async (req, res) => {
    const { messages, model, max_tokens, baseURL, apiKey: clientApiKey } = req.body;
    const apiKey = clientApiKey || process.env.API_KEY;
    
    let effectiveBaseURL = (baseURL && baseURL !== "undefined" && baseURL !== "null" && baseURL.startsWith("http")) 
      ? baseURL 
      : process.env.VITE_PROXY_URL || "https://api.groq.com/openai/v1";

    // Strip trailing /chat/completions if present, as the OpenAI SDK appends it
    if (effectiveBaseURL.endsWith("/chat/completions")) {
      effectiveBaseURL = effectiveBaseURL.replace(/\/chat\/completions$/, "");
    }
    // Also strip trailing / if present
    effectiveBaseURL = effectiveBaseURL.replace(/\/$/, "");

    console.log(`[SERVER] Chat request: model=${model}, baseURL=${effectiveBaseURL}`);

    if (!apiKey) {
      console.error("[SERVER] Error: No API key provided");
      return res.status(401).json({ error: "No API key provided" });
    }

    try {
      const client = new OpenAI({ 
        apiKey, 
        baseURL: effectiveBaseURL,
      });

      const stream = await client.chat.completions.create({
        model: model || "llama-3.3-70b-versatile",
        messages: messages,
        stream: true,
        temperature: 0.9,
        max_tokens: max_tokens || 4096,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("[SERVER] Chat error:", error);
      
      // If headers were already sent, we can't send a JSON error response
      if (res.headersSent) {
        console.error("[SERVER] Headers already sent, closing connection");
        res.end();
        return;
      }

      const status = typeof error.status === 'number' ? error.status : 500;
      const message = error.message || "Internal Server Error";
      const type = error.type || "server_error";
      
      res.status(status).json({ 
        error: message,
        type: type,
        details: error.stack ? "Check server logs" : undefined
      });
    }
  });

  // Catch-all for undefined API routes
  app.all("/api/*all", (req, res) => {
    console.log(`[SERVER] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Serve public folder explicitly before Vite middleware to ensure correct MIME types
    app.use(express.static(path.join(process.cwd(), 'public')));
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

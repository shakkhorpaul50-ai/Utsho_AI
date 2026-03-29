
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/chat", async (req, res) => {
    const { messages, model, apiKey, baseURL, max_tokens } = req.body;

    const effectiveBaseURL = (baseURL && baseURL !== "undefined" && baseURL !== "null") 
      ? baseURL 
      : "https://api.groq.com/openai/v1";

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
      
      res.status(status).json({ error: message });
    }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

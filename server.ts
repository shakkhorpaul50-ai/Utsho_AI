import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key" });

  // API Routes
  app.post("/api/gemini/stream", async (req: Request, res: Response) => {
    const { history, profile, systemPrompt } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    try {
      const modelId = profile?.tunedModelId || "gemini-3-flash-preview";
      const googleSearchEnabled = profile?.googleSearchEnabled ?? true;

      const tools: any[] = [];
      if (googleSearchEnabled) {
        tools.push({ googleSearch: {} });
      }

      const responseStream = await genAI.models.generateContentStream({
        model: modelId,
        contents: history,
        config: {
          systemInstruction: systemPrompt,
          tools: tools.length > 0 ? tools : undefined,
          temperature: 0.9,
          maxOutputTokens: 8192,
        }
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of responseStream) {
        const payload = {
          text: chunk.text || "",
          groundingMetadata: chunk.candidates?.[0]?.groundingMetadata || null
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("AI_SERVER_ERROR:", error);
      res.status(500).json({ error: error.message || "An error occurred during generation." });
    }
  });

  // Health check
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", apiKeySet: !!process.env.GEMINI_API_KEY });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);

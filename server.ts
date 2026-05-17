import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// CONFIGURATION: Gemini & GROQ Keys Pool
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEYS = [
  process.env.GROQ_KEY_1,
  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,
  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5
].filter(Boolean) as string[];

let currentKeyIndex = 0;

/**
 * Gemini Stream Handler
 */
async function streamGemini(messages: any[]): Promise<Response> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing");

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'system' ? 'user' : (m.role === 'assistant' ? 'model' : 'user'),
    parts: [{ text: m.content }]
  }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini Error: ${text}`);
  }

  return response;
}

/**
 * Round-Robin Load Balancer with Retry Logic for GROQ
 */
async function fetchGroqWithRetry(body: any): Promise<Response> {
  if (GROQ_KEYS.length === 0) {
    throw new Error("No GROQ API keys configured.");
  }

  let lastError = null;
  const maxRetries = GROQ_KEYS.length;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = GROQ_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...body, stream: true })
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Groq Status ${response.status}`);
        continue;
      }

      return response;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq API keys failed.");
}

// API ROUTE: Proxied Chat with Failover Support
app.post("/api/brain/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { messages } = req.body;
    
    // Try Gemini First (Fastest in this environment)
    if (GEMINI_KEY) {
      try {
        const geminiResponse = await streamGemini(messages);
        res.setHeader("Content-Type", "text/event-stream");
        if (!geminiResponse.body) throw new Error("No Gemini body");
        
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (content) {
                  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
                }
              } catch(e) {}
            }
          }
        }
        res.end();
        return;
      } catch (geminiErr) {
        console.warn("CLOUD_BRAIN: Gemini failed, trying Groq fallback...", geminiErr);
      }
    }

    // Try Groq Second
    const groqResponse = await fetchGroqWithRetry({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    res.setHeader("Content-Type", "text/event-stream");
    if (!groqResponse.body) throw new Error("No Groq body");
    const reader = groqResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (err: any) {
    console.error("SERVER_ERROR:", err.message);
    res.status(500).json({ 
      error: "CLOUD_BRAIN_EXHAUSTED", 
      message: err.message,
      suggestion: "FALLBACK_TO_NATIVE" 
    });
  }
});

app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.json({ 
    status: "ok", 
    poolSize: GROQ_KEYS.length,
    activeKeys: GROQ_KEYS.length > 0
  });
});

// VITE MIDDLEWARE
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Utsho Dual-Layer Brain running on http://localhost:${PORT}`);
    console.log(`GROQ POOL: ${GROQ_KEYS.length} keys loaded.`);
  });
}

setupVite();

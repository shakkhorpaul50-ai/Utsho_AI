import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// CONFIGURATION: GROQ Keys Pool
const GROQ_KEYS = [
  process.env.GROQ_KEY_1,
  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,
  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5
].filter(Boolean) as string[];

let currentKeyIndex = 0;

/**
 * Round-Robin Load Balancer with Retry Logic
 */
async function fetchGroqWithRetry(body: any): Promise<Response> {
  if (GROQ_KEYS.length === 0) {
    throw new Error("No GROQ API keys configured on server.");
  }

  let lastError = null;
  const maxRetries = GROQ_KEYS.length;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = GROQ_KEYS[currentKeyIndex];
    // Rotate index for next request
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          stream: true // Enforce streaming for this architecture
        })
      });

      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text();
        console.warn(`GROQ_POOL: Key ${currentKeyIndex} failed (Status ${response.status}). Retrying...`, errorText);
        lastError = new Error(`Groq Status ${response.status}: ${errorText}`);
        continue; // Try next key
      }

      return response;
    } catch (err: any) {
      console.error(`GROQ_POOL: Network error with key ${currentKeyIndex}. Retrying...`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq API keys in pool exhausted or failed.");
}

// API ROUTE: Proxied Chat with Failover Support
app.post("/api/brain/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { messages, model = "llama-3.3-70b-versatile" } = req.body;
    
    const groqResponse = await fetchGroqWithRetry({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    // Proxy the stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!groqResponse.body) throw new Error("No response body from Groq");
    
    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder();

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
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Utsho Dual-Layer Brain running on http://localhost:${PORT}`);
    console.log(`GROQ POOL: ${GROQ_KEYS.length} keys loaded.`);
  });
}

setupVite();

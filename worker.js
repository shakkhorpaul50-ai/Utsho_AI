/**
 * Utsho AI - Cloudflare Worker Proxy
 * Acts as a secure intermediary between the frontend and Google AI Studio.
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { history, profile, systemPrompt } = await request.json();
      
      const API_KEY = env.GEMINI_API_KEY;
      const TUNED_MODEL_ID = profile?.tunedModelId || "tunedModels/my-utsho-model-id";
      const GOOGLE_SEARCH = profile?.googleSearchEnabled ?? true;

      // Structure for Google AI Studio API (v1beta)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TUNED_MODEL_ID}:streamGenerateContent?alt=sse&key=${API_KEY}`;

      const payload = {
        contents: history,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
        },
        tools: GOOGLE_SEARCH ? [{ googleSearch: {} }] : []
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Proxy the stream back to the client
      const { readable, writable } = new TransformStream();
      response.body.pipeTo(writable);

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};

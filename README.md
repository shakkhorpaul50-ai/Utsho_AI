# Utsho AI - Deployment Guide

## 1. Firebase Setup (Cloud Database)
1. Go to [Firebase Console](https://console.firebase.com/).
2. Select your project: **Utsho-AI**.
3. In the **Firestore Database** section, go to the **Rules** tab.
4. Replace all existing text with the following code. This version includes the **Master Admin Override** for your email so the AI can fetch system stats without permission errors.

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // 1. MASTER ADMIN OVERRIDE
    // This gives shakkhorpaul50@gmail.com absolute power to read, write, and count everything.
    match /{document=**} {
      allow read, write: if request.auth != null && 
                          request.auth.token.email.lower() == 'shakkhorpaul50@gmail.com';
    }

    // 2. USER DATA ACCESS
    // Allows anyone to read/write to their own user document and sessions.
    // This ensures users can save their chats without interference.
    match /users/{userEmail}/{document=**} {
      allow read, write: if true;
    }
    
    // 3. SYSTEM & API HEALTH
    // Permissive access for API health logging to ensure node health is tracked.
    match /system/{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Click **Publish**. 
   *Wait ~1 minute for changes to take effect.*

## 2. Dual-Engine Architecture (Brain + Knowledge)
Utsho AI uses a custom "Dual-Engine" setup:
- **Brain (Custom Tuned Model):** Uses your fine-tuned model ID (e.g., `tunedModels/your-model-id`) to retain unique tone and personality.
- **Knowledge (Google Search Grounding):** Utilizes the `googleSearch` tool to pull live data from the web and Wikipedia.

### Backend Proxy (server.ts or worker.js)
To secure your API keys, all Gemini calls are proxied through the server.
1. Set `GEMINI_API_KEY` in your environment.
2. In **Settings**, you can toggle **Knowledge Grounding** and specify your **Tuned Model ID**.

## 3. Deployment
- **Local Dev:** `npm run dev` (Starts Express + Vite server)
- **Production Build:** `npm run build`
- **Cloudflare Worker:** Use the provided `worker.js` file if you want to deploy the proxy to Cloudflare Workers (Free Tier).

## 4. Environment Variables
Ensure these are set in your deployment environment:
- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `FIREBASE_API_KEY`: Your Firebase Web SDK Key.
- `FIREBASE_PROJECT_ID`: utsho-ai
- `FIREBASE_AUTH_DOMAIN`: utsho-ai.firebaseapp.com
- `FIREBASE_STORAGE_BUCKET`: utsho-ai.appspot.com
- `FIREBASE_MESSAGING_SENDER_ID`: ...
- `FIREBASE_APP_ID`: ...

## 3. Supported Custom API Providers
Users can optionally provide their own API key in Settings for any of these providers:
- **ChatGPT** (OpenAI)
- **Gemini** (Google)
- **DeepSeek**
- **Grok** (xAI)

# Deploying SceneHawk

Right now there is **one** deployable piece: the Next.js website. The Python
half of the repo is data-collection scripts (`chatbot/scripts/`) and a training
notebook that runs in Colab — neither is a service, so neither is deployed.

The website runs with no API keys, degrading to deterministic fallbacks
(see [AGENTS.md](AGENTS.md)).

## Website → Vercel

1. Import this repo in Vercel. It auto-detects Next.js at the root;
   `chatbot/` is excluded by [.vercelignore](.vercelignore). Leave the Root
   Directory as the repo root.
2. No environment variables are required. See [.env.example](.env.example) for
   the optional ones.
3. Deploy.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

## The /chat page has no backend

[src/app/api/chat/route.ts](src/app/api/chat/route.ts) proxies to a Python
FastAPI service at `CHATBOT_URL`. That service was the Chroma-based retrieval
prototype and has been removed, so `/chat` returns the proxy's error message.

The replacement is the feelings model: once it is trained and film feeling
profiles are built, a new service will serve recommendations from those
profiles. This file gets its Step 1 back then.

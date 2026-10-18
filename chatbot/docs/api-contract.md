# Chatbot API contract

What the Next.js frontend already expects. The Week 7 backend must match this, or
the website needs changing too.

The backend lives in `chatbot/src/`. Its retrieval internals are Chroma-based and
will be replaced in Week 7, but the endpoints below must keep working the same way
or the website breaks. This file records the contract so the rewrite stays compatible.

## Endpoints

### `GET /health`
```json
{ "status": "ok", "films": 1259 }
```

### `POST /chat`
Request:
```json
{ "message": "something tense but not violent", "k": 6 }
```

Response:
```json
{
  "reply": "Here are three films that match ...",
  "films": [
    { "title": "The Night Listener", "year": 2006, "rating": 6.4, "similarity": 0.81 }
  ]
}
```

## Who calls it

`src/app/api/chat/route.ts` (the Next.js proxy) posts to `${CHATBOT_URL}/chat` and
passes the JSON straight through to `src/components/ChatPanel.tsx`.

The panel reads `reply` (string) and `films[]`, using each film's `title`, `year`,
`rating`, `similarity` and `summary`. Every field is optional on the frontend, so
extra or missing fields will not crash it - they just render blank.

## Notes for the Week 7 rebuild

- Keep the `{reply, films[]}` shape and the frontend needs no changes.
- `similarity` is a good slot for the combined feeling + description score.
- `summary` is the natural slot for the evidence review snippet.
- Consider adding `feelings` per film (the scores behind the match) and a
  `low_confidence` flag for films with few reviews (Week 8 item).
- The proxy aborts at 55s and Vercel caps the function at 60s, so keep responses
  under ~50s.

## Also to update when the backend is rebuilt

- `chatbot/Dockerfile` - copies `src/`
- `chatbot/start.sh` - runs `uvicorn server:app --app-dir src`, and builds a Chroma
  index that no longer exists
- `render.yaml` - deploys the above

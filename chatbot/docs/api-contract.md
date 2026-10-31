# Chatbot API contract

What the Next.js frontend already expects. The Week 7 backend must match this, or
the website needs changing too.

The old Chroma-based backend was removed, so nothing serves these endpoints right
now. The new service must keep them working the same way or the website breaks.
This file records the contract so the rewrite stays compatible.

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

## Also to create when the backend is rebuilt

The old Chroma service and its deploy scaffolding (`Dockerfile`, `start.sh`,
`render.yaml`) were removed, so the new service starts from nothing. It will
need:

- a container or start command for whatever serves the feeling profiles
- a deploy config for the host, and `CHATBOT_URL` set on the Vercel side
- Step 1 restored in `DEPLOY.md`

# Chatbot API contract

What `/api/chat` on the website accepts and returns. Since 2026-11-06 it is
served by the website itself (`web/src/app/api/chat/route.ts`), which reads the
prompt and calls the Supabase function `match_films()`
(`db/migrations/2026-11-06_search.sql`). There is no separate backend server.

## Endpoints

### `GET /api/chat` (health)
```json
{ "status": "ok", "films": 2871, "films_with_feelings": 2860, "model_version": "distilroberta-20261031-1412" }
```
`not_configured` (503) means `SUPABASE_URL` / `SUPABASE_ANON_KEY` are unset.

### `POST /api/chat`
Request:
```json
{ "message": "something tense but not violent", "k": 6 }
```

Response (every film field is optional on the frontend):
```json
{
  "reply": "Films that feel tense, avoiding disgusted and disturbed: ...",
  "interpreted": {
    "feelings": ["tense"], "avoid": ["disgusted", "disturbed"],
    "genres": [], "notGenres": [], "storyTerms": [], "feelingWeight": 1
  },
  "films": [
    {
      "title": "The Night Listener", "year": 2006, "rating": 5.5,
      "similarity": 0.81,
      "summary": "review snippet, or the description if there is none",
      "genres": ["Crime", "Horror", "Mystery", "Thriller"],
      "feelings": { "tense": 0.42 },
      "evidence": "I was on edge the whole time ...",
      "evidence_feeling": "tense",
      "review_count": 30,
      "low_confidence": false,
      "model_version": "distilroberta-20261031-1412"
    }
  ]
}
```

- `similarity` is the combined feeling + description score (0..1), a
  retrieval score, not a quality rating.
- `feelings` are raw film_feelings scores: the mean probability the model
  gave the film's reviews.
- `low_confidence` is true under 20 reviews.

## How a request is answered

1. `web/src/lib/feelings/promptReader.ts` splits the message into feelings (mapped
   onto the 28, e.g. "creepy" -> unsettled), feelings to avoid ("no gore"),
   genres, genres to drop ("not horror") and story words.
2. `match_films()` drops excluded genres, keeps requested ones (loosening the
   filter if fewer than k films are left), scores feelings from
   `film_feelings` (each divided by the best score any film has, and shrunk
   for films with few reviews), scores the story from `films.search_tsv` and
   `film_keywords`, and blends the two by `feelingWeight`.
3. `web/src/lib/feelings/search.ts` writes the reply from the returned rows only.

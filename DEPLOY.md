# Deploying SceneHawk

There is **one** deployable piece: the Next.js website, on Vercel. The Python
half of the repo is the data pipeline (`chatbot/scripts/`) and the Colab
notebooks that train the model and fill the feelings table. None of it is a
service, so none of it is deployed. There is no separate chat server: `/chat`
reads from Supabase directly (below).

The website runs with no API keys, degrading to deterministic fallbacks
(see [AGENTS.md](AGENTS.md)).

## Website → Vercel

1. Import this repo in Vercel and set **Root Directory** to `web`
   (Project > Settings > Build and Deployment). Vercel then detects Next.js
   there and builds only the website; `chatbot/` is outside it.
2. No environment variables are required to build. `/chat` needs
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` (below). See
   [web/.env.example](web/.env.example) for the optional ones.
3. Deploy.

## Local development

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## The /chat page: feelings search on Supabase

`/chat` answers from two Supabase tables. Nothing else is deployed: the trained
model runs once, offline, and its output is the feelings table.

```
reviews ─▶ feelings model (Colab GPU) ─▶ film_feelings   ─┐
films   ─▶ keywords (laptop)          ─▶ film_keywords   ─┼─▶ match_films() ◀── /api/chat (Vercel)
films   ─▶ full-text index (Postgres)  ─▶ films.search_tsv ─┘
```

The model is ~330 MB plus PyTorch, which doesn't fit in a Vercel function, so
it never runs on Vercel. Rerun step 3 whenever the model is retrained.

### One-time setup

1. **Database.** In the Supabase SQL editor, run
   [chatbot/db/schema.sql](chatbot/db/schema.sql) (if not done already), then
   [chatbot/db/migrations/2026-11-06_search.sql](chatbot/db/migrations/2026-11-06_search.sql).
   The migration is safe to re-run. It also turns on row level security, so
   the public key can't read or change the tables.
2. **Description table.** From `chatbot/`, with `SUPABASE_DB_URL` in
   `chatbot/.env`:
   ```bash
   pip install -r requirements.txt
   python scripts/13_build_descriptions.py
   ```
3. **Feelings table.** Open
   [chatbot/notebooks/fill_feelings_table.ipynb](chatbot/notebooks/fill_feelings_table.ipynb)
   in Colab and Run all (T4 GPU, about 15 minutes). It loads the model saved in
   Google Drive by `train_feelings.ipynb` and runs
   `scripts/12_score_reviews.py`. It looks in `MyDrive/scenehawk/models/`, so
   run it signed in to the Google account that trained the model.
4. **Vercel.** Project > Settings > Environment Variables, add
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Supabase > Project Settings > API),
   then redeploy. Do this only after step 1: until the migration turns on row
   level security, the anon key can read and change the tables.
5. **Check.** `GET /api/chat` on the deployed site should return
   `{"status":"ok","films":…,"films_with_feelings":…,"model_version":"…"}`.

The request and response shapes are in
[chatbot/docs/api-contract.md](chatbot/docs/api-contract.md).

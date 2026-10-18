-- SceneHawk - Supabase (Postgres) schema
-- Paste into the Supabase SQL editor. Run once.

create extension if not exists vector;   -- pgvector, for description embeddings

-- ---------------------------------------------------------------------------
-- 1. feelings - the frozen taxonomy
-- A table rather than free text, so a typo cannot silently invent a 29th
-- feeling. Everything that stores a feeling points here.
-- ---------------------------------------------------------------------------
create table feelings (
    name        text primary key,          -- 'tense', 'grief-stricken', ...
    group_name  text not null,             -- 'Fear and tension', ...
    definition  text not null,
    example     text
);

-- ---------------------------------------------------------------------------
-- 2. films - the starter set (data/films_starter.json)
-- ---------------------------------------------------------------------------
create table films (
    tmdb_id            integer primary key,
    imdb_id            text unique not null,     -- 'tt0448075'
    title              text not null,
    year               integer,
    genres             text[],
    original_language  text,
    overview           text,
    popularity         real,
    vote_average       real,
    vote_count         integer,
    review_count       integer not null default 0,
    overview_embedding vector(384)               -- Week 6; match your model's dims
);

create index films_year_idx   on films (year);
create index films_genres_idx on films using gin (genres);

-- ---------------------------------------------------------------------------
-- 3. reviews - the review corpus (data/reviews.jsonl)
--
-- label_split is the guard rail: the hand-labelled answer key is marked
-- 'answer_key' and must NEVER be used for training. Enforce it in the loader,
-- and the column makes it checkable in SQL.
-- ---------------------------------------------------------------------------
create table reviews (
    review_id    text primary key,                  -- 'train-unsup-25843'
    tmdb_id      integer not null references films (tmdb_id) on delete cascade,
    text         text not null,
    source       text not null default 'aclImdb',
    split        text,                              -- origin split: train | test
    polarity     text,                              -- pos | neg | unsup
    imdb_rating  smallint,
    char_len     integer generated always as (length(text)) stored,
    label_split  text not null default 'unlabeled'
                 check (label_split in ('answer_key','train','val','test','unlabeled'))
);

create index reviews_film_idx  on reviews (tmdb_id);
create index reviews_split_idx on reviews (label_split);

-- ---------------------------------------------------------------------------
-- 4. review_labels - the training data
--
-- One row per (review, feeling, labeler). That shape gives us three things:
--   * multi-label      - a review can have several feelings, or none at all
--   * agreement        - two people can label the same review and be compared
--   * provenance       - human labels and LLM labels stay distinguishable
-- A review with no feelings simply has no rows here. That is a valid label.
-- ---------------------------------------------------------------------------
create table review_labels (
    review_id   text not null references reviews (review_id) on delete cascade,
    feeling     text not null references feelings (name),
    labeler     text not null,                     -- person's name, or a model id
    source      text not null check (source in ('human','llm')),
    created_at  timestamptz not null default now(),
    primary key (review_id, feeling, labeler)
);

create index review_labels_feeling_idx on review_labels (feeling);
create index review_labels_labeler_idx on review_labels (labeler);

-- ---------------------------------------------------------------------------
-- 5. film_feelings - the feelings table (Week 5 output)
--
-- score = mean predicted probability over that film's reviews.
-- review_count drives the "low confidence" badge for thinly reviewed films.
-- evidence_review_id is the review we quote back to the user.
-- ---------------------------------------------------------------------------
create table film_feelings (
    tmdb_id            integer not null references films (tmdb_id) on delete cascade,
    feeling            text not null references feelings (name),
    score              real not null check (score >= 0 and score <= 1),
    review_count       integer not null,
    evidence_review_id text references reviews (review_id),
    model_version      text,                       -- which trained model produced this
    updated_at         timestamptz not null default now(),
    primary key (tmdb_id, feeling)
);

-- the main lookup: "which films score highest on 'tense'?"
create index film_feelings_rank_idx on film_feelings (feeling, score desc);

-- ---------------------------------------------------------------------------
-- 6. film_keywords - the description path (Week 6)
-- ---------------------------------------------------------------------------
create table film_keywords (
    tmdb_id   integer not null references films (tmdb_id) on delete cascade,
    keyword   text not null,
    embedding vector(384),
    primary key (tmdb_id, keyword)
);

-- ---------------------------------------------------------------------------
-- Useful checks
-- ---------------------------------------------------------------------------
-- answer key must never leak into training:
--   select count(*) from review_labels l
--     join reviews r using (review_id)
--    where r.label_split = 'answer_key' and l.source = 'llm';   -- expect 0
--
-- agreement between two labellers on the same reviews:
--   select review_id, feeling, count(distinct labeler) as n
--     from review_labels where source = 'human'
--    group by review_id, feeling having count(distinct labeler) > 1;

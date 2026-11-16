-- 2026-11-15: quote the part of the evidence review that shows the feeling.
--
-- Under each result the website quotes the review the model was surest about
-- for the requested feeling. It used to show the first 280 characters, which in
-- a long review is often background ("I rented the DVD after...") rather than
-- the part that shows the feeling.
--
-- Now the quote starts at the sentence holding the first cue word for that
-- feeling ("suspense" for tense, "laughed" for amused), when one appears past
-- the first 200 characters. Otherwise it is the start of the review, as before.
-- Only the quoted text changes: rankings, scores and which review is quoted are
-- the same as in 2026-11-06_search.sql.
--
-- Run once in the Supabase SQL editor, after 2026-11-06_search.sql. Safe to
-- re-run. To undo, re-run 2026-11-06_search.sql, which restores the old quote.

-- ---------------------------------------------------------------------------
-- 1. Cue words per feeling
--
-- Words a reviewer tends to use when a film gave them that feeling. They only
-- choose WHICH PART of the evidence review to quote; they never change a score
-- or which review is quoted. The review is still the one the model was surest
-- about. \m and \M are word boundaries, so "mov" can't match "movie".
-- ---------------------------------------------------------------------------
create or replace function feeling_cue(f text) returns text
language sql immutable parallel safe
as $$
select '\m(' || case f
    when 'tense'          then 'tense|tension|suspense\w*|nail.?bit\w*|nerve.?wrack\w*|edge of (my|your|the) seat|on edge|gripping|white.?knuckle\w*|claustrophob\w*'
    when 'dread'          then 'dread\w*|forebod\w*|ominous\w*|impending|slow.?burn\w*|creeping|sense of doom'
    when 'scared'         then 'scar(y|ed|ier|iest)|fright\w*|terrif\w*|jump.?scares?|horrif\w*|chills|afraid|screamed|nightmares?|creep(y|ier|iest)'
    when 'unsettled'      then 'unsettl\w*|uneas\w*|unnerv\w*|eerie|creep(y|ier|iest)|disquiet\w*'
    when 'disturbed'      then 'disturb\w*|haunt\w*|harrowing|shaken|stay(s|ed)? with me|sicken\w*'
    when 'sad'            then 'sad|sadness|saddest|saddened|cr(y|ied|ies|ying)|tears|weep\w*|wept|sob\w*|depress\w*|heartbreak\w*|tear.?jerk\w*'
    when 'grief-stricken' then 'grie(f|v\w*)|mourn\w*|devastat\w*|heartbreak\w*|bereave\w*'
    when 'lonely'         then 'lonel\w*|isolat\w*|emptiness|all alone'
    when 'moved'          then 'moved|moving|touch(ed|ing)|emotional\w*|powerful|got to me|choked up|lump in (my|the) throat|tears'
    when 'bittersweet'    then 'bitter.?sweet|poignan\w*|melanchol\w*'
    when 'cozy'           then 'coz(y|iness)|cos(y|iness)|comfort\w*|warm\w*|snug\w*'
    when 'heartwarming'   then 'heart.?warm\w*|feel.?good|warm\w*|sweet|touching|uplifting'
    when 'tender'         then 'tender\w*|gentle|intima\w*|affection\w*|sweet'
    when 'hopeful'        then 'hopeful\w*|hope|optimis\w*|redempt\w*'
    when 'uplifted'       then 'uplift\w*|feel.?good|inspir\w*|left me (feeling )?(happy|better|good)'
    when 'joyful'         then 'joy\w*|happ(y|iness)|delight\w*|smil\w*|grin\w*|fun|cheer\w*'
    when 'thrilled'       then 'thrill\w*|excit\w*|adrenalin\w*|edge of (my|your|the) seat|exhilarat\w*|gripping|action.?packed|pulse.?pounding'
    when 'amused'         then 'funn(y|ier|iest)|hilari\w*|laugh\w*|chuckl\w*|amus\w*|humou?r\w*|giggl\w*'
    when 'awed'           then 'awe|awed|awe.?inspiring|breath.?taking|stunning|spectac\w*|mesmeri\w*|jaw.?dropp\w*'
    when 'curious'        then 'curio\w*|intrigu\w*|myster\w*|puzzl\w*|keeps? you guessing'
    when 'thoughtful'     then 'thought.?provok\w*|made me think|makes? you think|food for thought|reflect\w*|ponder\w*|philosoph\w*|contemplat\w*'
    when 'nostalgic'      then 'nostalg\w*|childhood|grew up|as a (kid|child)|memories'
    when 'inspired'       then 'inspir\w*|motivat\w*|made me want to'
    when 'confused'       then 'confus\w*|baffl\w*|mind.?bend\w*|puzzl\w*|head.?scratch\w*|disorient\w*'
    when 'uncomfortable'  then 'uncomfortabl\w*|discomfort|awkward\w*|cring\w*|squirm\w*|look away|hard to watch'
    when 'angry'          then 'angr\w*|anger|furious|rage|outrag\w*|infuriat\w*|livid'
    when 'disgusted'      then 'disgust\w*|revolt\w*|nause\w*|vomit\w*|gross(ed)? (me )?out|sick(ened|ening)'
    when 'drained'        then 'drain\w*|exhaust\w*|wiped out|wrung out'
end || ')\M'
$$;

-- ---------------------------------------------------------------------------
-- 2. The quote shown under a result
--
-- At most 280 characters, as before. If a cue word for the feeling appears
-- past the first 200 characters, the quote starts at the beginning of that
-- sentence (or a word boundary, if the sentence started long before) and opens
-- with "…". Otherwise it is the start of the review, exactly as before.
--
-- The page adds a closing "…" when a quote is 280 characters long, so a quote
-- that runs to the end of the review is kept under 280.
-- ---------------------------------------------------------------------------
create or replace function evidence_snippet(review text, f text) returns text
language plpgsql immutable parallel safe
as $$
declare
    s    text := regexp_replace(coalesce(review, ''), '\s+', ' ', 'g');
    n    integer := length(s);
    cue  text := feeling_cue(f);
    p    integer;
    st   integer;
    idx  integer;
    q    integer;
begin
    if cue is null then
        return left(s, 280);
    end if;
    p := regexp_instr(s, cue, 1, 1, 0, 'i');
    if p <= 200 then                    -- no cue, or already in view
        return left(s, 280);
    end if;

    -- The sentence the cue is in: the last ". " / "! " / "? " in the 200
    -- characters before it. Reversed, that boundary reads " ." etc.
    st  := p - 200;
    idx := regexp_instr(reverse(substr(s, st, p - st)), ' [.!?]');
    if idx > 0 then
        st := p - idx + 1;
    else
        -- No sentence start nearby: begin about 100 characters back, on a word.
        st := p - 100;
        q  := strpos(substr(s, st, 100), ' ');
        if q > 0 then
            st := st + q;
        end if;
    end if;

    if n - st + 1 <= 278 then           -- reaches the end of the review
        return '…' || substr(s, st);
    end if;
    return '…' || substr(s, st, 279);   -- 280 with the "…": the page closes it
end;
$$;

-- Pure text helpers: the website reaches them only through match_films, which
-- runs as its owner, so nobody else needs to call them.
revoke all on function feeling_cue(text) from public, anon, authenticated;
revoke all on function evidence_snippet(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. match_films - unchanged from 2026-11-06_search.sql except the quote
-- ---------------------------------------------------------------------------
create or replace function match_films(
    p_feelings       text[]  default '{}',
    p_avoid          text[]  default '{}',
    p_story_terms    text[]  default '{}',
    p_genres         text[]  default '{}',
    p_not_genres     text[]  default '{}',
    p_feeling_weight real    default 0.5,
    p_k              integer default 6
)
returns table (
    tmdb_id         integer,
    title           text,
    year            integer,
    genres          text[],
    overview        text,
    vote_average    real,
    review_count    integer,
    feeling_score   real,
    story_score     real,
    score           real,
    feelings        jsonb,
    evidence        text,
    evidence_feeling text,
    low_confidence  boolean,
    genre_relaxed   boolean,
    model_version   text
)
language plpgsql stable security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    q        tsquery;
    relaxed  boolean := false;
    w        real := least(greatest(coalesce(p_feeling_weight, 0.5), 0), 1);
    k        integer := least(greatest(coalesce(p_k, 6), 1), 25);
    want     text[] := coalesce(p_feelings, '{}');
    avoid    text[] := coalesce(p_avoid, '{}');
    keep     text[] := coalesce(p_genres, '{}');
    drop_g   text[] := coalesce(p_not_genres, '{}');
    terms    text[];
begin
    -- Story words: letters and digits only, so user text can't break the query.
    select coalesce(array_agg(distinct t), '{}') into terms
      from unnest(coalesce(p_story_terms, '{}')) as t
     where t ~ '^[a-z0-9]{2,30}$';
    if cardinality(terms) > 0 then
        -- OR the words together: a film matching some of them still counts.
        q := to_tsquery('english', array_to_string(terms, ' | '));
    end if;

    -- Genre filter loosens when it would leave too few films.
    if cardinality(keep) > 0 and (
        select count(*) from films f
         where f.genres && keep and not (f.genres && drop_g)
    ) < k then
        relaxed := true;
        keep := '{}';
    end if;

    return query
    with cand as (
        select f.* from films f
         where (cardinality(keep) = 0 or f.genres && keep)
           and not (f.genres && drop_g)
    ),
    best as (       -- the top score any film has, per feeling
        select ff.feeling, max(ff.score) as m
          from film_feelings ff group by ff.feeling
    ),
    feel as (
        select ff.tmdb_id,
               avg(ff.score / nullif(b.m, 0)) filter (where ff.feeling = any (want))  as want_s,
               avg(ff.score / nullif(b.m, 0)) filter (where ff.feeling = any (avoid)) as avoid_s
          from film_feelings ff join best b using (feeling)
         where ff.tmdb_id in (select c.tmdb_id from cand c)
         group by ff.tmdb_id
    ),
    story as (
        select c.tmdb_id,
               case when q is null then 0
                    else ts_rank_cd(c.search_tsv, q, 32) end as fts,
               (select count(*) from film_keywords kw
                 where kw.tmdb_id = c.tmdb_id and kw.keyword = any (terms))::real
                 / greatest(cardinality(terms), 1) as kw_s
          from cand c
    ),
    story_n as (
        select s.tmdb_id,
               0.8 * coalesce(s.fts / nullif(max(s.fts) over (), 0), 0)
             + 0.2 * s.kw_s as s_score
          from story s
    ),
    scored as (
        -- A film scored from 1-3 reviews is pulled toward 0, so it can't top
        -- the feeling ranking on one lucky review: x 0.25 at 1 review,
        -- 0.77 at 10, 0.91 at 30.
        select c.*,
               (coalesce(fe.want_s, 0)  * c.review_count / (c.review_count + 3.0))::real as f_score,
               (coalesce(fe.avoid_s, 0) * c.review_count / (c.review_count + 3.0))::real as a_score,
               coalesce(sn.s_score, 0)::real as s_score
          from cand c
          left join feel fe on fe.tmdb_id = c.tmdb_id
          left join story_n sn on sn.tmdb_id = c.tmdb_id
    ),
    ranked as (
        select s.*,
               (case
                  when cardinality(want) = 0 and cardinality(terms) = 0 then 0
                  when cardinality(want) = 0 then s.s_score
                  when cardinality(terms) = 0 then s.f_score
                  else w * s.f_score + (1 - w) * s.s_score
                end - 0.5 * s.a_score)::real as total
          from scored s
    ),
    top as (
        select r.* from ranked r
         order by r.total desc, r.vote_count desc nulls last
         limit k
    )
    select t.tmdb_id, t.title, t.year, t.genres, t.overview, t.vote_average,
           t.review_count,
           round(t.f_score::numeric, 3)::real,
           round(t.s_score::numeric, 3)::real,
           round(greatest(t.total, 0)::numeric, 3)::real,
           -- The film's scores for the requested feelings, or its top 3.
           coalesce((
               select jsonb_object_agg(x.feeling, round(x.score::numeric, 3))
                 from (select ff.feeling, ff.score from film_feelings ff
                        where ff.tmdb_id = t.tmdb_id
                          and (cardinality(want) = 0 or ff.feeling = any (want))
                        order by ff.score desc limit 3) x
           ), '{}'::jsonb),
           ev.snippet,
           ev.feeling,
           t.review_count < 20,
           relaxed,
           ev.model_version
      from top t
      left join lateral (
          -- Quote the review the model was surest about for the best feeling,
          -- centred on a cue word for that feeling when there is one.
          select ff.feeling, ff.model_version,
                 evidence_snippet(r.text, ff.feeling) as snippet
            from film_feelings ff
            left join reviews r on r.review_id = ff.evidence_review_id
           where ff.tmdb_id = t.tmdb_id
             and (cardinality(want) = 0 or ff.feeling = any (want))
           order by ff.score desc
           limit 1
      ) ev on true
     order by t.total desc, t.vote_count desc nulls last;
end;
$$;

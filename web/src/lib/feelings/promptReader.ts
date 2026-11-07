import {
  FEELING_WORDS,
  GENRE_WORDS,
  NEGATORS,
  STOPWORDS,
  type Feeling,
} from "./lexicon";

// Step 1 of the query half (README, "Query: answering a request"):
// split a plain-English request into genres, feeling words and story words.

export interface ReadPrompt {
  feelings: Feeling[];
  avoid: Feeling[];
  genres: string[];
  notGenres: string[];
  storyTerms: string[];
  /** 0..1, how much the feeling match should count against the story match. */
  feelingWeight: number;
}

const MAX_PHRASE = 4;
const NEGATION_REACH = 3; // "not too scary" -> 'scary' is 2 words after 'not'

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function readPrompt(message: string): ReadPrompt {
  const tokens = tokenize(message);
  const used = new Array(tokens.length).fill(false);
  const want = new Set<Feeling>();
  const avoid = new Set<Feeling>();
  const genres = new Set<string>();
  const notGenres = new Set<string>();
  let feelingHits = 0;

  const negatedAt = (i: number) => {
    for (let j = Math.max(0, i - NEGATION_REACH); j < i; j++) {
      if (NEGATORS.has(tokens[j])) {
        // "not only scary but sad" is rare enough to ignore; a "but" or
        // "and" between the negator and the word ends the negation.
        const between = tokens.slice(j + 1, i);
        if (!between.includes("but") && !between.includes("and")) return true;
      }
    }
    return false;
  };

  // Longest phrase first, so "science fiction" beats "fiction".
  for (let len = MAX_PHRASE; len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      if (used.slice(i, i + len).some(Boolean)) continue;
      const phrase = tokens.slice(i, i + len).join(" ");
      const feelings = FEELING_WORDS[phrase];
      const genre = GENRE_WORDS[phrase];
      if (!feelings && !genre) continue;
      for (let j = i; j < i + len; j++) used[j] = true;
      const negated = negatedAt(i);
      if (genre) (negated ? notGenres : genres).add(genre);
      if (feelings) {
        feelingHits++;
        for (const f of feelings) (negated ? avoid : want).add(f);
      }
    }
  }

  for (const f of avoid) want.delete(f);
  for (const g of notGenres) genres.delete(g);

  const storyTerms = [
    ...new Set(
      tokens.filter(
        (t, i) =>
          !used[i] &&
          !NEGATORS.has(t) &&
          !STOPWORDS.has(t) &&
          /^[a-z][a-z0-9]{2,29}$/.test(t),
      ),
    ),
  ].slice(0, 12);

  // Lean on whichever kind of word the request has more of.
  const f = feelingHits;
  const s = storyTerms.length;
  const feelingWeight =
    f === 0 ? 0 : s === 0 ? 1 : Math.min(0.8, Math.max(0.3, f / (f + s)));

  return {
    feelings: [...want],
    avoid: [...avoid],
    genres: [...genres],
    notGenres: [...notGenres],
    storyTerms,
    feelingWeight: Math.round(feelingWeight * 100) / 100,
  };
}

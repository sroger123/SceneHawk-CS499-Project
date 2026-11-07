// Tiny tokenizer + stopword list shared by the retriever, the heuristic
// interpreter, and term-matching in the ranker. Deliberately simple and
// deterministic — this is a research baseline, not a search engine.

const STOPWORDS = new Set(
  (
    "a an the and or of to in on for with without about that this it is are was were be been " +
    "i me my we you your they them their he she his her its " +
    "want like love give find show something anything movie movies film films watch watching " +
    "feel feels feeling get really very just some any more most much many " +
    "but not no don't do does did can could would should will " +
    "what which who how when where why"
  ).split(" "),
);

// Crude suffix stripping — enough to align "unsettling"/"unsettle",
// "isolation"/"isolated" partially, without a real stemmer dependency.
function stem(token: string): string {
  for (const suffix of ["iness", "ing", "edly", "ed", "es", "s", "ly"]) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

// Multi-word phrase checks happen on the raw text, not tokens.
export function containsPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

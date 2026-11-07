// Word lists the prompt reader uses to map plain English onto the 28 frozen
// feelings (chatbot/docs/feelings-list.md) and the TMDB genre names.
// Deterministic on purpose: works with no API key, and the same prompt always
// reads the same way.

export const FEELINGS = [
  "tense", "dread", "scared", "unsettled", "disturbed",
  "sad", "grief-stricken", "lonely", "moved", "bittersweet",
  "cozy", "heartwarming", "tender", "hopeful", "uplifted", "joyful",
  "thrilled", "amused", "awed", "curious",
  "thoughtful", "nostalgic", "inspired", "confused",
  "uncomfortable", "angry", "disgusted", "drained",
] as const;

export type Feeling = (typeof FEELINGS)[number];

// Single words and short phrases -> feelings. Phrases are matched first.
// Every feeling maps to itself as well (added below).
const WORDS: Record<string, Feeling[]> = {
  // Fear & tension
  "on edge": ["tense"], suspense: ["tense"], suspenseful: ["tense"],
  gripping: ["tense", "thrilled"], nervous: ["tense"], anxious: ["tense"],
  tension: ["tense"], intense: ["tense", "thrilled"], nailbiting: ["tense"],
  "nail biting": ["tense"], "slow burn": ["dread", "tense"], slowburn: ["dread", "tense"],
  ominous: ["dread"], foreboding: ["dread"], creeping: ["dread"],
  scary: ["scared"], frightening: ["scared"], terrifying: ["scared"],
  horrifying: ["scared", "disturbed"], spooky: ["scared", "unsettled"],
  "jump scare": ["scared"], "jump scares": ["scared"], jumpscare: ["scared"],
  jumpscares: ["scared"], fear: ["scared"], afraid: ["scared"], frightened: ["scared"],
  creepy: ["unsettled"], eerie: ["unsettled"], uneasy: ["unsettled"],
  unsettling: ["unsettled"], unnerving: ["unsettled"], weird: ["unsettled", "confused"],
  haunting: ["disturbed", "unsettled"], haunted: ["disturbed"], disturbing: ["disturbed"],
  dark: ["disturbed", "dread"], bleak: ["sad", "drained"], harrowing: ["disturbed", "drained"],
  // Sadness & loss
  sadness: ["sad"], depressing: ["sad"], gloomy: ["sad"], melancholy: ["sad", "bittersweet"],
  melancholic: ["sad", "bittersweet"], tearjerker: ["sad", "moved"], cry: ["sad", "moved"],
  crying: ["sad", "moved"], tears: ["sad", "moved"], heartbreaking: ["sad", "moved"],
  heartbroken: ["sad"], tragic: ["sad", "grief-stricken"], grief: ["grief-stricken"],
  mourning: ["grief-stricken"], loss: ["grief-stricken"], grieving: ["grief-stricken"],
  loneliness: ["lonely"], isolated: ["lonely"], isolation: ["lonely"], alone: ["lonely"],
  solitude: ["lonely"], touching: ["moved"], emotional: ["moved"], powerful: ["moved"],
  poignant: ["moved", "bittersweet"], "sad but hopeful": ["bittersweet", "hopeful"],
  // Warmth & uplift
  comforting: ["cozy"], comfort: ["cozy"], warm: ["cozy", "heartwarming"],
  "rainy day": ["cozy"], "rainy sunday": ["cozy"], snug: ["cozy"], relaxing: ["cozy"],
  chill: ["cozy"], wholesome: ["heartwarming", "cozy"], sweet: ["heartwarming", "tender"],
  cute: ["heartwarming"], gentle: ["tender"], soft: ["tender"], intimate: ["tender"],
  romantic: ["tender", "heartwarming"], optimistic: ["hopeful"], hope: ["hopeful"],
  uplifting: ["uplifted"], "feel good": ["uplifted", "joyful"], feelgood: ["uplifted", "joyful"],
  happy: ["joyful"], fun: ["joyful", "amused"], cheerful: ["joyful"], delightful: ["joyful"],
  joy: ["joyful"], lighthearted: ["joyful", "amused"], "light hearted": ["joyful", "amused"],
  // Excitement & wonder
  exciting: ["thrilled"], thrilling: ["thrilled"], adrenaline: ["thrilled"],
  "edge of my seat": ["tense", "thrilled"], epic: ["awed", "thrilled"],
  funny: ["amused"], hilarious: ["amused"], laugh: ["amused"], laughing: ["amused"],
  comedic: ["amused"], silly: ["amused"], witty: ["amused"],
  beautiful: ["awed"], stunning: ["awed"], breathtaking: ["awed"], spectacular: ["awed"],
  wonder: ["awed", "curious"], visually: ["awed"], gorgeous: ["awed"],
  mysterious: ["curious"], intriguing: ["curious"], puzzle: ["curious"],
  // Reflection
  "thought provoking": ["thoughtful"], thoughtprovoking: ["thoughtful"],
  philosophical: ["thoughtful"], deep: ["thoughtful"], reflective: ["thoughtful"],
  meditative: ["thoughtful"], contemplative: ["thoughtful"], cerebral: ["thoughtful", "curious"],
  nostalgia: ["nostalgic"], childhood: ["nostalgic"], "coming of age": ["nostalgic", "bittersweet"],
  inspiring: ["inspired"], motivating: ["inspired"], motivational: ["inspired"],
  "mind bending": ["confused", "curious"], mindbending: ["confused", "curious"],
  surreal: ["confused", "unsettled"], trippy: ["confused"], confusing: ["confused"],
  // Discomfort & anger
  awkward: ["uncomfortable"], cringe: ["uncomfortable"], cringey: ["uncomfortable"],
  infuriating: ["angry"], outrage: ["angry"], enraging: ["angry"], anger: ["angry"],
  gross: ["disgusted"], gory: ["disgusted"], gore: ["disgusted"], bloody: ["disgusted"],
  violent: ["disgusted", "disturbed"], violence: ["disgusted", "disturbed"],
  exhausting: ["drained"], draining: ["drained"], heavy: ["drained", "sad"],
};

for (const f of FEELINGS) {
  WORDS[f] ??= [f];
  if (f.includes("-")) WORDS[f.replace("-", " ")] ??= [f];
}

export const FEELING_WORDS = WORDS;

// Words and phrases -> TMDB genre names (as stored in films.genres).
export const GENRE_WORDS: Record<string, string> = {
  action: "Action", adventure: "Adventure", animated: "Animation",
  animation: "Animation", cartoon: "Animation", anime: "Animation",
  comedy: "Comedy", comedies: "Comedy", crime: "Crime",
  documentary: "Documentary", documentaries: "Documentary", doc: "Documentary",
  drama: "Drama", dramas: "Drama", kids: "Family", "family friendly": "Family",
  "family film": "Family", "family movie": "Family",
  fantasy: "Fantasy", historical: "History",
  horror: "Horror", horrors: "Horror", slasher: "Horror", musical: "Music",
  music: "Music", mystery: "Mystery", mysteries: "Mystery", whodunit: "Mystery",
  romance: "Romance", romcom: "Romance", "rom com": "Romance",
  "sci fi": "Science Fiction", scifi: "Science Fiction",
  "science fiction": "Science Fiction", thriller: "Thriller", thrillers: "Thriller",
  war: "War", western: "Western", westerns: "Western",
};

// Words that turn the next feeling or genre into something to avoid.
export const NEGATORS = new Set([
  "not", "no", "without", "nothing", "avoid", "never", "less", "isnt", "dont",
  "doesnt", "non", "zero", "minus", "skip", "except", "but not",
]);

// Not story words: grammar, request phrasing and generic film talk.
export const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could do does for from get give go " +
    "had has have he her him his how i if im in into is it its ive just me " +
    "more most my of on one or our out over really she so some something " +
    "such than that the their them then there these they this those to too " +
    "up us very was we were what when where which while who why will with " +
    "would you your yours film films movie movies watch watching watched " +
    "want wanted looking look find recommend recommendation show shows " +
    "kind sort type feel feels feeling feelings story stories about like " +
    "liked good great best bad lot lots bit also any anything everything " +
    "tonight night evening weekend please need make makes made ending ends " +
    "end starts start much many little way thing things lead leads based " +
    "set sets lets build builds goes going gets takes comes turns around " +
    "someone somebody person people"
  ).split(/\s+/),
);

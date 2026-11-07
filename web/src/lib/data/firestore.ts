import type { Film } from "@/lib/types";
import type { FilmRepository } from "./repository";

// ─── Firestore adapter (stub) ───────────────────────────────────
//
// Planned mapping — one document per film in a `films` collection:
//
//   films/{filmId}:
//     metadata:   { title, year, director, genres[], runtime, popularity, rating, tmdbId }
//     themes:     string[]
//     atmosphere: string[]
//     narrative:  { pacing, structure, storytelling, dialogue }
//     visualStyle:{ lighting, camera, color, aspect, composition, editing }
//     techniques: string[]
//     jumpScares: "none" | "minimal" | "moderate" | "heavy"
//     symbols:    string[]
//     analysis:   { themes, atmosphere, narrative, visual, characters }  // prose chunks
//
// The doc shape maps 1:1 onto the `Film` type, so deserialization is just
// `doc.data() as Film`. Chunking/embedding still happens in
// src/lib/retrieval/chunks.ts — Firestore replaces the JSON files,
// not the retrieval pipeline.
//
// Setup when you're ready:
//   1. npm install firebase-admin
//   2. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//      (or GOOGLE_APPLICATION_CREDENTIALS) in .env.local
//   3. Implement the two methods below with admin.firestore()
//   4. Run `npm run ingest -- --store=firebase` to upload data/films/*.json
//   5. Set FILM_STORE=firebase
export class FirestoreFilmRepository implements FilmRepository {
  async listFilms(): Promise<Film[]> {
    throw new Error(
      "FirestoreFilmRepository not implemented yet — see comments in src/lib/data/firestore.ts",
    );
  }

  async getFilm(_id: string): Promise<Film | null> {
    throw new Error(
      "FirestoreFilmRepository not implemented yet — see comments in src/lib/data/firestore.ts",
    );
  }
}

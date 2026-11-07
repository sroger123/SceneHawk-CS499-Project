import type { Film } from "@/lib/types";

// Repository interface — swap implementations via FILM_STORE env var.
// "local"    → reads data/films/*.json (default, zero infra)
// "firebase" → Firestore adapter (stub — see firestore.ts)
export interface FilmRepository {
  listFilms(): Promise<Film[]>;
  getFilm(id: string): Promise<Film | null>;
}

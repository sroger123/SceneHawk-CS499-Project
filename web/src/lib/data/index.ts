import { config } from "@/lib/config";
import type { FilmRepository } from "./repository";
import { LocalFilmRepository } from "./local";
import { FirestoreFilmRepository } from "./firestore";

let repo: FilmRepository | null = null;

export function getFilmRepository(): FilmRepository {
  if (repo) return repo;
  repo =
    config.filmStore === "firebase"
      ? new FirestoreFilmRepository()
      : new LocalFilmRepository();
  return repo;
}

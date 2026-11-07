import { promises as fs } from "fs";
import path from "path";
import type { Film } from "@/lib/types";
import type { FilmRepository } from "./repository";

const FILMS_DIR = path.join(process.cwd(), "data", "films");

// Reads the curated film JSON files from data/films/.
// Cached for the process lifetime — the dataset is the research corpus,
// not user data, so staleness within a session is fine.
export class LocalFilmRepository implements FilmRepository {
  private cache: Film[] | null = null;

  async listFilms(): Promise<Film[]> {
    if (this.cache) return this.cache;
    const files = (await fs.readdir(FILMS_DIR)).filter((f) =>
      f.endsWith(".json"),
    );
    const films = await Promise.all(
      files.map(async (file) => {
        const raw = await fs.readFile(path.join(FILMS_DIR, file), "utf8");
        return JSON.parse(raw) as Film;
      }),
    );
    films.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
    this.cache = films;
    return films;
  }

  async getFilm(id: string): Promise<Film | null> {
    const films = await this.listFilms();
    return films.find((f) => f.id === id) ?? null;
  }
}

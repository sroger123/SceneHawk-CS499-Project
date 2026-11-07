import { NextRequest, NextResponse } from "next/server";
import {
  searchByFeeling,
  searchStatus,
  supabaseConfig,
  writeReply,
} from "@/lib/feelings/search";

// POST /api/chat { message, k? }  ->  { reply, films[] }
//
// Answers from the two Supabase tables: the feelings table (filled offline by
// the trained model, chatbot/scripts/12_score_reviews.py) and the description
// table (chatbot/scripts/13_build_descriptions.py). The response keeps the
// shape in chatbot/docs/api-contract.md, so the chat page needs no backend
// server of its own.
//
// GET /api/chat  ->  health check: how many films have feeling scores.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NOT_CONFIGURED =
  "The feelings search isn't connected yet. Set SUPABASE_URL and SUPABASE_ANON_KEY (see DEPLOY.md), then try again.";

export async function POST(req: NextRequest) {
  let message = "";
  let k = 6;
  try {
    const body = (await req.json()) as { message?: string; k?: number };
    message = (body.message ?? "").trim().slice(0, 500);
    if (typeof body.k === "number") k = Math.min(Math.max(Math.round(body.k), 1), 12);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "missing message" }, { status: 400 });
  }

  if (!supabaseConfig()) {
    return NextResponse.json({ reply: NOT_CONFIGURED, films: [] }, { status: 503 });
  }

  try {
    const result = await searchByFeeling(message, k);
    return NextResponse.json({
      reply: writeReply(result),
      interpreted: result.read,
      films: result.films.map((f) => ({
        title: f.title,
        year: f.year ?? undefined,
        rating: f.rating ?? undefined,
        similarity: f.score,
        summary: f.evidence ?? f.overview ?? undefined,
        genres: f.genres,
        feelings: f.feelings,
        evidence: f.evidence ?? undefined,
        evidence_feeling: f.evidenceFeeling ?? undefined,
        review_count: f.reviewCount,
        low_confidence: f.lowConfidence,
        model_version: f.modelVersion ?? undefined,
      })),
    });
  } catch (err) {
    console.error("feelings search failed", err);
    return NextResponse.json(
      {
        reply:
          "The film database didn't answer. Check that the Supabase project is running and the search migration has been applied, then try again.",
        films: [],
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  if (!supabaseConfig()) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 });
  }
  try {
    const s = await searchStatus();
    return NextResponse.json({ status: "ok", ...s });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 502 });
  }
}

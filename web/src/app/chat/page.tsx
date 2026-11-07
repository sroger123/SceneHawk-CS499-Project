import ChatPanel from "@/components/ChatPanel";
import { Container, Em, PageHeader } from "@/components/ui";

export const metadata = { title: "Chat" };

// Feelings search: /api/chat reads the prompt and asks Supabase to rank films
// by the feelings table (filled offline by the trained model) and the
// description table. Distinct from /search, which runs the four comparison
// pipelines over the curated 29-film corpus.
export default function ChatPage() {
  return (
    <Container className="max-w-[860px] pb-24">
      <PageHeader
        center
        title={
          <>
            Film recommendations by <Em>chat</Em>
          </>
        }
        lead="Describe the mood or story you want. Films are ranked by the feeling scores our model gave their reviews and by how well their description matches."
      />

      <ChatPanel />

      <p className="mt-4 text-center text-xs text-fg-faint">
        Answers come only from the films in our database, never invented. The
        feelings model is an early version, so scores are rough.
      </p>
    </Container>
  );
}

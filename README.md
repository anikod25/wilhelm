# Wilhelm IP Tracker Assistant

Wilhelm is a conversational assistant for an IP portfolio. It uses the LLM to
understand natural questions and follow-ups, then consults the appropriate
source:

- **Supabase patent records** for current status and structured tracker fields.
- **Patent-document RAG** for filing documents, office actions, responses, and
  other indexed reference material.

For current status, the tracker record is authoritative. Documents provide
supporting context and citations. Wilhelm should not infer a status or invent a
progress timeline.

## What works in this branch

- Conversational LLM planning and answer generation with session history.
- Exact patent lookup by application number or IP ID.
- Follow-up resolution using the active patent in the conversation.
- Semantic retrieval of indexed patent documents, optionally scoped to an
  application number.
- Document source citations shown in the chat.
- Local ingestion for text PDFs, Markdown, and TXT files.
- IP-focused chat UI, record details, lookup status, and no fabricated patent
  records in the interface.

The old HR/IT router and seed-document ingestion are no longer used by the
active chat route. Generic RAG/vector modules remain available for the patent
document flow.

## Add documents locally

Patent documents belong in the local `data/patent-documents/` folder. The whole
folder is listed in `.gitignore`, so filings and other private documents are
not committed or pushed.

For application-specific documents, use this layout:

```text
data/patent-documents/<application-number>/<document-name>.pdf
```

The first directory name becomes the document's `application_number` metadata,
which lets retrieval stay scoped to the current patent. General patent
reference documents can sit directly in `data/patent-documents/` and will be
searchable across the patent document collection.

Supported formats: text-based PDF, Markdown, and TXT. Scanned image-only PDFs
need OCR before ingestion. The app does not upload or ingest documents
automatically when they are copied into the folder; run the ingestion command
after reviewing the local files.

## Environment

Copy `backend/.env.example` to `backend/.env` and set the project values. The
default OpenAI + Supabase setup uses:

```env
PORT=3001
NODE_ENV=development
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=your-openai-api-key
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
VECTOR_STORE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_PATENT_VIEW=patents
SUPABASE_TABLE=documents
SUPABASE_MATCH_FUNCTION=match_documents
SUPABASE_CLEANUP_FUNCTION=cleanup_patent_document_chunks
PATENT_RAG_TOP_K=5
```

The LLM and embedding providers can also use Gemini or a local
OpenAI-compatible endpoint; see the comments in `backend/.env.example`.
Keep all keys in `backend/.env`; do not put Supabase credentials in frontend
environment variables or commit them.

## Supabase setup

`backend/supabase/schema.sql` creates the pgvector document table and the
search/cleanup functions used by ingestion and retrieval. Apply it in the
Supabase SQL editor before indexing patent documents. It assumes
`text-embedding-3-small` at 1536 dimensions.

The structured lookup reads `SUPABASE_PATENT_VIEW` (default `patents`) with the
anon key and normal Supabase row-level security. The document vector adapter
uses the service-role key from the backend. The current app does not implement
user sign-in or per-user authorization; do not expose confidential tracker
records or filings through a publicly accessible deployment until
authentication and access controls are added.

## Run locally

Requirements: Node.js 20+.

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

Run the backend and frontend commands in separate terminals from the
repository root. Open `http://localhost:5173`.

## Ingest patent documents

First preview the local files and chunks without embedding or writing to
Supabase:

```bash
npm run ingest:patents:dry-run --prefix backend
```

After confirming the folder contents, apply the schema and environment values,
then ingest:

```bash
npm run ingest:patents --prefix backend
```

Re-ingestion upserts chunks with stable IDs and removes obsolete trailing
chunks for each source. It does not delete documents for source files that
have been removed from the local folder; those should be reviewed and removed
from the index deliberately.

An optional read-only structured lookup check can be run with
`TEST_PATENT_APPLICATION_NUMBER` or `TEST_PATENT_ID` set in `backend/.env`:

```bash
npm run lookup:patent --prefix backend
```

## Chat API

`POST /api/chat`

```json
{
  "query": "What is the status of application number ABC-123?",
  "sessionId": "optional id returned by the previous response"
}
```

The LLM can route to a tracker lookup, patent document search, both, or a
normal conversational response. The result includes the answer, patent record
when retrieved, source documents, grounding state, session ID, and timing.

## Remaining work

- Confirm the live tracker table/view columns and RLS policy.
- Add user authentication and authorization before use with restricted records
  or filings.
- Confirm whether status-history data exists and add it to answers only if the
  tracker provides it.
- Add OCR for scanned filings if those documents need to be indexed.
- Add a deliberate document-removal/pruning workflow for retired filings.

# Wilhelm — IP Tracker Chatbot

This branch is the IP-tracker version of Wilhelm. It combines a conversational
LLM with structured portfolio lookup and retrieval over general IP reference
materials or documents attached to a specific tracked application.

For each question, Wilhelm uses the relevant source:

- **Supabase patent records** for current status and structured tracker fields;
  this integration uses read-only lookups.
- **Chroma** for patent-related documents, filing forms, process guides,
  notices, office actions, responses, and other indexed materials.

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

## Add documents locally

IP reference materials belong in the local `data/patent-documents/` folder.
The whole folder is listed in `.gitignore`, so example materials and private
filings are not committed or pushed. General forms, notices, and process guides
can be grouped under `general/`:

```text
data/patent-documents/general/forms/filing-intake-form.md
data/patent-documents/general/notices/sample-formalities-notice.md
data/patent-documents/general/process/filing-process-guide.md
```

Those general documents are searchable across the knowledge base and have no
application-number filter. For a filing that belongs to one tracked record,
use:

```text
data/patent-documents/applications/<application-number>/<document-name>.pdf
```

The older `<application-number>/<document-name>` layout remains supported.
The application number becomes metadata so retrieval can stay scoped to the
current record. Avoid naming a general-material folder after an application
number; general categories such as `general`, `forms`, `notices`, and
`process` are recognized as unscoped.

The local demo materials are synthetic examples, not official forms, notices,
jurisdiction-specific procedures, or legal advice. Confirm actual requirements
and response deadlines against the relevant IP office and notice. These local
examples are ignored by Git and are not included in commits.

Supported formats: text-based PDF, Markdown, and TXT. Scanned image-only PDFs
need OCR before ingestion. The app does not upload or ingest documents
automatically when they are copied into the folder; run the ingestion command
after reviewing the local files.

## Environment

Copy `backend/.env.example` to `backend/.env` and set the project values. The
default OpenAI + Chroma setup uses:

```env
PORT=3001
NODE_ENV=development
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=your-openai-api-key
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
VECTOR_STORE_PROVIDER=chroma
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_PATENT_VIEW=patents
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=wilhelm
PATENT_RAG_TOP_K=5
```

The LLM and embedding providers can also use Gemini or a local
OpenAI-compatible endpoint; see the comments in `backend/.env.example`.
Keep keys in `backend/.env`; do not put Supabase credentials in frontend
environment variables or commit them. Supabase is used only to read the
existing patent tracker view. Wilhelm does not write tracker records or patent
documents to Supabase.

## Data storage

The app reads tracker records from `SUPABASE_PATENT_VIEW` (default `patents`)
using the anon key and the project's existing row-level security. No Supabase
schema update is required for the document chatbot.

Patent-document ingestion and semantic search use the local Chroma server. No
document chunk is written to Supabase. `backend/supabase/schema.sql` is not
used by the current Chroma configuration; do not apply it for this setup.

## Run locally

Requirements: Node.js 20+.

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

Run Chroma, the backend, and the frontend in separate terminals from the
repository root:

```powershell
chroma run --path .\backend\chroma_db --host localhost --port 8000
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`. Chroma must remain running while asking about
documents.

## Ingest patent documents

First preview the local files and chunks without generating embeddings or
writing to Chroma:

```bash
npm run ingest:patents:dry-run --prefix backend
```

After confirming the folder contents and setting `VECTOR_STORE_PROVIDER=chroma`
plus the embedding provider values, ingest into Chroma:

```bash
npm run ingest:patents --prefix backend
```

Ingestion upserts chunks with stable IDs and removes obsolete trailing chunks
for each source in Chroma. Supabase is not modified. If a source file is
removed from the local folder, remove its Chroma records deliberately.

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

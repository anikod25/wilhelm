/**
 * Embedding + vector-store adapter
 *
 * Public API (three functions, nothing else should ever be imported):
 *
 *   embedText(text)
 *     → Promise<number[]>
 *     Embeds a plain string using the configured embedding provider.
 *
 *   upsertVectors(items)
 *     → Promise<void>
 *     Writes one or more vectors to the configured vector store.
 *     items: Array<{ id: string, embedding: number[], metadata?: object, text?: string }>
 *
 *   queryVectorStore(embedding, topK, filter)
 *     → Promise<QueryResult[]>
 *     Nearest-neighbour search.  Returns up to topK matches.
 *     filter: provider-specific metadata filter (optional)
 *     QueryResult: { id: string, score: number, metadata: object, text?: string }
 *
 * ── Embedding providers ───────────────────────────────────────────────────────
 *   EMBEDDING_PROVIDER = openai | gemini | local   (default: openai)
 *   EMBEDDING_MODEL    = model name for the chosen provider
 *   EMBEDDING_BASE_URL = base URL override for local (falls back to LLM_BASE_URL)
 *   OPENAI_API_KEY / GEMINI_API_KEY / LOCAL_API_KEY
 *
 * ── Vector-store providers ────────────────────────────────────────────────────
 *   Chroma (the document store for this branch; requires a running server):
 *     CHROMA_URL        (default: http://localhost:8000)
 *     CHROMA_COLLECTION (default: wilhelm)
 */

import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { ChromaClient } from 'chromadb'

// ── Env helpers ───────────────────────────────────────────────────────────────

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function env(name, fallback = undefined) {
  return process.env[name] ?? fallback
}

// ── Embedding providers ───────────────────────────────────────────────────────

/**
 * OpenAI embeddings.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedOpenAI(text) {
  const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })
  const model = env('EMBEDDING_MODEL', 'text-embedding-3-small')

  const response = await client.embeddings.create({
    model,
    input: text,
    encoding_format: 'float',
  })

  return response.data[0].embedding
}

/**
 * Gemini embeddings via @google/genai.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedGemini(text) {
  const ai = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') })
  const model = env('EMBEDDING_MODEL', 'gemini-embedding-2')

  const response = await ai.models.embedContent({
    model,
    contents: text,
  })

  // response.embeddings is an array of ContentEmbedding; we want the first one
  return response.embeddings[0].values
}

/**
 * Local embeddings — any OpenAI-compatible endpoint (Ollama, LM Studio, etc.).
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedLocal(text) {
  const baseURL =
    env('EMBEDDING_BASE_URL') || requireEnv('LLM_BASE_URL')
  const apiKey = env('LOCAL_API_KEY', 'local')
  const model = env('EMBEDDING_MODEL', 'nomic-embed-text')

  const client = new OpenAI({ baseURL, apiKey })

  const response = await client.embeddings.create({
    model,
    input: text,
    encoding_format: 'float',
  })

  return response.data[0].embedding
}

const EMBEDDING_PROVIDERS = {
  openai: embedOpenAI,
  gemini: embedGemini,
  local: embedLocal,
}

// ── Vector-store providers ────────────────────────────────────────────────────

// Lazy singletons — created once on first use so startup doesn't fail if
// credentials aren't set for a store that won't be used.
let _chromaCollection = null

async function getChromaCollection() {
  if (_chromaCollection) return _chromaCollection

  const chromaUrl = new URL(env('CHROMA_URL', 'http://localhost:8000'))
  const client = new ChromaClient({
    host: chromaUrl.hostname,
    port: Number(chromaUrl.port || (chromaUrl.protocol === 'https:' ? 443 : 80)),
    ssl: chromaUrl.protocol === 'https:',
  })
  const collectionName = env('CHROMA_COLLECTION', 'wilhelm')

  // Wilhelm supplies vectors itself, so Chroma must not select a default embedder.
  _chromaCollection = await client.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: null,
  })
  return _chromaCollection
}

// ── Upsert implementations ────────────────────────────────────────────────────

/**
 * @param {Array<{id: string, embedding: number[], metadata?: object, text?: string}>} items
 */
async function upsertChroma(items) {
  const collection = await getChromaCollection()

  await collection.upsert({
    ids: items.map((i) => i.id),
    embeddings: items.map((i) => i.embedding),
    metadatas: items.map(({ metadata = {} }) => Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined)
    )),
    documents: items.map((i) => i.text ?? ''),
  })
}

// ── Query implementations ─────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, score: number, metadata: object, text?: string }} QueryResult
 */

/**
 * @param {number[]} embedding
 * @param {number} topK
 * @param {object} [filter]
 * @returns {Promise<QueryResult[]>}
 */
async function queryChroma(embedding, topK, filter) {
  const collection = await getChromaCollection()

  const response = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where: filter,
  })

  // Chroma returns parallel arrays; zip them into result objects
  const ids = response.ids[0] ?? []
  const distances = response.distances[0] ?? []
  const metadatas = response.metadatas[0] ?? []
  const documents = response.documents[0] ?? []

  return ids.map((id, i) => ({
    id,
    // Chroma returns L2 distance; convert to a 0–1 similarity score
    score: 1 / (1 + distances[i]),
    metadata: metadatas[i] ?? {},
    text: documents[i] ?? undefined,
  }))
}

/** Remove stale tail chunks after a source has been successfully re-ingested. */
export async function cleanupStalePatentChunks(sourceId, keepChunkCount) {
  const collection = await getChromaCollection()
  await collection.delete({
    where: {
      $and: [
        { source_id: { $eq: sourceId } },
        { chunkIndex: { $gte: keepChunkCount } },
      ],
    },
  })
}

const VECTOR_STORE_PROVIDERS = { chroma: { upsert: upsertChroma, query: queryChroma } }

function getVectorStore() {
  const provider = env('VECTOR_STORE_PROVIDER', 'chroma').toLowerCase()
  const store = VECTOR_STORE_PROVIDERS[provider]
  if (!store) {
    throw new Error(
      `Unknown VECTOR_STORE_PROVIDER "${provider}". This branch uses Chroma for patent documents.`
    )
  }
  return store
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Embed a plain string using the configured embedding provider.
 *
 * @param {string} text
 * @returns {Promise<number[]>} Dense embedding vector.
 */
export async function embedText(text) {
  const provider = env('EMBEDDING_PROVIDER', 'openai').toLowerCase()

  const handler = EMBEDDING_PROVIDERS[provider]
  if (!handler) {
    throw new Error(
      `Unknown EMBEDDING_PROVIDER "${provider}". Valid values: ${Object.keys(EMBEDDING_PROVIDERS).join(', ')}`
    )
  }

  return handler(text)
}

/**
 * Write vectors to the configured vector store.
 * Creates or replaces records with matching IDs (upsert semantics).
 *
 * @param {Array<{
 *   id:        string,
 *   embedding: number[],
 *   metadata?: object,
 *   text?:     string,
 * }>} items
 * @returns {Promise<void>}
 */
export async function upsertVectors(items) {
  if (!items.length) return
  return getVectorStore().upsert(items)
}

/**
 * Nearest-neighbour search against the configured vector store.
 *
 * @param {number[]} embedding  - Query vector (must match index dimensions).
 * @param {number}   topK       - Maximum number of results to return.
 * @param {object}   [filter]   - Chroma metadata filter (optional).
 * @returns {Promise<Array<{id: string, score: number, metadata: object, text?: string}>>}
 */
export async function queryVectorStore(embedding, topK = 10, filter) {
  return getVectorStore().query(embedding, topK, filter)
}

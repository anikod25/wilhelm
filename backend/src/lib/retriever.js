/**
 * retriever.js — semantic retrieval over the vector store
 *
 * Public API:
 *   retrieve(query, domain, options?)  →  Promise<RetrievalResult[]>
 *
 * RetrievalResult:
 * {
 *   id:       string   — chunk id, e.g. "hr-policies/01-annual-leave/0"
 *   text:     string   — chunk prose text
 *   score:    number   — similarity score (higher = more relevant)
 *   metadata: {
 *     domain:      string   — e.g. "hr-policies"
 *     filename:    string   — e.g. "01-annual-leave"
 *     filePath:    string   — e.g. "hr-policies/01-annual-leave.md"
 *     heading:     string   — nearest section heading, or ""
 *     chunkIndex:  number
 *     totalChunks: number
 *     wordCount:   number
 *   }
 * }
 *
 * Domain mapping:
 *   The router produces short labels ('hr' | 'support').
 *   The vector store uses the directory basename as stored during ingestion
 *   ('hr-policies' | 'it-support').  This module owns that mapping so
 *   callers never need to know the internal storage names.
 *
 * Filter behaviour:
 *   When domain is 'out_of_scope' or unrecognised, retrieve() returns []
 *   immediately without hitting the vector store — there is nothing useful
 *   to retrieve for queries that are outside the knowledge base.
 *
 *   When domain is null/undefined, no filter is applied and all domains
 *   are searched (useful for testing or future cross-domain queries).
 *
 * Both Pinecone and Chroma accept the same { field: { $eq: value } }
 * filter syntax for metadata equality, so no provider-specific branching
 * is needed here.
 */

import { embedText, queryVectorStore } from './vectorstore.js'

// ── Domain mapping ────────────────────────────────────────────────────────────

/**
 * Map router labels → stored metadata.domain values.
 * Add entries here if new domains are ingested.
 *
 * @type {Record<string, string>}
 */
const DOMAIN_MAP = {
  hr:      'hr-policies',
  support: 'it-support',
}

/**
 * Resolve a router label to its stored domain string, or null if no
 * filter should be applied (pass-through), or false if the domain is
 * explicitly out of scope and retrieval should be skipped.
 *
 * @param {string|null|undefined} domain
 * @returns {string | null | false}
 */
function resolveStoredDomain(domain) {
  if (domain == null)             return null          // no filter — search all
  if (domain === 'out_of_scope')  return false         // skip retrieval
  const stored = DOMAIN_MAP[domain]
  if (!stored)                    return false         // unknown label — skip
  return stored
}

// ── Result shaping ────────────────────────────────────────────────────────────

/**
 * Normalise a raw QueryResult from the vector-store adapter into the
 * shape callers expect.  Guards against missing fields so the retriever
 * is resilient to schema drift over time.
 *
 * @param {import('./vectorstore.js').QueryResult} raw
 * @returns {RetrievalResult}
 */
function shapeResult(raw) {
  return {
    id:    raw.id,
    text:  raw.text ?? raw.metadata?.text ?? '',
    score: typeof raw.score === 'number' ? raw.score : 0,
    metadata: {
      domain:      raw.metadata?.domain      ?? '',
      filename:    raw.metadata?.filename    ?? '',
      filePath:    raw.metadata?.filePath    ?? '',
      heading:     raw.metadata?.heading     ?? '',
      chunkIndex:  raw.metadata?.chunkIndex  ?? 0,
      totalChunks: raw.metadata?.totalChunks ?? 0,
      wordCount:   raw.metadata?.wordCount   ?? 0,
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:       string,
 *   text:     string,
 *   score:    number,
 *   metadata: {
 *     domain:      string,
 *     filename:    string,
 *     filePath:    string,
 *     heading:     string,
 *     chunkIndex:  number,
 *     totalChunks: number,
 *     wordCount:   number,
 *   }
 * }} RetrievalResult
 */

/**
 * Embed a query and return the most semantically similar chunks,
 * optionally filtered to a single knowledge domain.
 *
 * @param {string}      query           - Raw user question
 * @param {string|null} [domain]        - Router label: 'hr' | 'support' | 'out_of_scope' | null
 * @param {object}      [options]
 * @param {number}      [options.topK=5]          - Number of results to return
 * @param {number}      [options.minScore=0]       - Discard results below this score (0 = keep all)
 * @param {object}      [options.extraFilter]      - Merged into the vector-store filter (advanced)
 * @returns {Promise<RetrievalResult[]>}           - Sorted best-first; empty array if out_of_scope
 *
 * @example
 * // Typical call from the answer pipeline:
 * const chunks = await retrieve("How much annual leave do I get?", "hr")
 *
 * @example
 * // Raise topK and set a minimum score threshold:
 * const chunks = await retrieve(query, "support", { topK: 8, minScore: 0.75 })
 *
 * @example
 * // Cross-domain search (no filter):
 * const chunks = await retrieve(query, null, { topK: 10 })
 */
export async function retrieve(query, domain, options = {}) {
  const { topK = 5, minScore = 0, extraFilter } = options

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return []
  }

  // ── Resolve domain filter ─────────────────────────────────────────────────

  const storedDomain = resolveStoredDomain(domain)

  // Explicit skip — nothing in the knowledge base covers this domain
  if (storedDomain === false) {
    return []
  }

  // Build the filter object understood by both Pinecone and Chroma
  let filter
  if (storedDomain !== null) {
    filter = { domain: { $eq: storedDomain } }
  }
  if (extraFilter) {
    // Merge caller-supplied filter fields (simple shallow merge — extend
    // to $and if you need compound filters in future)
    filter = { ...(filter ?? {}), ...extraFilter }
  }

  // ── Embed + query ─────────────────────────────────────────────────────────

  // Ask for more results than topK so we have room to apply minScore
  // filtering without always coming back short.
  const fetchK = minScore > 0 ? Math.min(topK * 3, 100) : topK

  const embedding = await embedText(query.trim())
  const raw = await queryVectorStore(embedding, fetchK, filter)

  // ── Post-process ──────────────────────────────────────────────────────────

  return raw
    .map(shapeResult)
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)   // best-first (adapters should sort, but be safe)
    .slice(0, topK)
}

/**
 * Convenience re-export of the domain map so callers can inspect or
 * extend valid domains without importing from a separate config file.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SUPPORTED_DOMAINS = Object.freeze({ ...DOMAIN_MAP })

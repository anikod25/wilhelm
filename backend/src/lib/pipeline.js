/**
 * pipeline.js — end-to-end RAG pipeline
 *
 * Wires together the router, retriever, and answer-generation modules into
 * a single call.  This is the only function the HTTP handler (or any other
 * entry point) should import.
 *
 * Public API:
 *   ask(query, options?)  →  Promise<PipelineResult>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PipelineResult
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   answer:     string          — prose answer, fallback phrase, or fixed OOS message
 *   sources:    SourceRef[]     — deduplicated list of documents cited (empty for OOS)
 *   grounded:   boolean         — false when the LLM had no relevant context
 *   domain:     string          — router label: 'hr' | 'support' | 'out_of_scope'
 *   confidence: string          — router confidence: 'high' | 'low'
 *   stage:      PipelineStage   — where the pipeline terminated (for debugging / API meta)
 *   timing: {
 *     routeMs:    number        — ms spent in routeQuery()
 *     retrieveMs: number        — ms spent in retrieve()  (0 for out_of_scope)
 *     answerMs:   number        — ms spent in generateAnswer() (0 for out_of_scope)
 *     totalMs:    number
 *   }
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PipelineStage values
 * ─────────────────────────────────────────────────────────────────────────────
 *   'answered'        — full pipeline ran and the LLM produced a grounded answer
 *   'no_context'      — pipeline ran but retrieval returned zero chunks;
 *                       answer is the standard "I don't have that information"
 *   'ungrounded'      — pipeline ran but the LLM signalled the context didn't
 *                       cover the question
 *   'out_of_scope'    — router classified query as out_of_scope;
 *                       retrieval and LLM were skipped entirely
 *   'low_confidence'  — router returned confidence='low' AND domain='out_of_scope';
 *                       same skip behaviour as out_of_scope but flagged separately
 *                       so the caller can optionally handle it differently
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Out-of-scope behaviour
 * ─────────────────────────────────────────────────────────────────────────────
 *   When domain === 'out_of_scope', the pipeline returns immediately with a
 *   fixed message — no embed call, no vector-store query, no LLM call.
 *   The message acknowledges the limitation without being dismissive.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Options
 * ─────────────────────────────────────────────────────────────────────────────
 *   retrieve:      object  — forwarded to retrieve()       (topK, minScore, …)
 *   answer:        object  — forwarded to generateAnswer()  (temperature, maxTokens, …)
 */

import { routeQuery }     from './router.js'
import { retrieve }       from './retriever.js'
import { generateAnswer } from './answer.js'

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Shown verbatim when the query is classified as out_of_scope.
 * Friendly, not robotic — explains scope without a dead end.
 */
const OUT_OF_SCOPE_MESSAGE =
  "I'm only able to answer questions about company HR policies and IT support. " +
  "Your question doesn't appear to fall into either of those areas. " +
  "If you think this is a mistake, try rephrasing your question or contact " +
  "People Operations (people@company.com) or the IT Helpdesk (helpdesk@company.com) directly."

// ── Helpers ───────────────────────────────────────────────────────────────────

/** @returns {number} high-resolution timestamp in ms */
const now = () => performance.now()

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {'answered' | 'no_context' | 'ungrounded' | 'out_of_scope' | 'low_confidence'} PipelineStage
 */

/**
 * @typedef {{
 *   answer:     string,
 *   sources:    import('./answer.js').SourceRef[],
 *   grounded:   boolean,
 *   domain:     string,
 *   confidence: string,
 *   stage:      PipelineStage,
 *   timing: {
 *     routeMs:    number,
 *     retrieveMs: number,
 *     answerMs:   number,
 *     totalMs:    number,
 *   }
 * }} PipelineResult
 */

/**
 * Run the full RAG pipeline for a user query.
 *
 * @param {string}  query
 * @param {object}  [options]
 * @param {object}  [options.retrieve]   - Options passed to retrieve()
 * @param {object}  [options.answer]     - Options passed to generateAnswer()
 * @returns {Promise<PipelineResult>}
 *
 * @example
 * import { ask } from './lib/pipeline.js'
 *
 * const result = await ask("How many sick days do I get?")
 * // result.answer     → "You are entitled to 10 days of paid sick leave per year [1]."
 * // result.domain     → "hr"
 * // result.stage      → "answered"
 * // result.sources    → [{ filename: "02-sick-leave", … }]
 *
 * @example
 * // Control retrieval depth and answer temperature:
 * const result = await ask(query, {
 *   retrieve: { topK: 8, minScore: 0.7 },
 *   answer:   { temperature: 0, maxTokens: 256 },
 * })
 */
export async function ask(query, options = {}) {
  const pipelineStart = now()
  const timing = { routeMs: 0, retrieveMs: 0, answerMs: 0, totalMs: 0 }

  // ── 1. Route ───────────────────────────────────────────────────────────────

  const routeStart = now()
  const { domain, confidence, raw: routeRaw } = await routeQuery(query)
  timing.routeMs = now() - routeStart

  // ── 2. Out-of-scope fast path ──────────────────────────────────────────────
  // Skip retrieval and LLM entirely — keeps latency low and cost zero for
  // questions the knowledge base was never meant to cover.

  if (domain === 'out_of_scope') {
    timing.totalMs = now() - pipelineStart
    return {
      answer:     OUT_OF_SCOPE_MESSAGE,
      sources:    [],
      grounded:   false,
      domain,
      confidence,
      stage:      confidence === 'low' ? 'low_confidence' : 'out_of_scope',
      timing,
    }
  }

  // ── 3. Retrieve ────────────────────────────────────────────────────────────

  const retrieveStart = now()
  const chunks = await retrieve(query, domain, options.retrieve)
  timing.retrieveMs = now() - retrieveStart

  // ── 4. No-context fast path ────────────────────────────────────────────────
  // The router accepted the domain but the vector store returned nothing.
  // generateAnswer would short-circuit the same way, but being explicit
  // here keeps stage labelling accurate and avoids an unnecessary function call.

  if (chunks.length === 0) {
    timing.totalMs = now() - pipelineStart
    return {
      answer:     "I don't have that information",
      sources:    [],
      grounded:   false,
      domain,
      confidence,
      stage:      'no_context',
      timing,
    }
  }

  // ── 5. Generate answer ─────────────────────────────────────────────────────

  const answerStart = now()
  const { answer, sources, grounded, usage } = await generateAnswer(
    query,
    chunks,
    options.answer,
  )
  timing.answerMs = now() - answerStart
  timing.totalMs  = now() - pipelineStart

  // ── 6. Determine final stage ───────────────────────────────────────────────

  /** @type {PipelineStage} */
  const stage = grounded ? 'answered' : 'ungrounded'

  return {
    answer,
    sources,
    grounded,
    domain,
    confidence,
    stage,
    timing,
  }
}

/**
 * The fixed message returned for out-of-scope queries.
 * Exported so the API layer can reference it without hard-coding the string.
 */
export { OUT_OF_SCOPE_MESSAGE }

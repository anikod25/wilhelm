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
import { createSession, getSession } from './session.js'

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

// ── History-aware pipeline ────────────────────────────────────────────────────

/**
 * How many prior turns to inject into the prompt by default.
 * Keeping this small (6 = 3 exchanges) limits prompt bloat while still
 * covering the common "and what about X?" / "give me that as Y" patterns.
 */
const DEFAULT_HISTORY_TURNS = 6

/**
 * Queries that are almost certainly format-conversion or follow-up requests
 * rather than new domain questions.  When one of these patterns matches AND
 * the session has a prior domain, we skip re-routing and reuse the last domain.
 *
 * The list is intentionally conservative — false-positives (treating a new
 * question as a follow-up) are worse than false-negatives.
 */
const FOLLOWUP_PATTERNS = [
  /^(now\s+)?(give|show|return|format|convert|output|render)\s+(me\s+)?(it|that|this|the\s+(answer|result|response))/i,
  /^(as|in)\s+(json|xml|xlsx|csv|email|plain\s+text|markdown)/i,
  /^(can\s+you\s+)?(also|instead)\s+/i,
  /^what\s+about\b/i,
  /^and\s+(what|how|when|where|who|why)\b/i,
  /^(explain|clarify|elaborate|expand)\s+(that|it|more|further)/i,
  /^(translate|summarise|summarize)\s+(that|it)/i,
]

/**
 * Returns true when the query looks like a follow-up to the previous turn
 * rather than an independent new question.
 *
 * @param {string} query
 * @param {string | null} lastDomain
 * @returns {boolean}
 */
function looksLikeFollowUp(query, lastDomain) {
  if (!lastDomain) return false
  const q = query.trim()
  return FOLLOWUP_PATTERNS.some((re) => re.test(q))
}

/**
 * @typedef {{
 *   sessionId: string,
 * } & PipelineResult} HistoryPipelineResult
 */

/**
 * History-aware version of ask().
 *
 * Wraps ask() with three additional behaviours:
 *   1. Reads prior turns from the session and injects them into the answer
 *      prompt via options.answer.history — resolves follow-up references.
 *   2. Detects obvious follow-up queries and skips re-routing, reusing the
 *      last session domain instead.
 *   3. Appends the new user query and assistant answer as turns after each
 *      successful pipeline run.
 *
 * Session lifecycle:
 *   - If sessionId names an existing session, it is reused.
 *   - If sessionId is omitted or unknown, a new session is created and its
 *     ID is returned in the result so the caller can persist it.
 *
 * @param {string}  query
 * @param {object}  [options]
 * @param {string}  [options.sessionId]          — existing session ID (optional)
 * @param {number}  [options.historyTurns=6]      — how many prior turns to inject
 * @param {object}  [options.retrieve]            — forwarded to retrieve()
 * @param {object}  [options.answer]              — forwarded to generateAnswer()
 * @returns {Promise<HistoryPipelineResult>}
 *
 * @example
 * import { askWithHistory, createSession } from './lib/pipeline.js'
 *
 * // First turn — no session yet
 * const r1 = await askWithHistory('How many sick days do I get?')
 * // r1.sessionId → "a3f9c2b1..."  (auto-generated)
 * // r1.answer    → "You are entitled to 10 days..."
 *
 * // Follow-up reuses session — history injected automatically
 * const r2 = await askWithHistory('And what about annual leave?', {
 *   sessionId: r1.sessionId,
 * })
 *
 * // Format follow-up — domain reused, no re-route
 * const r3 = await askWithHistory('Give me that as JSON', {
 *   sessionId: r1.sessionId,
 * })
 */
export async function askWithHistory(query, options = {}) {
  const {
    sessionId,
    historyTurns = DEFAULT_HISTORY_TURNS,
    retrieve: retrieveOpts,
    answer:   answerOpts,
    ...rest
  } = options

  // ── Resolve or create session ─────────────────────────────────────────────
  const session = sessionId
    ? (getSession(sessionId) ?? createSession(sessionId))
    : createSession()

  // ── Build history string for prompt injection ─────────────────────────────
  const history = session.getContext(historyTurns)

  // ── Follow-up detection: skip router, reuse last domain ───────────────────
  let pipelineOptions = {
    retrieve: retrieveOpts,
    answer:   { ...(answerOpts ?? {}), history },
    ...rest,
  }

  let result

  if (looksLikeFollowUp(query, session.lastDomain)) {
    // Run ask() but force the domain by passing it directly into retrieve
    // via a domain override.  We still call the full pipeline so routing,
    // retrieval, and answer generation all work normally — we just hint the
    // domain so re-routing isn't needed for obvious follow-ups.
    //
    // Implementation: pass a forceDomain option that pipeline.ask() picks up
    // via options.retrieve.  The retriever already accepts an explicit domain
    // on retrieve(query, domain) — so we pass it through via a thin shim.
    const forcedDomain = session.lastDomain
    const savedRetrieve = retrieveOpts ?? {}

    // Temporarily override: run the pipeline with a pre-resolved domain by
    // injecting a custom _forceDomain hint that ask() can read.
    result = await _askWithForcedDomain(query, forcedDomain, pipelineOptions)
  } else {
    result = await ask(query, pipelineOptions)
  }

  // ── Record turns ──────────────────────────────────────────────────────────
  session.addTurn({ role: 'user',      content: query })
  session.addTurn({
    role:    'assistant',
    content: result.answer,
    domain:  result.domain,
    stage:   result.stage,
  })

  return { ...result, sessionId: session.id }
}

/**
 * Internal helper: run the full pipeline but skip the router and use a
 * pre-resolved domain.  Used when a follow-up query shouldn't be re-routed.
 *
 * @param {string} query
 * @param {string} domain   — router label from the previous turn
 * @param {object} options  — same shape as ask() options
 * @returns {Promise<PipelineResult>}
 */
async function _askWithForcedDomain(query, domain, options = {}) {
  const pipelineStart = performance.now()
  const timing = { routeMs: 0, retrieveMs: 0, answerMs: 0, totalMs: 0 }

  // ── Retrieve ──────────────────────────────────────────────────────────────
  const retrieveStart = performance.now()
  const chunks = await retrieve(query, domain, options.retrieve)
  timing.retrieveMs = performance.now() - retrieveStart

  if (chunks.length === 0) {
    timing.totalMs = performance.now() - pipelineStart
    return {
      answer:     "I don't have that information",
      sources:    [],
      grounded:   false,
      domain,
      confidence: 'low',
      stage:      'no_context',
      timing,
    }
  }

  // ── Generate answer ───────────────────────────────────────────────────────
  const answerStart = performance.now()
  const { answer, sources, grounded } = await generateAnswer(
    query,
    chunks,
    options.answer,
  )
  timing.answerMs = performance.now() - answerStart
  timing.totalMs  = performance.now() - pipelineStart

  return {
    answer,
    sources,
    grounded,
    domain,
    confidence: 'low',   // confidence is 'low' because we skipped the router
    stage:      grounded ? 'answered' : 'ungrounded',
    timing,
  }
}

// ── Re-export session helpers so callers need only one import ─────────────────
export { createSession, getSession } from './session.js'

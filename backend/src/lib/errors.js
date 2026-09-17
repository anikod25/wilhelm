/**
 * errors.js — shared application error types
 *
 * All errors carry:
 *   message      — technical detail (safe to log, may contain provider info)
 *   userMessage  — plain-English string safe to show directly in the UI
 *   httpStatus   — suggested HTTP response status code
 *   cause        — original error, if any (for logging)
 *
 * Convention: the HTTP handler inspects err.constructor (or err.name) and
 * uses err.userMessage + err.httpStatus instead of err.message for the
 * client-facing response body.
 */

// ── Base ──────────────────────────────────────────────────────────────────────

export class WilhelmError extends Error {
  /**
   * @param {string}  message       — technical detail (logged server-side)
   * @param {string}  userMessage   — shown in the UI as-is
   * @param {number}  httpStatus    — HTTP status code for this error class
   * @param {Error}   [cause]       — original error
   */
  constructor(message, userMessage, httpStatus, cause) {
    super(message)
    this.name        = this.constructor.name
    this.userMessage = userMessage
    this.httpStatus  = httpStatus
    if (cause) this.cause = cause
  }
}

// ── Empty / invalid query ─────────────────────────────────────────────────────

export class EmptyQueryError extends WilhelmError {
  constructor() {
    super(
      'query is required',
      'Please type a message before sending.',
      400,
    )
  }
}

// ── LLM provider errors ───────────────────────────────────────────────────────

/**
 * Thrown when the LLM provider returns an error (auth, rate-limit, timeout,
 * malformed response, etc.).
 */
export class LLMError extends WilhelmError {
  /**
   * @param {string} detail    — technical detail from the provider SDK
   * @param {Error}  [cause]
   */
  constructor(detail, cause) {
    const userMessage = classifyLLMError(detail)
    super(`LLM error: ${detail}`, userMessage, 502, cause)
  }
}

/**
 * Map a raw provider error message/code to a user-safe string.
 * Keeps API keys, model names, and internal endpoints out of the UI.
 *
 * @param {string} detail
 * @returns {string}
 */
function classifyLLMError(detail) {
  const d = (detail ?? '').toLowerCase()

  if (d.includes('401') || d.includes('authentication') || d.includes('api key') ||
      d.includes('invalid_api_key') || d.includes('incorrect api key')) {
    return 'The AI service is not configured correctly. Please contact your administrator.'
  }
  if (d.includes('429') || d.includes('rate limit') || d.includes('quota') ||
      d.includes('too many requests')) {
    return 'The AI service is currently busy. Please wait a moment and try again.'
  }
  if (d.includes('503') || d.includes('overloaded') || d.includes('service unavailable')) {
    return 'The AI service is temporarily unavailable. Please try again shortly.'
  }
  if (d.includes('timeout') || d.includes('timed out') || d.includes('econnreset') ||
      d.includes('network') || d.includes('enotfound') || d.includes('econnrefused')) {
    return 'Could not reach the AI service. Check your connection and try again.'
  }
  if (d.includes('context') && d.includes('length') ||
      d.includes('token') && d.includes('limit') ||
      d.includes('maximum context')) {
    return 'Your question is too long for the AI to process. Please shorten it and try again.'
  }

  return 'The AI service returned an unexpected error. Please try again in a moment.'
}

// ── Vector store / embedding errors ──────────────────────────────────────────

/**
 * Thrown when the vector store or embedding provider is unreachable,
 * returns an error, or returns zero results for an in-scope query.
 */
export class VectorStoreError extends WilhelmError {
  /**
   * @param {'connection' | 'embedding' | 'query' | 'empty'} kind
   * @param {string} detail
   * @param {Error}  [cause]
   */
  constructor(kind, detail, cause) {
    const userMessage = classifyVectorStoreError(kind, detail)
    super(`VectorStore ${kind} error: ${detail}`, userMessage, 502, cause)
    this.kind = kind
  }
}

/**
 * @param {'connection'|'embedding'|'query'|'empty'} kind
 * @param {string} detail
 * @returns {string}
 */
function classifyVectorStoreError(kind, detail) {
  const d = (detail ?? '').toLowerCase()

  if (kind === 'empty') {
    return "The knowledge base doesn't appear to have any documents loaded yet. " +
           'Please ask your administrator to run the ingestion pipeline.'
  }

  if (d.includes('401') || d.includes('403') || d.includes('forbidden') ||
      d.includes('api key') || d.includes('unauthorized')) {
    return 'The knowledge base is not configured correctly. Please contact your administrator.'
  }
  if (d.includes('404') || d.includes('not found') || d.includes('does not exist') ||
      d.includes('index') && (d.includes('not') || d.includes('missing'))) {
    return "The knowledge base index hasn't been set up yet. " +
           'Please ask your administrator to create the vector index and run the ingestion pipeline.'
  }
  if (d.includes('timeout') || d.includes('econnrefused') || d.includes('enotfound') ||
      d.includes('network') || d.includes('unreachable') || d.includes('econnreset')) {
    return 'Could not reach the knowledge base. Check your connection and try again.'
  }
  if (d.includes('dimension') || d.includes('vector size') || d.includes('mismatch')) {
    return 'The knowledge base index dimensions do not match the embedding model. ' +
           'Please contact your administrator.'
  }

  return 'The knowledge base returned an unexpected error. Please try again in a moment.'
}

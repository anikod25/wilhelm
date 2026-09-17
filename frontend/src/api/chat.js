/**
 * chat.js — typed client for POST /api/chat
 *
 * Single export:
 *   sendChat(query, options?)  →  Promise<ChatResponse>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ChatResponse
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   answer:     string
 *   domain:     'hr' | 'support' | 'out_of_scope'
 *   confidence: 'high' | 'low'
 *   stage:      string
 *   grounded:   boolean
 *   sources:    Array<{ filename: string, filePath: string, heading: string, domain: string }>
 *   sessionId:  string
 *   timing:     { routeMs: number, retrieveMs: number, answerMs: number, totalMs: number }
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Error handling
 * ─────────────────────────────────────────────────────────────────────────────
 *   Network failures, non-2xx responses, and malformed JSON all throw a
 *   ChatApiError so callers only need one catch branch.
 *
 *   ChatApiError shape:
 *     message    — human-readable description
 *     status     — HTTP status code (0 for network errors)
 *     serverMsg  — the 'error' field from the response body, if present
 */

// ── Base URL ──────────────────────────────────────────────────────────────────
// In development Vite proxies /api → http://localhost:3001 (vite.config.js).
// In production set VITE_API_BASE_URL so requests go to the deployed backend.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// ── Error type ────────────────────────────────────────────────────────────────

export class ChatApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status     — HTTP status, or 0 for network-level failures
   * @param {string} [serverMsg]
   */
  constructor(message, status, serverMsg) {
    super(message)
    this.name      = 'ChatApiError'
    this.status    = status
    this.serverMsg = serverMsg ?? null
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Send a chat message to the backend pipeline.
 *
 * @param {string} query                   — the user's message text
 * @param {object} [options]
 * @param {string} [options.sessionId]     — session ID from a previous response;
 *                                           omit for the first turn in a conversation
 * @param {string} [options.format]        — response format: 'plain' | 'json' | 'xml' | 'xlsx' | 'email'
 *                                           (server default: 'plain')
 * @param {number} [options.historyTurns]  — how many prior turns to inject (server default: 6)
 * @param {AbortSignal} [options.signal]   — pass an AbortController signal to cancel in-flight requests
 * @returns {Promise<ChatResponse>}
 * @throws {ChatApiError}
 *
 * @example
 * // First turn
 * const r = await sendChat('How many sick days do I get?')
 * console.log(r.answer, r.sessionId)
 *
 * @example
 * // Follow-up turn, same session
 * const r2 = await sendChat('And annual leave?', { sessionId: r.sessionId })
 *
 * @example
 * // Cancellable request
 * const controller = new AbortController()
 * const promise = sendChat(query, { signal: controller.signal })
 * controller.abort()  // cancels the fetch
 */
export async function sendChat(query, options = {}) {
  const { sessionId, format, historyTurns, signal } = options

  const body = { query }
  if (sessionId)                       body.sessionId    = sessionId
  if (format && format !== 'plain')    body.format       = format
  if (historyTurns)                    body.historyTurns = historyTurns

  let response
  try {
    response = await fetch(`${BASE_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal,
    })
  } catch (err) {
    // Network error or abort
    if (err.name === 'AbortError') throw err   // re-throw AbortError as-is
    throw new ChatApiError(
      `Network error: ${err.message}`,
      0,
    )
  }

  // Parse body regardless of status so we can read server error messages
  let data
  try {
    data = await response.json()
  } catch {
    throw new ChatApiError(
      `Server returned non-JSON response (${response.status})`,
      response.status,
    )
  }

  if (!response.ok) {
    throw new ChatApiError(
      `Request failed with status ${response.status}`,
      response.status,
      data?.error,
    )
  }

  return data
}

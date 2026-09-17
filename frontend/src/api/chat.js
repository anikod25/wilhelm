/**
 * chat.js — typed client for POST /api/chat
 *
 * Single export:
 *   sendChat(query, options?)  →  Promise<ChatEnvelope>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ChatEnvelope  (normalised across all formats)
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   // Always present (from plain / json formats, or synthesised for others)
 *   answer:     string
 *   domain:     'hr' | 'support' | 'out_of_scope'
 *   confidence: 'high' | 'low'
 *   stage:      string
 *   grounded:   boolean
 *   sources:    Array<{ filename, filePath, heading, domain }>
 *   sessionId:  string
 *   timing:     { routeMs, retrieveMs, answerMs, totalMs }
 *
 *   // Format metadata
 *   format:           string   — the format that was requested
 *
 *   // Non-plain payloads (at most one will be set)
 *   formattedPayload: string | null   — pre-formatted text for json / xml / email
 *   downloadUrl:      string | null   — object URL for xlsx blob (caller must revoke)
 *   downloadName:     string | null   — suggested filename for the download
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Format behaviour
 * ─────────────────────────────────────────────────────────────────────────────
 *   plain  →  server returns normal JSON pipeline result; formattedPayload = null
 *   json   →  server returns application/json formatted object; payload stringified
 *   xml    →  server returns application/xml text;  stored in formattedPayload
 *   xlsx   →  server returns binary blob;           downloadUrl set (object URL)
 *   email  →  server returns text/plain email text; stored in formattedPayload
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Error handling
 * ─────────────────────────────────────────────────────────────────────────────
 *   Network failures, non-2xx responses, and malformed bodies all throw a
 *   ChatApiError so callers only need one catch branch.
 *
 *   ChatApiError shape:
 *     message    — human-readable description
 *     status     — HTTP status code (0 for network errors)
 *     serverMsg  — the 'error' field from the response body, if present
 */

// ── Base URL ──────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// ── Error type ────────────────────────────────────────────────────────────────

export class ChatApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [serverMsg]
   */
  constructor(message, status, serverMsg) {
    super(message)
    this.name      = 'ChatApiError'
    this.status    = status
    this.serverMsg = serverMsg ?? null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Broad content-type match (ignores charset / boundary params). */
function ctIs(contentType, type) {
  return (contentType ?? '').toLowerCase().includes(type)
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Send a chat message to the backend pipeline.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {string} [options.sessionId]
 * @param {string} [options.format]        — 'plain' | 'json' | 'xml' | 'xlsx' | 'email'
 * @param {number} [options.historyTurns]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<ChatEnvelope>}
 * @throws {ChatApiError}
 */
export async function sendChat(query, options = {}) {
  const { sessionId, format = 'plain', historyTurns, signal } = options

  const reqBody = { query }
  if (sessionId)             reqBody.sessionId    = sessionId
  if (format !== 'plain')    reqBody.format       = format
  if (historyTurns)          reqBody.historyTurns = historyTurns

  let response
  try {
    response = await fetch(`${BASE_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(reqBody),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ChatApiError(`Network error: ${err.message}`, 0)
  }

  if (!response.ok) {
    // Try to extract a server error message from JSON body
    let serverMsg
    try {
      const errData = await response.json()
      serverMsg = errData?.error
    } catch { /* ignore */ }
    throw new ChatApiError(
      `Request failed with status ${response.status}`,
      response.status,
      serverMsg,
    )
  }

  const ct = response.headers.get('content-type') ?? ''

  // ── xlsx: binary blob → object URL ───────────────────────────────────────
  if (ctIs(ct, 'spreadsheetml') || ctIs(ct, 'xlsx')) {
    const blob        = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    return {
      answer:           '',
      domain:           null,
      confidence:       null,
      stage:            null,
      grounded:         false,
      sources:          [],
      sessionId:        null,
      timing:           null,
      format:           'xlsx',
      formattedPayload: null,
      downloadUrl,
      downloadName:     'answer.xlsx',
    }
  }

  // ── xml: text payload ─────────────────────────────────────────────────────
  if (ctIs(ct, 'application/xml') || ctIs(ct, 'text/xml')) {
    const xml = await response.text()
    return {
      answer:           '',
      domain:           null,
      confidence:       null,
      stage:            null,
      grounded:         false,
      sources:          [],
      sessionId:        null,
      timing:           null,
      format:           'xml',
      formattedPayload: xml,
      downloadUrl:      null,
      downloadName:     null,
    }
  }

  // ── email: text/plain payload ─────────────────────────────────────────────
  if (ctIs(ct, 'text/plain')) {
    const text = await response.text()
    return {
      answer:           '',
      domain:           null,
      confidence:       null,
      stage:            null,
      grounded:         false,
      sources:          [],
      sessionId:        null,
      timing:           null,
      format:           'email',
      formattedPayload: text,
      downloadUrl:      null,
      downloadName:     null,
    }
  }

  // ── json / plain: normal JSON pipeline envelope ───────────────────────────
  let data
  try {
    data = await response.json()
  } catch {
    throw new ChatApiError(
      `Server returned non-JSON response (${response.status})`,
      response.status,
    )
  }

  // 'json' format: server returns a formatted JSON object (not the raw pipeline shape).
  // Stringify it for display and carry the plain-text answer through if present.
  const isFormattedJson = format === 'json'

  return {
    answer:           data.answer   ?? '',
    domain:           data.domain   ?? null,
    confidence:       data.confidence ?? null,
    stage:            data.stage    ?? null,
    grounded:         data.grounded ?? false,
    sources:          data.sources  ?? [],
    sessionId:        data.sessionId ?? null,
    timing:           data.timing   ?? null,
    format:           format ?? 'plain',
    formattedPayload: isFormattedJson
      ? JSON.stringify(data, null, 2)
      : null,
    downloadUrl:      null,
    downloadName:     null,
  }
}

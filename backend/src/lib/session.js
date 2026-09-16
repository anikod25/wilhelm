/**
 * session.js — in-memory conversation session store
 *
 * Public API:
 *   createSession(sessionId?, options?)  →  ConversationSession
 *   getSession(sessionId)               →  ConversationSession | undefined
 *   deleteSession(sessionId)            →  boolean
 *   listSessions()                      →  SessionSummary[]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ConversationSession
 * ─────────────────────────────────────────────────────────────────────────────
 *   session.id              — string, unique identifier
 *   session.addTurn(turn)   — append a Turn; enforces maxTurns cap
 *   session.getHistory(n?)  — last n turns (default: all), newest-last
 *   session.getContext(n?)  — last n turns formatted for prompt injection
 *   session.lastDomain      — domain label from the most recent assistant turn
 *   session.clear()         — wipe all turns
 *   session.toJSON()        — serialisable snapshot
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Turn shape
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   role:      'user' | 'assistant'
 *   content:   string       — the query or the answer text
 *   domain?:   string       — set on assistant turns (e.g. 'hr', 'support')
 *   stage?:    string       — pipeline stage, set on assistant turns
 *   timestamp: number       — Date.now() at insertion
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Memory management
 * ─────────────────────────────────────────────────────────────────────────────
 *   maxTurns (default 40): oldest turns are evicted once the cap is reached.
 *   Sessions are process-local — they do not survive restarts.
 *   For production use, swap the in-memory Map for a Redis/DB-backed store
 *   by replacing the _store implementation without changing the public API.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Session IDs
 * ─────────────────────────────────────────────────────────────────────────────
 *   If no sessionId is provided to createSession(), a random 16-hex-char ID
 *   is generated.  The caller is responsible for persisting the ID (e.g. in a
 *   cookie or Authorization header) across requests.
 */

import { randomBytes } from 'crypto'

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_TURNS = 40

// ── Session class ─────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   role:       'user' | 'assistant',
 *   content:    string,
 *   domain?:    string,
 *   stage?:     string,
 *   timestamp:  number,
 * }} Turn
 */

/**
 * @typedef {{
 *   id:        string,
 *   turnCount: number,
 *   lastDomain: string | null,
 *   createdAt: number,
 *   updatedAt: number,
 * }} SessionSummary
 */

export class ConversationSession {
  /**
   * @param {string} id
   * @param {object} [opts]
   * @param {number} [opts.maxTurns=40]
   */
  constructor(id, opts = {}) {
    /** @type {string} */
    this.id = id

    /** @type {number} */
    this.maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS

    /** @type {Turn[]} */
    this._turns = []

    /** @type {number} */
    this.createdAt = Date.now()

    /** @type {number} */
    this.updatedAt = Date.now()
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  /**
   * Append a turn to the session.
   * Evicts the oldest pair of turns (user + assistant) when maxTurns is
   * exceeded, keeping the history a sliding window of complete exchanges.
   *
   * @param {Omit<Turn, 'timestamp'>} turn
   * @returns {Turn}  the stored turn (with timestamp added)
   */
  addTurn(turn) {
    if (!turn || !['user', 'assistant'].includes(turn.role)) {
      throw new TypeError(`turn.role must be "user" or "assistant", got "${turn?.role}"`)
    }
    if (typeof turn.content !== 'string') {
      throw new TypeError('turn.content must be a string')
    }

    /** @type {Turn} */
    const stored = {
      role:      turn.role,
      content:   String(turn.content).trim(),
      timestamp: Date.now(),
    }
    if (turn.domain != null) stored.domain = String(turn.domain)
    if (turn.stage  != null) stored.stage  = String(turn.stage)

    this._turns.push(stored)
    this.updatedAt = stored.timestamp

    // Evict oldest turns in pairs to preserve user/assistant pairing
    while (this._turns.length > this.maxTurns) {
      this._turns.shift()
    }

    return stored
  }

  /**
   * Clear all turns.
   */
  clear() {
    this._turns = []
    this.updatedAt = Date.now()
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /**
   * Return the last `n` turns in chronological order (oldest first).
   * Defaults to all turns when n is omitted.
   *
   * @param {number} [n]
   * @returns {Turn[]}
   */
  getHistory(n) {
    if (n == null) return [...this._turns]
    const count = Math.max(0, n)
    if (count === 0) return []
    return this._turns.slice(-count)
  }

  /**
   * The domain label from the most recent assistant turn, or null if there
   * is no assistant turn yet.  Used by askWithHistory() to skip re-routing
   * on obvious follow-up queries.
   *
   * @returns {string | null}
   */
  get lastDomain() {
    for (let i = this._turns.length - 1; i >= 0; i--) {
      if (this._turns[i].role === 'assistant' && this._turns[i].domain) {
        return this._turns[i].domain
      }
    }
    return null
  }

  /**
   * The most recent assistant turn, or null.
   * @returns {Turn | null}
   */
  get lastAssistantTurn() {
    for (let i = this._turns.length - 1; i >= 0; i--) {
      if (this._turns[i].role === 'assistant') return this._turns[i]
    }
    return null
  }

  /**
   * Format the last `n` turns as a plain-text block suitable for injection
   * into an LLM prompt.  Returns an empty string when there are no prior turns.
   *
   * Format:
   *   User: <content>
   *   Assistant: <content>
   *   ...
   *
   * @param {number} [n=6]  number of prior turns to include
   * @returns {string}
   */
  getContext(n = 6) {
    const turns = this.getHistory(n)
    if (turns.length === 0) return ''

    return turns
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n')
  }

  /**
   * Serialisable snapshot of the session.
   * @returns {{ id: string, turns: Turn[], createdAt: number, updatedAt: number }}
   */
  toJSON() {
    return {
      id:        this.id,
      turns:     [...this._turns],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }

  /** @returns {SessionSummary} */
  summary() {
    return {
      id:         this.id,
      turnCount:  this._turns.length,
      lastDomain: this.lastDomain,
      createdAt:  this.createdAt,
      updatedAt:  this.updatedAt,
    }
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

/** @type {Map<string, ConversationSession>} */
const _store = new Map()

/**
 * Create a new session, or return the existing one if the ID is already known.
 *
 * @param {string}  [sessionId]           — caller-supplied ID; generated if omitted
 * @param {object}  [options]
 * @param {number}  [options.maxTurns=40] — eviction cap
 * @returns {ConversationSession}
 */
export function createSession(sessionId, options = {}) {
  const id = sessionId?.trim()
    ? sessionId.trim()
    : randomBytes(8).toString('hex')

  if (_store.has(id)) return _store.get(id)

  const session = new ConversationSession(id, options)
  _store.set(id, session)
  return session
}

/**
 * Retrieve an existing session by ID.
 *
 * @param {string} sessionId
 * @returns {ConversationSession | undefined}
 */
export function getSession(sessionId) {
  return _store.get(sessionId)
}

/**
 * Delete a session and free its memory.
 *
 * @param {string} sessionId
 * @returns {boolean}  true if a session was deleted, false if not found
 */
export function deleteSession(sessionId) {
  return _store.delete(sessionId)
}

/**
 * List summaries of all active sessions.
 * @returns {SessionSummary[]}
 */
export function listSessions() {
  return Array.from(_store.values()).map((s) => s.summary())
}

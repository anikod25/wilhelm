import { useState, useCallback, useRef } from 'react'
import { sendChat, ChatApiError } from '../api/chat.js'
import { DUMMY_MESSAGES } from '../data/dummyMessages.js'
import { useTrace } from './useTrace.js'

/**
 * Chat state wired to POST /api/chat.
 *
 * Returns:
 *   messages                   — Message[], oldest-first
 *   isLoading                  — true while a response is in-flight
 *   error                      — last error string, or null
 *   sendMessage(text, format)  — sends query + format, appends user turn, awaits assistant reply
 *   clearMessages              — wipe history back to the welcome message + reset session
 */
export function useChat() {
  const [messages,  setMessages]  = useState(DUMMY_MESSAGES)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState(null)

  const { traceStage, traceTimings, startTrace, finishTrace, errorTrace } = useTrace()

  const sessionIdRef = useRef(null)
  const abortRef     = useRef(null)

  const sendMessage = useCallback(async (text, format = 'plain') => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    // Cancel any previous in-flight request (defensive — shouldn't happen
    // because the input is disabled while loading, but belt-and-braces)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsg = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   trimmed,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    setError(null)
    startTrace()

    try {
      const data = await sendChat(trimmed, {
        sessionId: sessionIdRef.current ?? undefined,
        format,
        signal:    abortRef.current.signal,
      })

      // Persist session ID for subsequent turns
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId
      }

      /** @type {import('../data/dummyMessages.js').Message} */
      const assistantMsg = {
        id:               crypto.randomUUID(),
        role:             'assistant',
        content:          data.answer,
        domain:           data.domain,
        stage:            data.stage,
        grounded:         data.grounded ?? false,
        // Flat citation strings (kept for backward compat)
        sources:          (data.sources ?? []).map((s) =>
          typeof s === 'string'
            ? s
            : [s.domain, s.filename, s.heading].filter(Boolean).join(' › ')
        ),
        // Rich source metadata for the SourcePanel
        sourceDocs:       data.sourceDocs ?? [],
        // Format-specific rendering fields
        format:           data.format           ?? 'plain',
        formattedPayload: data.formattedPayload ?? null,
        downloadUrl:      data.downloadUrl      ?? null,
        downloadName:     data.downloadName     ?? null,
        timestamp:        Date.now(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      finishTrace(data.timing ?? null)
    } catch (err) {
      if (err.name === 'AbortError') return   // cancelled — don't update state

      // Map HTTP status codes to friendly messages the user can act on.
      // serverMsg comes from the backend's { error: '...' } JSON body.
      let msg
      if (err instanceof ChatApiError) {
        if (err.status === 0) {
          msg = 'Could not reach the server. Check your connection and try again.'
        } else if (err.status === 400) {
          // 400s are validation errors — the serverMsg is already user-safe
          msg = err.serverMsg ?? 'Invalid request. Please try rephrasing your question.'
        } else if (err.status === 401 || err.status === 403) {
          msg = 'Access denied. Please contact your administrator.'
        } else if (err.status === 429) {
          msg = 'Too many requests. Please wait a moment and try again.'
        } else if (err.status === 502 || err.status === 503) {
          // 502 is what the backend returns for LLM / vector-store errors —
          // the serverMsg is already the sanitised userMessage from errors.js
          msg = err.serverMsg ?? 'A backend service is temporarily unavailable. Please try again shortly.'
        } else if (err.status >= 500) {
          msg = err.serverMsg ?? 'Something went wrong on our end. Please try again in a moment.'
        } else {
          msg = err.serverMsg ?? err.message ?? 'Something went wrong. Please try again.'
        }
      } else {
        msg = err.message ?? 'Something went wrong. Please try again.'
      }

      setError(msg)
      errorTrace()
      setMessages((prev) => [
        ...prev,
        {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   `⚠️ ${msg}`,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [isLoading])

  const dismissError = useCallback(() => setError(null), [])

  const clearMessages = useCallback(() => {
    // Cancel any in-flight request before clearing
    abortRef.current?.abort()
    abortRef.current  = null
    sessionIdRef.current = null

    // Revoke any xlsx object URLs that were created so the browser can free memory
    setMessages((prev) => {
      prev.forEach((m) => { if (m.downloadUrl) URL.revokeObjectURL(m.downloadUrl) })
      return DUMMY_MESSAGES.slice(0, 1)   // keep welcome message only
    })

    setError(null)
    setIsLoading(false)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages, dismissError, traceStage, traceTimings }
}

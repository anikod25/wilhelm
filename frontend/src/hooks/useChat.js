import { useState, useCallback, useRef } from 'react'
import { sendChat, ChatApiError } from '../api/chat.js'
import { DUMMY_MESSAGES } from '../data/dummyMessages.js'

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

  // Persist session ID across turns without triggering re-renders
  const sessionIdRef = useRef(null)

  // Keep an AbortController per in-flight request so we can cancel on unmount
  // or when the user clears mid-request
  const abortRef = useRef(null)

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
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   data.answer,
        domain:    data.domain,
        stage:     data.stage,
        sources:   (data.sources ?? []).map((s) =>
          // sources from the pipeline are SourceRef objects; flatten to strings
          // matching the format MessageBubble expects
          typeof s === 'string'
            ? s
            : [s.domain, s.filename, s.heading].filter(Boolean).join(' › ')
        ),
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      if (err.name === 'AbortError') return   // cancelled — don't update state

      const msg = err instanceof ChatApiError && err.serverMsg
        ? err.serverMsg
        : (err.message ?? 'Something went wrong. Please try again.')

      setError(msg)

      // Still append an error bubble so the conversation flow is clear
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

  const clearMessages = useCallback(() => {
    // Cancel any in-flight request before clearing
    abortRef.current?.abort()
    abortRef.current  = null
    sessionIdRef.current = null
    setMessages(DUMMY_MESSAGES.slice(0, 1))   // keep welcome message only
    setError(null)
    setIsLoading(false)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages }
}

import { useState, useCallback } from 'react'
import { DUMMY_MESSAGES } from '../data/dummyMessages.js'

/**
 * Local chat state.
 *
 * Returns:
 *   messages       — array of Message objects, oldest-first
 *   isLoading      — true while a response is being "fetched" (simulated)
 *   sendMessage(text) — appends user turn + simulated assistant reply
 *   clearMessages  — wipe history back to the welcome message
 */
export function useChat() {
  const [messages, setMessages]   = useState(DUMMY_MESSAGES)
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   trimmed,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // ── Simulated async response ─────────────────────────────────────────────
    // Remove this block and replace with a real fetch() once the API is ready.
    setTimeout(() => {
      const assistantMsg = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   '(This is a placeholder response. Backend not yet connected.)',
        domain:    'hr',
        stage:     'answered',
        sources:   [],
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setIsLoading(false)
    }, 800)
  }, [isLoading])

  const clearMessages = useCallback(() => {
    setMessages(DUMMY_MESSAGES.slice(0, 1))  // keep welcome message
  }, [])

  return { messages, isLoading, sendMessage, clearMessages }
}

import { useState, useCallback, useRef } from 'react'
import { sendChat, ChatApiError } from '../api/chat.js'
import { DUMMY_MESSAGES } from '../data/dummyMessages.js'
import { useTrace } from './useTrace.js'

export function useChat() {
  const [messages, setMessages] = useState(DUMMY_MESSAGES)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const { traceStage, traceTimings, startTrace, finishTrace, errorTrace } = useTrace()
  const abortRef = useRef(null)
  const sessionIdRef = useRef(null)

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setMessages((previous) => [...previous, {
      id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: Date.now(),
    }])
    setIsLoading(true)
    setError(null)
    startTrace()

    try {
      const data = await sendChat(trimmed, {
        sessionId: sessionIdRef.current ?? undefined,
        signal: abortRef.current.signal,
      })
      if (data.sessionId) sessionIdRef.current = data.sessionId
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        patent: data.patent ?? null,
        sources: data.sources ?? [],
        stage: data.stage,
        timestamp: Date.now(),
      }])
      finishTrace(data.timing ?? null)
    } catch (err) {
      if (err.name === 'AbortError') return
      const msg = err instanceof ChatApiError
        ? err.serverMsg ?? 'Could not reach the tracker. Please try again.'
        : err.message ?? 'Something went wrong. Please try again.'
      setError(msg)
      errorTrace()
      setMessages((previous) => [...previous, {
        id: crypto.randomUUID(), role: 'assistant', content: msg, timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [isLoading, startTrace, finishTrace, errorTrace])

  const dismissError = useCallback(() => setError(null), [])
  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sessionIdRef.current = null
    setMessages(DUMMY_MESSAGES.slice())
    setError(null)
    setIsLoading(false)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages, dismissError, traceStage, traceTimings }
}

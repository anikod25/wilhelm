import { useState, useCallback, useRef } from 'react'

/**
 * Trace stage values (in order of pipeline execution).
 * 'idle'      — nothing in flight
 * 'routing'   — router LLM call running
 * 'retrieving'— embed + vector search running
 * 'grounding' — answer generation running
 * 'formatting'— format dispatcher running
 * 'done'      — pipeline complete
 * 'error'     — pipeline failed
 *
 * @typedef {'idle'|'routing'|'retrieving'|'grounding'|'formatting'|'done'|'error'} TraceStage
 */

// Approximate ms from request start when each stage becomes active.
// These are visual cues, not real measurements — the real timing is single-request.
const STAGE_DELAYS = {
  routing:    0,
  retrieving: 300,
  grounding:  700,
  formatting: 1500,
}

/**
 * Drives the trace panel animation as sendMessage progresses.
 *
 * Returns:
 *   traceStage   — current TraceStage
 *   traceTimings — { routeMs, retrieveMs, answerMs, totalMs } from the last response, or null
 *   startTrace() — call when a message send begins
 *   finishTrace(timing, format) — call when the response arrives (or null on error)
 *   errorTrace() — call when the request fails
 */
export function useTrace() {
  const [traceStage,   setTraceStage]   = useState(/** @type {TraceStage} */ ('idle'))
  const [traceTimings, setTraceTimings] = useState(null)
  const timersRef = useRef([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const startTrace = useCallback(() => {
    clearTimers()
    setTraceTimings(null)
    setTraceStage('routing')

    const stages = ['retrieving', 'grounding', 'formatting']
    stages.forEach((stage) => {
      const t = setTimeout(() => setTraceStage(stage), STAGE_DELAYS[stage])
      timersRef.current.push(t)
    })
  }, [])

  const finishTrace = useCallback((timing) => {
    clearTimers()
    setTraceStage('done')
    if (timing) setTraceTimings(timing)
    // Auto-reset to idle after a pause so the panel doesn't stay "done" forever
    const t = setTimeout(() => setTraceStage('idle'), 4000)
    timersRef.current.push(t)
  }, [])

  const errorTrace = useCallback(() => {
    clearTimers()
    setTraceStage('error')
    const t = setTimeout(() => setTraceStage('idle'), 3000)
    timersRef.current.push(t)
  }, [])

  return { traceStage, traceTimings, startTrace, finishTrace, errorTrace }
}

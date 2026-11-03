import { useState, useCallback, useRef } from 'react'

const STAGES = ['planning', 'retrieving', 'answering']
const DELAYS = [0, 350, 1000]

export function useTrace() {
  const [traceStage, setTraceStage] = useState('idle')
  const [traceTimings, setTraceTimings] = useState(null)
  const timersRef = useRef([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const startTrace = useCallback(() => {
    clearTimers()
    setTraceTimings(null)
    setTraceStage(STAGES[0])
    for (let index = 1; index < STAGES.length; index++) {
      timersRef.current.push(setTimeout(() => setTraceStage(STAGES[index]), DELAYS[index]))
    }
  }, [])

  const finishTrace = useCallback((timings) => {
    clearTimers()
    setTraceStage('done')
    setTraceTimings(timings)
    timersRef.current.push(setTimeout(() => setTraceStage('idle'), 4500))
  }, [])

  const errorTrace = useCallback(() => {
    clearTimers()
    setTraceStage('error')
    timersRef.current.push(setTimeout(() => setTraceStage('idle'), 3500))
  }, [])

  return { traceStage, traceTimings, startTrace, finishTrace, errorTrace }
}

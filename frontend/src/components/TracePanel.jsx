import styles from './TracePanel.module.css'

/**
 * Pipeline trace panel — shows Router → Retrieval → Grounding → Format
 * as a vertical node list that animates during a request.
 *
 * @param {{
 *   stage:   import('../hooks/useTrace.js').TraceStage,
 *   timings: { routeMs: number, retrieveMs: number, answerMs: number, totalMs: number } | null,
 * }} props
 */

const NODES = [
  {
    key:         'routing',
    doneKey:     'retrieving',
    label:       'Router',
    description: 'Domain classification',
    timingKey:   'routeMs',
  },
  {
    key:         'retrieving',
    doneKey:     'grounding',
    label:       'Retrieval',
    description: 'Vector search',
    timingKey:   'retrieveMs',
  },
  {
    key:         'grounding',
    doneKey:     'formatting',
    label:       'Grounding',
    description: 'Answer generation',
    timingKey:   'answerMs',
  },
  {
    key:         'formatting',
    doneKey:     'done',
    label:       'Format',
    description: 'Response dispatch',
    timingKey:   null,
  },
]

/** Stage order for comparison */
const STAGE_ORDER = ['idle', 'routing', 'retrieving', 'grounding', 'formatting', 'done', 'error']

function stageIndex(s) { return STAGE_ORDER.indexOf(s) }

/**
 * Node state relative to the current trace stage.
 * 'idle'   — not yet reached
 * 'active' — currently running
 * 'done'   — completed
 * 'error'  — failed
 */
function nodeState(nodeKey, doneKey, traceStage) {
  if (traceStage === 'error') return 'error'
  const currentIdx = stageIndex(traceStage)
  const activeIdx  = stageIndex(nodeKey)
  const doneIdx    = stageIndex(doneKey)
  if (currentIdx >= doneIdx)  return 'done'
  if (currentIdx === activeIdx) return 'active'
  return 'idle'
}

function NodeIcon({ state }) {
  if (state === 'done') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
        width="10" height="10" aria-hidden="true">
        <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd"/>
      </svg>
    )
  }
  if (state === 'error') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
        width="10" height="10" aria-hidden="true">
        <path fillRule="evenodd" d="M4.47 4.47a.75.75 0 011.06 0L8 6.94l2.47-2.47a.75.75 0 111.06 1.06L9.06 8l2.47 2.47a.75.75 0 11-1.06 1.06L8 9.06l-2.47 2.47a.75.75 0 01-1.06-1.06L6.94 8 4.47 5.53a.75.75 0 010-1.06z" clipRule="evenodd"/>
      </svg>
    )
  }
  if (state === 'active') {
    return <span className={styles.spinDot} aria-hidden="true" />
  }
  return null
}

export default function TracePanel({ stage, timings }) {
  const isLive = stage !== 'idle'

  return (
    <aside className={styles.panel} aria-label="Pipeline trace">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Trace</span>
        {isLive && stage !== 'done' && stage !== 'error' && (
          <span className={styles.liveChip} aria-live="polite">live</span>
        )}
        {stage === 'done' && (
          <span className={styles.doneChip}>done</span>
        )}
        {timings?.totalMs && (
          <span className={styles.totalTime}>{Math.round(timings.totalMs)}ms</span>
        )}
      </header>

      <div className={styles.nodes}>
        {NODES.map(({ key, doneKey, label, description, timingKey }, i) => {
          const state   = nodeState(key, doneKey, stage)
          const ms      = timingKey && timings ? timings[timingKey] : null

          return (
            <div key={key} className={styles.nodeWrapper}>
              {/* Connector line above (skip for first node) */}
              {i > 0 && (
                <div className={`${styles.connector} ${
                  state === 'done' || state === 'error' || stageIndex(stage) > stageIndex(key)
                    ? styles.connectorLit
                    : ''
                }`}>
                  <span className={`${styles.connectorPulse} ${
                    stageIndex(stage) === stageIndex(key) ? styles.connectorPulseActive : ''
                  }`} />
                </div>
              )}

              {/* Node row */}
              <div className={`${styles.node} ${styles[`node_${state}`]}`}>
                {/* Dot */}
                <div className={`${styles.dot} ${styles[`dot_${state}`]}`}>
                  <NodeIcon state={state} />
                </div>

                {/* Text */}
                <div className={styles.nodeText}>
                  <span className={styles.nodeLabel}>{label}</span>
                  <span className={styles.nodeDesc}>{description}</span>
                </div>

                {/* Timing */}
                {ms != null && (
                  <span className={styles.nodeTiming}>{Math.round(ms)}ms</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Idle hint */}
      {!isLive && (
        <p className={styles.idleHint}>Send a message to see the pipeline trace.</p>
      )}
    </aside>
  )
}

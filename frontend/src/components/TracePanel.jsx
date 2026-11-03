import styles from './TracePanel.module.css'

const NODES = [
  { key: 'planning', doneKey: 'retrieving', label: 'Understand question', description: 'Resolve intent and follow-up context', timingKey: 'planMs' },
  { key: 'retrieving', doneKey: 'answering', label: 'Check sources', description: 'Tracker record and patent documents', timingKey: 'retrieveMs' },
  { key: 'answering', doneKey: 'done', label: 'Prepare answer', description: 'Grounded conversational reply', timingKey: 'answerMs' },
]
const ORDER = ['idle', 'planning', 'retrieving', 'answering', 'done', 'error']
const stageIndex = (stage) => ORDER.indexOf(stage)

function nodeState(key, doneKey, stage) {
  if (stage === 'error') return 'error'
  const current = stageIndex(stage)
  if (current >= stageIndex(doneKey)) return 'done'
  if (current === stageIndex(key)) return 'active'
  return 'idle'
}

function NodeIcon({ state }) {
  if (state === 'done') return <span aria-hidden="true">✓</span>
  if (state === 'error') return <span aria-hidden="true">!</span>
  if (state === 'active') return <span className={styles.spinDot} aria-hidden="true" />
  return null
}

export default function TracePanel({ stage, timings }) {
  const isLive = stage !== 'idle'
  return (
    <aside className={styles.panel} aria-label="Assistant activity">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Assistant activity</span>
        {isLive && stage !== 'done' && stage !== 'error' && <span className={styles.liveChip}>working</span>}
        {stage === 'done' && <span className={styles.doneChip}>done</span>}
        {timings?.totalMs != null && <span className={styles.totalTime}>{timings.totalMs}ms</span>}
      </header>
      <div className={styles.nodes}>
        {NODES.map(({ key, doneKey, label, description, timingKey }, index) => {
          const state = nodeState(key, doneKey, stage)
          const timing = timingKey && timings ? timings[timingKey] : null
          return (
            <div className={styles.nodeWrapper} key={key}>
              {index > 0 && <div className={`${styles.connector} ${state === 'done' || state === 'error' ? styles.connectorLit : ''}`} />}
              <div className={`${styles.node} ${styles[`node_${state}`]}`}>
                <div className={`${styles.dot} ${styles[`dot_${state}`]}`}><NodeIcon state={state} /></div>
                <div className={styles.nodeText}>
                  <span className={styles.nodeLabel}>{label}</span>
                  <span className={styles.nodeDesc}>{description}</span>
                </div>
                {timing != null && <span className={styles.nodeTiming}>{timing}ms</span>}
              </div>
            </div>
          )
        })}
      </div>
      <p className={styles.idleHint}>Wilhelm can use tracker data and indexed patent documents in the same conversation.</p>
    </aside>
  )
}

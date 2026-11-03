import styles from './MessageBubble.module.css'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function PatentCard({ patent }) {
  if (!patent) return null
  const fields = [
    ['Patent office', patent.patent_office],
    ['Assignee', patent.assignee_name],
    ['Publication no.', patent.publication_number],
    ['Grant no.', patent.grant_number],
    ['Filing date', patent.filing_date && formatDate(patent.filing_date)],
    ['Publication date', patent.publication_date && formatDate(patent.publication_date)],
    ['Grant date', patent.grant_date && formatDate(patent.grant_date)],
    ['Reporting year', patent.reporting_year],
  ].filter(([, value]) => value)

  return (
    <section className={styles.patentCard} aria-label="Patent tracker record">
      <div className={styles.patentHeader}>
        <span className={styles.recordId}>{patent.application_number || `IP ID ${patent.id}`}</span>
        <span className={styles.status}>{patent.status || 'No status recorded'}</span>
      </div>
      {patent.title && <h3 className={styles.patentTitle}>{patent.title}</h3>}
      {fields.length > 0 && (
        <dl className={styles.patentFields}>
          {fields.map(([label, value]) => (
            <div className={styles.patentField} key={label}>
              <dt>{label}</dt><dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {patent.needs_review === true && <p className={styles.reviewFlag}>Flagged for review</p>}
      {patent.cleaning_notes && <p className={styles.recordNote}><strong>Tracker note:</strong> {patent.cleaning_notes}</p>}
    </section>
  )
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowAssistant}`}>
      {!isUser && <div className={styles.avatarAssistant} aria-hidden="true">W</div>}
      <div className={styles.body}>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`} role="article" aria-label={isUser ? `Your message: ${message.content}` : 'Wilhelm response'}>
          <p className={styles.content}>{message.content}</p>
          {!isUser && <PatentCard patent={message.patent} />}
          {!isUser && message.sources?.length > 0 && (
            <details className={styles.sources}>
              <summary>Patent documents used ({message.sources.length})</summary>
              <ul>
                {message.sources.map((source) => (
                  <li key={source.filePath}>
                    <span className={styles.sourceCitation}>[{source.citation}]</span>
                    <span>{source.filename}{source.heading ? ` · ${source.heading}` : ''}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className={`${styles.meta} ${isUser ? styles.metaUser : ''}`}>
          <time className={styles.time} dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
        </div>
      </div>
      {isUser && <div className={styles.avatarUser} aria-hidden="true">U</div>}
    </div>
  )
}

import styles from './MessageBubble.module.css'

const DOMAIN_LABELS = {
  hr:           'HR',
  support:      'IT Support',
  out_of_scope: 'Out of scope',
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Format-specific renderers ─────────────────────────────────────────────────

function CodeBlock({ code, language }) {
  const handleCopy = () => navigator.clipboard.writeText(code).catch(() => {})
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language.toUpperCase()}</span>
        <button type="button" className={styles.copyBtn} onClick={handleCopy}
          aria-label={`Copy ${language} to clipboard`}>Copy</button>
      </div>
      <pre className={styles.codePre}><code>{code}</code></pre>
    </div>
  )
}

function ExcelDownload({ downloadUrl, downloadName }) {
  return (
    <div className={styles.downloadWrapper}>
      <a href={downloadUrl} download={downloadName ?? 'answer.xlsx'}
        className={styles.downloadBtn} aria-label={`Download ${downloadName ?? 'answer.xlsx'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          width="15" height="15" aria-hidden="true" className={styles.downloadIcon}>
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
        Download Excel
      </a>
      <span className={styles.downloadHint}>{downloadName ?? 'answer.xlsx'}</span>
    </div>
  )
}

function EmailDraft({ text }) {
  const sep         = text.indexOf('\n\n')
  const subjectLine = sep !== -1 ? text.slice(0, sep)    : text
  const body        = sep !== -1 ? text.slice(sep + 2)   : ''
  const handleCopy  = () => navigator.clipboard.writeText(text).catch(() => {})
  return (
    <div className={styles.emailDraft} role="region" aria-label="Email draft">
      <div className={styles.emailHeader}>
        <span className={styles.emailLabel}>Email draft</span>
        <button type="button" className={styles.copyBtn} onClick={handleCopy}
          aria-label="Copy email draft to clipboard">Copy</button>
      </div>
      <div className={styles.emailSubject}>{subjectLine}</div>
      <pre className={styles.emailBody}>{body}</pre>
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const { format, formattedPayload, downloadUrl, downloadName } = message

  const isStructured = !isUser && (
    ((format === 'json' || format === 'xml') && formattedPayload) ||
    (format === 'xlsx' && downloadUrl) ||
    (format === 'email' && formattedPayload)
  )

  const renderContent = () => {
    if (!isUser) {
      if ((format === 'json' || format === 'xml') && formattedPayload)
        return <CodeBlock code={formattedPayload} language={format} />
      if (format === 'xlsx' && downloadUrl)
        return <ExcelDownload downloadUrl={downloadUrl} downloadName={downloadName} />
      if (format === 'email' && formattedPayload)
        return <EmailDraft text={formattedPayload} />
    }
    return <p className={styles.content}>{message.content}</p>
  }

  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowAssistant}`}>

      {/* Avatar — assistant left, user right */}
      {!isUser && (
        <div className={styles.avatarAssistant} aria-hidden="true">W</div>
      )}

      <div className={styles.body}>
        {/* Bubble */}
        <div className={`
          ${styles.bubble}
          ${isUser ? styles.bubbleUser : styles.bubbleAssistant}
          ${isStructured ? styles.bubbleRaw : ''}
        `}
          role="article"
          aria-label={isUser ? `Your message: ${message.content}` : 'Wilhelm response'}
        >
          {renderContent()}
        </div>

        {/* Sources (assistant, plain/json) */}
        {!isUser && message.sources?.length > 0 &&
          (!format || format === 'plain' || format === 'json') && (
          <ul className={styles.sources} aria-label="Sources">
            {message.sources.map((src, i) => (
              <li key={i} className={styles.source}>{src}</li>
            ))}
          </ul>
        )}

        {/* Meta: badge + timestamp */}
        <div className={`${styles.meta} ${isUser ? styles.metaUser : ''}`}>
          {!isUser && message.domain && DOMAIN_LABELS[message.domain] && (
            <span className={`${styles.badge} ${styles[`badge_${message.domain}`]}`}
              aria-label={`Domain: ${DOMAIN_LABELS[message.domain]}`}>
              {DOMAIN_LABELS[message.domain]}
            </span>
          )}
          <time className={styles.time} dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
        </div>
      </div>

      {isUser && (
        <div className={styles.avatarUser} aria-hidden="true">U</div>
      )}
    </div>
  )
}

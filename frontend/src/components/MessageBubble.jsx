import styles from './MessageBubble.module.css'

const DOMAIN_LABELS = {
  hr:           'HR',
  support:      'IT Support',
  out_of_scope: 'Out of scope',
}

/** Format a Unix timestamp as HH:MM */
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Single chat message bubble.
 *
 * @param {{ message: import('../data/dummyMessages.js').Message }} props
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.userWrapper : styles.assistantWrapper}`}>
      {/* Avatar */}
      <div
        className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.assistantAvatar}`}
        aria-hidden="true"
      >
        {isUser ? 'U' : 'W'}
      </div>

      <div className={styles.body}>
        {/* Bubble */}
        <div
          className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}
          role="article"
          aria-label={`${isUser ? 'Your message' : 'Wilhelm'}: ${message.content}`}
        >
          <p className={styles.content}>{message.content}</p>
        </div>

        {/* Sources (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <ul className={styles.sources} aria-label="Sources">
            {message.sources.map((src, i) => (
              <li key={i} className={styles.source}>
                {src}
              </li>
            ))}
          </ul>
        )}

        {/* Meta row: domain badge + timestamp */}
        <div className={`${styles.meta} ${isUser ? styles.metaUser : ''}`}>
          {!isUser && message.domain && DOMAIN_LABELS[message.domain] && (
            <span
              className={`${styles.badge} ${styles[`badge_${message.domain}`]}`}
              aria-label={`Domain: ${DOMAIN_LABELS[message.domain]}`}
            >
              {DOMAIN_LABELS[message.domain]}
            </span>
          )}
          <time
            className={styles.time}
            dateTime={new Date(message.timestamp).toISOString()}
          >
            {formatTime(message.timestamp)}
          </time>
        </div>
      </div>
    </div>
  )
}

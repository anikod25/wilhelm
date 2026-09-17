import styles from './EmptyState.module.css'

/** @type {{ label: string; query: string; icon: string }[]} */
const EXAMPLES = [
  {
    icon:  '🏖️',
    label: 'Annual leave',
    query: 'How many days of annual leave am I entitled to?',
  },
  {
    icon:  '🔒',
    label: 'Password reset',
    query: 'How do I reset my password if I\'m locked out?',
  },
  {
    icon:  '🏠',
    label: 'Remote work',
    query: 'What is the remote work policy?',
  },
  {
    icon:  '💻',
    label: 'New laptop',
    query: 'How do I request new hardware or a replacement laptop?',
  },
]

/**
 * Shown in place of the message list when the conversation is fresh.
 *
 * @param {{ onExampleClick: (query: string) => void }} props
 */
export default function EmptyState({ onExampleClick }) {
  return (
    <div className={styles.root}>
      {/* Hero mark */}
      <div className={styles.logoMark} aria-hidden="true">W</div>

      {/* Headline */}
      <h2 className={styles.heading}>How can I help you today?</h2>
      <p className={styles.sub}>
        Ask me anything about <strong>HR policies</strong> or{' '}
        <strong>IT support</strong> — I'll find the answer from our internal
        knowledge base.
      </p>

      {/* Example chips */}
      <ul className={styles.chips} aria-label="Example questions">
        {EXAMPLES.map(({ icon, label, query }) => (
          <li key={label}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => onExampleClick(query)}
              aria-label={`Ask: ${query}`}
            >
              <span className={styles.chipIcon} aria-hidden="true">{icon}</span>
              <span className={styles.chipText}>
                <span className={styles.chipLabel}>{label}</span>
                <span className={styles.chipQuery}>{query}</span>
              </span>
              <svg
                className={styles.chipArrow}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

import styles from './EmptyState.module.css'

const EXAMPLES = [
  'How many days of annual leave am I entitled to?',
  'How do I reset my VPN if it stops connecting?',
]

export default function EmptyState({ onExampleClick }) {
  return (
    <div className={styles.root}>
      <h2 className={styles.heading}>Ask Wilhelm anything</h2>

      <p className={styles.sub}>
        HR policy or IT support — grounded answers,
        <br />
        reformatted on demand.
      </p>

      <ul className={styles.chips} aria-label="Example questions">
        {EXAMPLES.map((query) => (
          <li key={query}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => onExampleClick(query)}
              aria-label={`Ask: ${query}`}
            >
              {query}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

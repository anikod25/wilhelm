import styles from './EmptyState.module.css'

export default function EmptyState() {
  return (
    <div className={styles.root}>
      <div className={styles.icon} aria-hidden="true">IP</div>
      <p className={styles.eyebrow}>Patent portfolio</p>
      <h2 className={styles.heading}>Ask Wilhelm about your IP</h2>
      <p className={styles.sub}>
        Check tracker status, ask about a filing, or follow up naturally. Wilhelm can use the patent record and indexed documents to help.
      </p>
      <div className={styles.examples}>
        <p>Try a question like:</p>
        <ul>
          <li>“What is the status of application number …?”</li>
          <li>“Explain the latest office action for this application.”</li>
        </ul>
      </div>
    </div>
  )
}

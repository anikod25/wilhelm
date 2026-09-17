import { useState } from 'react'
import styles from './SourcePanel.module.css'

// ── Domain display config ─────────────────────────────────────────────────────

const DOMAIN_META = {
  'hr-policies': { label: 'HR Policies',  short: 'HR',  colorClass: 'domainHr'      },
  'hr':          { label: 'HR Policies',  short: 'HR',  colorClass: 'domainHr'      },
  'it-support':  { label: 'IT Support',   short: 'IT',  colorClass: 'domainIt'      },
  'support':     { label: 'IT Support',   short: 'IT',  colorClass: 'domainIt'      },
}

function domainMeta(domain) {
  return DOMAIN_META[domain] ?? { label: domain, short: domain?.slice(0,2).toUpperCase() ?? '?', colorClass: 'domainOther' }
}

/** Strip leading numeric prefixes like "01-" from filenames for display. */
function friendlyFilename(filename) {
  return filename
    .replace(/^\d+-/, '')           // strip "01-"
    .replace(/\.(md|txt|pdf)$/i, '') // strip extension
    .replace(/-/g, ' ')              // dashes → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // title-case
}

// ── Document icon ─────────────────────────────────────────────────────────────

function DocIcon({ colorClass }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      width="13"
      height="13"
      aria-hidden="true"
      className={`${styles.docIcon} ${styles[colorClass]}`}
    >
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── SourcePanel ───────────────────────────────────────────────────────────────

/**
 * Expandable source-document panel shown below an assistant answer.
 *
 * @param {{
 *   sourceDocs: Array<{ filename: string, filePath: string, heading: string, domain: string }>,
 *   grounded:   boolean,
 * }} props
 */
export default function SourcePanel({ sourceDocs, grounded }) {
  const [open, setOpen] = useState(false)

  if (!sourceDocs || sourceDocs.length === 0) return null

  // Deduplicate by filePath + heading
  const seen = new Set()
  const docs = sourceDocs.filter(({ filePath, heading }) => {
    const key = `${filePath}::${heading}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const count = docs.length

  return (
    <div className={styles.panel}>
      {/* ── Toggle button ── */}
      <button
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="source-panel-list"
      >
        {/* Grounding indicator dot */}
        <span
          className={`${styles.groundDot} ${grounded ? styles.groundDotGrounded : styles.groundDotUngrounded}`}
          title={grounded ? 'Answer grounded in retrieved documents' : 'Low grounding confidence'}
          aria-label={grounded ? 'Grounded' : 'Ungrounded'}
        />

        {/* Book icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          width="13" height="13" aria-hidden="true" className={styles.bookIcon}>
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
        </svg>

        <span className={styles.toggleLabel}>
          {count} source{count !== 1 ? 's' : ''} retrieved
        </span>

        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          width="13"
          height="13"
          aria-hidden="true"
          className={styles.chevron}
        >
          <path fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"/>
        </svg>
      </button>

      {/* ── Expanded doc list ── */}
      {open && (
        <ul
          id="source-panel-list"
          className={styles.list}
          aria-label="Retrieved source documents"
        >
          {docs.map(({ filename, filePath, heading, domain }, i) => {
            const meta = domainMeta(domain)
            return (
              <li key={i} className={styles.docCard}>
                <DocIcon colorClass={meta.colorClass} />
                <div className={styles.docInfo}>
                  <span className={styles.docName}>
                    {friendlyFilename(filename)}
                  </span>
                  {heading && (
                    <span className={styles.docHeading}>{heading}</span>
                  )}
                </div>
                <span className={`${styles.domainBadge} ${styles[meta.colorClass]}`}>
                  {meta.short}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

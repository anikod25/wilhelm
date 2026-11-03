import MessageList from './MessageList.jsx'
import ChatInput from './ChatInput.jsx'
import TracePanel from './TracePanel.jsx'
import styles from './ChatShell.module.css'

export default function ChatShell({
  messages, isLoading, error, onSend, onClear, onDismissError,
  traceStage, traceTimings,
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoMark} aria-hidden="true">W</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Wilhelm</span>
            <span className={styles.brandTagline}>IP Tracker &amp; Patent Documents</span>
          </div>
        </div>
        <hr className={styles.divider} />
        <p className={styles.navLabel}>Workspace</p>
        <nav className={styles.nav} aria-label="Workspace">
          <div className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.5a2 2 0 00-.586-1.414l-2.5-2.5A2 2 0 0011.5 3H4zm3 4h6v2H7V7zm0 4h6v2H7v-2z" />
            </svg>
            Tracker + documents
          </div>
        </nav>
        <div className={styles.sidebarSpacer} />
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.clearBtn} onClick={onClear} aria-label="Clear conversation">
            Clear conversation
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileLogoMark} aria-hidden="true">W</div>
            <span className={styles.mobileBrandName}>Wilhelm · IP Assistant</span>
          </div>
          <button type="button" className={styles.mobileClearBtn} onClick={onClear} aria-label="Clear conversation">Clear</button>
        </header>
        <div className={styles.messageArea}>
          <MessageList messages={messages} isLoading={isLoading} />
        </div>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorText}>{error}</span>
            <button type="button" className={styles.errorDismiss} onClick={onDismissError} aria-label="Dismiss error">×</button>
          </div>
        )}
        <div className={styles.inputArea}>
          <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>
      </div>

      <TracePanel stage={traceStage} timings={traceTimings} />
    </div>
  )
}

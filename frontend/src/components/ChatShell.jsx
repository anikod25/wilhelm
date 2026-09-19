import MessageList from './MessageList.jsx'
import ChatInput   from './ChatInput.jsx'
import TracePanel  from './TracePanel.jsx'
import styles      from './ChatShell.module.css'

/**
 * Top-level chat layout shell.
 *
 * Desktop (md+):  sidebar | chat column | trace panel
 * Mobile:         sticky top bar + chat column
 *
 * @param {{
 *   messages:        import('../data/dummyMessages.js').Message[],
 *   isLoading:       boolean,
 *   error:           string | null,
 *   onSend:          (text: string, format: string) => void,
 *   onClear:         () => void,
 *   onDismissError:  () => void,
 *   traceStage:      import('../hooks/useTrace.js').TraceStage,
 *   traceTimings:    object | null,
 * }} props
 */
export default function ChatShell({
  messages, isLoading, error,
  onSend, onClear, onDismissError,
  traceStage, traceTimings,
}) {
  return (
    <div className={styles.shell}>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoMark} aria-hidden="true">W</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Wilhelm</span>
            <span className={styles.brandTagline}>Unified Enterprise AI Agent</span>
          </div>
        </div>

        <hr className={styles.divider} />

        <p className={styles.navLabel}>Departments</p>
        <nav className={styles.nav} aria-label="Topic shortcuts">
          {/* Active — HR Policies */}
          <a href="#" className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM2 14a5 5 0 0110 0v1H2v-1zm14-1a5 5 0 00-4.9 4H18v-1a5 5 0 00-2-4z"/></svg>
            HR Policies
          </a>
          {/* Active — IT Support */}
          <a href="#" className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1a1 1 0 000 2h6a1 1 0 100-2H5zm0 4a1 1 0 000 2h6a1 1 0 100-2H5z" clipRule="evenodd"/></svg>
            IT Support
          </a>
          {/* Locked — Finance */}
          <span className={`${styles.navItem} ${styles.navItemLocked}`} aria-label="Finance — not available">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>
            Finance
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="11" height="11" aria-hidden="true" className={styles.lockIcon}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
          </span>
          {/* Locked — Legal */}
          <span className={`${styles.navItem} ${styles.navItemLocked}`} aria-label="Legal — not available">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 5.645V15h1a1 1 0 010 2H8a1 1 0 010-2h1V5.645L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Legal
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="11" height="11" aria-hidden="true" className={styles.lockIcon}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
          </span>
        </nav>

        <div className={styles.sidebarSpacer} />

        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.clearBtn} onClick={onClear} aria-label="Clear conversation">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
            Clear chat
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className={styles.main}>

        {/* Mobile top bar */}
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileLogoMark} aria-hidden="true">W</div>
            <span className={styles.mobileBrandName}>Wilhelm</span>
          </div>
          <button type="button" className={styles.mobileClearBtn} onClick={onClear} aria-label="Clear conversation">
            Clear
          </button>
        </header>

        {/* Messages */}
        <div className={styles.messageArea}>
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onExampleClick={(query) => onSend(query, 'plain')}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span aria-hidden="true">⚠️</span>
            <span className={styles.errorText}>{error}</span>
            <button type="button" className={styles.errorDismiss} onClick={onDismissError} aria-label="Dismiss error">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Trace panel ── */}
      <TracePanel stage={traceStage} timings={traceTimings} />

    </div>
  )
}

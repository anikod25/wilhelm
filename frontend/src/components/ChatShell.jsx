import MessageList from './MessageList.jsx'
import ChatInput   from './ChatInput.jsx'
import styles      from './ChatShell.module.css'

/**
 * Top-level chat layout shell.
 *
 * Desktop (md+):  left sidebar (brand + info) | right main column
 * Mobile:         sticky top header bar + main column
 *
 * @param {{
 *   messages:  import('../data/dummyMessages.js').Message[],
 *   isLoading: boolean,
 *   error:     string | null,
 *   onSend:    (text: string, format: string) => void,
 *   onClear:   () => void,
 * }} props
 */
export default function ChatShell({ messages, isLoading, error, onSend, onClear }) {
  return (
    <div className={styles.shell}>

      {/* ── Sidebar (desktop) / Top bar (mobile) ── */}
      <aside className={styles.sidebar}>
        {/* Brand mark */}
        <div className={styles.brand}>
          <div className={styles.logoMark} aria-hidden="true">W</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Wilhelm</span>
            <span className={styles.brandTagline}>Internal Knowledge Base</span>
          </div>
        </div>

        {/* Divider — desktop only */}
        <hr className={styles.divider} />

        {/* Nav section label */}
        <p className={styles.navLabel}>Topics</p>
        <nav className={styles.nav} aria-label="Topic shortcuts">
          <a href="#" className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8S2 14.418 2 10 5.582 2 10 2s8 3.582 8 8zm-8-3a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 012 0v3a1 1 0 11-2 0v-3z" clipRule="evenodd"/></svg>
            All topics
          </a>
          <a href="#" className={styles.navItem}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM2 14a5 5 0 0110 0v1H2v-1zm14-1a5 5 0 00-4.9 4H18v-1a5 5 0 00-2-4z"/></svg>
            HR Policies
          </a>
          <a href="#" className={styles.navItem}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1a1 1 0 000 2h6a1 1 0 100-2H5zm0 4a1 1 0 000 2h6a1 1 0 100-2H5z" clipRule="evenodd"/></svg>
            IT Support
          </a>
        </nav>

        {/* Spacer pushes footer down */}
        <div className={styles.sidebarSpacer} />

        {/* Sidebar footer */}
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear}
            aria-label="Clear conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
            Clear chat
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className={styles.main}>

        {/* Mobile-only top bar */}
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileLogoMark} aria-hidden="true">W</div>
            <span className={styles.mobileBrandName}>Wilhelm</span>
          </div>
          <button
            type="button"
            className={styles.mobileClearBtn}
            onClick={onClear}
            aria-label="Clear conversation"
          >
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
          </div>
        )}

        {/* Input */}
        <div className={styles.inputArea}>
          <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>
      </div>

    </div>
  )
}

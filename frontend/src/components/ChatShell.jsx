import MessageList from './MessageList.jsx'
import ChatInput from './ChatInput.jsx'
import styles from './ChatShell.module.css'

/**
 * Top-level chat layout shell.
 *
 * ┌────────────────────────────────┐
 * │  Header                        │
 * ├────────────────────────────────┤
 * │  MessageList (scrollable, flex)│
 * ├────────────────────────────────┤
 * │  Error banner (when error≠null)│
 * ├────────────────────────────────┤
 * │  ChatInput                     │
 * └────────────────────────────────┘
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
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <span className={styles.headerLogo} aria-hidden="true">W</span>
          <span className={styles.headerTitle}>Wilhelm</span>
          <span className={styles.headerSubtitle}>Internal Knowledge Base</span>
        </div>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          Clear
        </button>
      </header>

      {/* Message area */}
      <main className={styles.main}>
        <MessageList messages={messages} isLoading={isLoading} />
      </main>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">⚠️</span>
          <span className={styles.errorText}>{error}</span>
        </div>
      )}

      {/* Input bar */}
      <footer className={styles.footer}>
        <ChatInput onSend={onSend} isLoading={isLoading} />
      </footer>
    </div>
  )
}

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
 * │  ChatInput                     │
 * └────────────────────────────────┘
 *
 * @param {{
 *   messages:      import('../data/dummyMessages.js').Message[],
 *   isLoading:     boolean,
 *   onSend:        (text: string) => void,
 *   onClear:       () => void,
 * }} props
 */
export default function ChatShell({ messages, isLoading, onSend, onClear }) {
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

      {/* Input bar */}
      <footer className={styles.footer}>
        <ChatInput onSend={onSend} isLoading={isLoading} />
      </footer>
    </div>
  )
}

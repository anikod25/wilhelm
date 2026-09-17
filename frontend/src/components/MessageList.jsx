import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'
import EmptyState    from './EmptyState.jsx'
import styles        from './MessageList.module.css'

/**
 * Scrollable list of chat messages.
 * Auto-scrolls to the bottom when new messages arrive.
 * Shows EmptyState when no real conversation has started yet (≤ 1 message).
 *
 * @param {{
 *   messages:        import('../data/dummyMessages.js').Message[],
 *   isLoading:       boolean,
 *   onExampleClick:  (query: string) => void,
 * }} props
 */
export default function MessageList({ messages, isLoading, onExampleClick }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ≤ 1 message means only the welcome assistant turn is present — show the
  // empty state instead of a mostly-blank scroll area.
  const isEmpty = messages.length <= 1

  return (
    <div
      className={`${styles.list} ${isEmpty ? styles.listEmpty : ''}`}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      {isEmpty ? (
        <EmptyState onExampleClick={onExampleClick} />
      ) : (
        <>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className={styles.typingRow} aria-live="assertive" aria-label="Wilhelm is typing">
              <div className={styles.typingAvatar} aria-hidden="true">W</div>
              <div className={styles.typingBubble}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} aria-hidden="true" />
        </>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'
import styles from './MessageList.module.css'

/**
 * Scrollable list of chat messages.
 * Auto-scrolls to the bottom when new messages arrive.
 *
 * @param {{
 *   messages:  import('../data/dummyMessages.js').Message[],
 *   isLoading: boolean,
 * }} props
 */
export default function MessageList({ messages, isLoading }) {
  const bottomRef = useRef(null)

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className={styles.list} role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className={styles.typingWrapper} aria-live="assertive" aria-label="Wilhelm is typing">
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
    </div>
  )
}

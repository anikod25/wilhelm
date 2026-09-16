import { useState, useRef, useCallback } from 'react'
import styles from './ChatInput.module.css'

/**
 * Message input bar: auto-growing textarea + Send button.
 *
 * - Enter submits (Shift+Enter inserts a newline)
 * - Textarea grows up to MAX_ROWS lines then scrolls
 * - Send button disabled when input is empty or loading
 *
 * @param {{
 *   onSend:    (text: string) => void,
 *   isLoading: boolean,
 *   disabled?: boolean,
 * }} props
 */
export default function ChatInput({ onSend, isLoading, disabled = false }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || disabled) return
    onSend(trimmed)
    setText('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isLoading, disabled, onSend])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleChange = useCallback((e) => {
    setText(e.target.value)
    // Auto-grow: reset then set to scrollHeight
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [])

  const canSend = text.trim().length > 0 && !isLoading && !disabled

  return (
    <div className={styles.bar}>
      <label htmlFor="chat-input" className="visually-hidden">
        Type your message
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask about HR policies or IT support…"
        rows={1}
        disabled={disabled}
        aria-label="Message input"
        aria-describedby="send-hint"
      />
      <span id="send-hint" className="visually-hidden">
        Press Enter to send, Shift+Enter for a new line
      </span>
      <button
        type="button"
        className={styles.sendBtn}
        onClick={handleSubmit}
        disabled={!canSend}
        aria-label="Send message"
      >
        {isLoading ? (
          /* Spinner */
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          /* Arrow icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path d="M3.105 3.105a1 1 0 011.217-.217l12 6a1 1 0 010 1.784l-12 6a1 1 0 01-1.31-1.31L4.887 11H11a1 1 0 100-2H4.887L2.795 4.422a1 1 0 01.31-1.317z" />
          </svg>
        )}
      </button>
    </div>
  )
}

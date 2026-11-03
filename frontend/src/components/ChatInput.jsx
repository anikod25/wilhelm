import { useState, useRef, useCallback } from 'react'
import styles from './ChatInput.module.css'

export default function ChatInput({ onSend, isLoading, disabled = false }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, isLoading, disabled, onSend])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleChange = useCallback((event) => {
    setText(event.target.value)
    event.target.style.height = 'auto'
    event.target.style.height = `${event.target.scrollHeight}px`
  }, [])

  const canSend = text.trim().length > 0 && !isLoading && !disabled

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <label htmlFor="chat-input" className="visually-hidden">Ask about an IP tracker record</label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a patent or enter an application number…"
          rows={1}
          disabled={disabled}
          aria-label="Ask about an IP tracker record"
          aria-describedby="send-hint"
        />
        <span id="send-hint" className="visually-hidden">Press Enter to send, Shift+Enter for a new line</span>
        <button type="button" className={styles.sendBtn} onClick={handleSubmit} disabled={!canSend} aria-label="Look up record">
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : 'Look up'}
        </button>
      </div>
      <p className={styles.inputHint}>Ask a follow-up or question about a patent document at any time.</p>
    </div>
  )
}

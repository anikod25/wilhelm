import ChatShell from './components/ChatShell.jsx'
import { useChat } from './hooks/useChat.js'
import styles from './App.module.css'

export default function App() {
  const { messages, isLoading, error, sendMessage, clearMessages, dismissError } = useChat()

  return (
    <div className={styles.layout}>
      <ChatShell
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSend={sendMessage}
        onClear={clearMessages}
        onDismissError={dismissError}
      />
    </div>
  )
}

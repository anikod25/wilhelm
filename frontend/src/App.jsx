import ChatShell from './components/ChatShell.jsx'
import { useChat } from './hooks/useChat.js'
import styles from './App.module.css'

export default function App() {
  const { messages, isLoading, sendMessage, clearMessages } = useChat()

  return (
    <div className={styles.layout}>
      <ChatShell
        messages={messages}
        isLoading={isLoading}
        onSend={sendMessage}
        onClear={clearMessages}
      />
    </div>
  )
}

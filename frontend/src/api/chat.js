const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ChatApiError extends Error {
  constructor(message, status, serverMsg) {
    super(message)
    this.name = 'ChatApiError'
    this.status = status
    this.serverMsg = serverMsg ?? null
  }
}

export async function sendChat(query, { signal, sessionId } = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...(sessionId ? { sessionId } : {}) }),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ChatApiError(`Network error: ${error.message}`, 0)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ChatApiError('The server returned an invalid response.', response.status)
  }

  if (!response.ok) {
    throw new ChatApiError(`Request failed with status ${response.status}`, response.status, data?.error)
  }
  return data
}

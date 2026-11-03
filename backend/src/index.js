import 'dotenv/config'
import express from 'express'
import { askPatentAssistant, PatentLookupError } from './lib/patentChat.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json({ limit: '32kb' }))

function validateEnv() {
  const missing = []
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
  const llm = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase()
  const embedding = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase()
  const vectorStore = (process.env.VECTOR_STORE_PROVIDER ?? 'supabase').toLowerCase()
  if (llm === 'openai' && !process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY')
  if (llm === 'gemini' && !process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY')
  if (llm === 'local' && !process.env.LLM_BASE_URL) missing.push('LLM_BASE_URL')
  if (embedding === 'openai' && !process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY (for embeddings)')
  if (embedding === 'gemini' && !process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY (for embeddings)')
  if (embedding === 'local' && !process.env.EMBEDDING_BASE_URL && !process.env.LLM_BASE_URL) {
    missing.push('EMBEDDING_BASE_URL or LLM_BASE_URL')
  }
  if (vectorStore === 'supabase' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (for patent document vectors)')
  }
  if (missing.length) {
    console.warn(
      '\nWilhelm IP Tracker — missing environment variables:\n' +
      missing.map((value) => `  - ${value}`).join('\n') +
      '\nChat, tracker lookup, and document search may fail until these are set in backend/.env.\n'
    )
  }
}

validateEnv()

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', product: 'ip-tracker-chatbot' })
})

app.post('/api/chat', async (req, res) => {
  const { query, sessionId } = req.body ?? {}
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Please type a message before sending.' })
  }
  if (query.length > 2000) {
    return res.status(400).json({ error: 'Please keep your question under 2,000 characters.' })
  }

  try {
    const result = await askPatentAssistant(query.trim(), sessionId)
    return res.json({
      ...result,
      domain: 'ip-tracker',
      confidence: 'high',
    })
  } catch (error) {
    console.error('[/api/chat]', error)
    if (error instanceof PatentLookupError) {
      const status = error.code === 'INVALID_INPUT' ? 400
        : error.code === 'AMBIGUOUS' ? 409
          : error.code === 'CONFIG' ? 503 : 502
      const message = error.code === 'AMBIGUOUS'
        ? 'More than one tracker record matched that identifier. Please contact the tracker administrator.'
        : error.code === 'CONFIG'
          ? 'Patent lookup is not configured yet. Please contact the administrator.'
          : error.code === 'UPSTREAM'
            ? 'Could not retrieve the patent record from the tracker. Please try again shortly.'
            : 'Please provide a valid application number or IP ID.'
      return res.status(status).json({ error: message })
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

app.listen(PORT, () => {
  console.log(`Wilhelm IP Tracker backend running on http://localhost:${PORT}`)
})

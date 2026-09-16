import 'dotenv/config'
import express from 'express'
import { askWithHistory } from './lib/pipeline.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ── POST /api/chat ─────────────────────────────────────────────────────────────
//
// Request body:
//   { query: string, sessionId?: string, historyTurns?: number }
//
// Response (200):
//   {
//     answer:     string,
//     domain:     string,
//     confidence: string,
//     stage:      string,
//     grounded:   boolean,
//     sources:    Array<{ filename, filePath, heading, domain }>,
//     sessionId:  string,
//     timing:     { routeMs, retrieveMs, answerMs, totalMs },
//   }
//
// Error responses:
//   400  { error: 'query is required' }
//   500  { error: '<message>' }

app.post('/api/chat', async (req, res) => {
  const { query, sessionId, historyTurns } = req.body ?? {}

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }

  try {
    const result = await askWithHistory(query.trim(), {
      sessionId:    sessionId ?? undefined,
      historyTurns: historyTurns ?? undefined,
    })

    return res.json(result)
  } catch (err) {
    console.error('[/api/chat]', err)
    return res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

import 'dotenv/config'
import express from 'express'
import { askWithHistory } from './lib/pipeline.js'
import { dispatch }       from './lib/dispatcher.js'

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
//   {
//     query:         string,
//     sessionId?:    string,
//     historyTurns?: number,
//     format?:       'plain' | 'json' | 'xml' | 'xlsx' | 'email'  (default: 'plain')
//   }
//
// Response (200):
//   Format 'plain' (default) and 'json':
//     { answer, domain, confidence, stage, grounded, sources, sessionId, timing, … }
//   Format 'xml':
//     Content-Type: application/xml  — XML string body
//   Format 'xlsx':
//     Content-Type: application/vnd.openxmlformats…  — binary attachment
//   Format 'email':
//     Content-Type: text/plain  — formatted email text body
//
// Error responses:
//   400  { error: 'query is required' }
//   400  { error: 'Unsupported format …' }
//   500  { error: '<message>' }

app.post('/api/chat', async (req, res) => {
  const { query, sessionId, historyTurns, format = 'plain' } = req.body ?? {}

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }

  try {
    const result = await askWithHistory(query.trim(), {
      sessionId:    sessionId ?? undefined,
      historyTurns: historyTurns ?? undefined,
    })

    // 'plain' skips the dispatcher and returns the raw pipeline result as JSON
    // (same behaviour as before the format selector was added)
    if (!format || format === 'plain') {
      return res.json(result)
    }

    const { output, contentType } = await dispatch(format, result, { query: query.trim() })

    if (format === 'xlsx') {
      res.set({
        'Content-Type':        contentType,
        'Content-Disposition': 'attachment; filename="answer.xlsx"',
      })
      return res.send(output)
    }

    if (format === 'json') {
      return res.set('Content-Type', contentType).json(output)
    }

    // xml, email — string payloads
    return res.set('Content-Type', contentType).send(
      typeof output === 'object' ? JSON.stringify(output) : output
    )
  } catch (err) {
    // Return 400 for unsupported/invalid format names, 500 for everything else
    if (err.name === 'UnsupportedFormatError') {
      return res.status(400).json({ error: err.message })
    }
    console.error('[/api/chat]', err)
    return res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})

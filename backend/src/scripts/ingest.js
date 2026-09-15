/**
 * ingest.js
 *
 * Full ingestion pipeline:
 *   1. Chunk all seed documents using the shared chunker
 *   2. Embed each chunk via embedText() from the vectorstore adapter
 *   3. Upsert the embedded chunks via upsertVectors() from the vectorstore adapter
 *
 * The rest of the app should never call provider SDKs directly — this script
 * is no exception: it only ever calls the three adapter functions.
 *
 * Usage:
 *   node src/scripts/ingest.js [options]
 *
 * Options:
 *   --input <dir> [<dir>...]   Source directories (default: data/hr-policies data/it-support)
 *   --chunk-size  <n>          Target words per chunk         (default: 250)
 *   --overlap     <n>          Overlap words between chunks   (default: 40)
 *   --batch-size  <n>          Vectors upserted per API call  (default: 50)
 *   --concurrency <n>          Parallel embed requests        (default: 5)
 *   --filter      <domain>     Only ingest chunks from this domain
 *   --reset                    Delete & recreate the collection before ingesting
 *                              (Chroma only — Pinecone indexes must be reset in the console)
 *   --dry-run                  Chunk and log stats without embedding or upserting
 *   --verbose                  Print each chunk id as it is processed
 *
 * Environment variables (loaded from .env via dotenv):
 *   EMBEDDING_PROVIDER, EMBEDDING_MODEL, OPENAI_API_KEY, GEMINI_API_KEY, …
 *   VECTOR_STORE_PROVIDER, PINECONE_API_KEY, PINECONE_INDEX_NAME, CHROMA_URL, …
 *   (see backend/.env.example for the full list)
 */

import 'dotenv/config'
import { join, basename, resolve } from 'path'
import { collectFiles, chunkFile, DATA_ROOT } from '../lib/chunker.js'
import { embedText, upsertVectors } from '../lib/vectorstore.js'

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2)
  const cfg = {
    inputs: [],
    chunkSize: 250,
    overlap: 40,
    batchSize: 50,
    concurrency: 5,
    filter: null,
    reset: false,
    dryRun: false,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          cfg.inputs.push(resolve(args[++i]))
        }
        break
      case '--chunk-size':   cfg.chunkSize   = parseInt(args[++i], 10); break
      case '--overlap':      cfg.overlap      = parseInt(args[++i], 10); break
      case '--batch-size':   cfg.batchSize    = parseInt(args[++i], 10); break
      case '--concurrency':  cfg.concurrency  = parseInt(args[++i], 10); break
      case '--filter':       cfg.filter       = args[++i]; break
      case '--reset':        cfg.reset        = true; break
      case '--dry-run':      cfg.dryRun       = true; break
      case '--verbose':      cfg.verbose      = true; break
    }
  }

  if (cfg.inputs.length === 0) {
    cfg.inputs = [
      join(DATA_ROOT, 'hr-policies'),
      join(DATA_ROOT, 'it-support'),
    ]
  }

  return cfg
}

// ── Progress helpers ──────────────────────────────────────────────────────────

function progressBar(done, total, width = 30) {
  const pct = total === 0 ? 1 : done / total
  const filled = Math.round(pct * width)
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  return `[${bar}] ${done}/${total}`
}

function clearLine() {
  process.stdout.write('\r\x1b[K')
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

/**
 * Run an array of async tasks with a maximum concurrency.
 * Returns results in the same order as tasks, like Promise.all.
 *
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
async function pooled(tasks, limit) {
  const results = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      results[idx] = await tasks[idx]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

// ── Reset helper ──────────────────────────────────────────────────────────────

/**
 * Delete and recreate the Chroma collection.
 * Pinecone indexes cannot be recreated via SDK without knowing dimension/metric —
 * users must do that in the Pinecone console.
 */
async function maybeReset() {
  const provider = (process.env.VECTOR_STORE_PROVIDER ?? 'pinecone').toLowerCase()

  if (provider === 'chroma') {
    const { ChromaClient } = await import('chromadb')
    const client = new ChromaClient({
      path: process.env.CHROMA_URL ?? 'http://localhost:8000',
    })
    const name = process.env.CHROMA_COLLECTION ?? 'wilhelm'
    try {
      await client.deleteCollection({ name })
      console.log(`🗑  Deleted Chroma collection "${name}"`)
    } catch {
      // Collection may not exist yet — that's fine
    }
    await client.createCollection({ name })
    console.log(`✨ Created Chroma collection "${name}"`)
  } else {
    console.warn(
      '⚠️  --reset is only supported for Chroma. ' +
      'To reset a Pinecone index, delete and recreate it in the Pinecone console.'
    )
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cfg = parseArgs(process.argv)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Wilhelm — document ingestion pipeline')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Embedding provider : ${process.env.EMBEDDING_PROVIDER ?? 'openai'}`)
  console.log(`  Vector store       : ${process.env.VECTOR_STORE_PROVIDER ?? 'pinecone'}`)
  console.log(`  Input dirs         : ${cfg.inputs.map(d => basename(d)).join(', ')}`)
  console.log(`  Chunk size / overlap: ${cfg.chunkSize} / ${cfg.overlap} words`)
  console.log(`  Batch size         : ${cfg.batchSize}`)
  console.log(`  Concurrency        : ${cfg.concurrency}`)
  if (cfg.filter)  console.log(`  Domain filter      : ${cfg.filter}`)
  if (cfg.reset)   console.log(`  Reset              : yes`)
  if (cfg.dryRun)  console.log(`  Dry run            : yes (no embed/upsert)`)
  console.log()

  // ── 1. Collect and chunk ────────────────────────────────────────────────────

  const allChunks = []

  for (const inputDir of cfg.inputs) {
    const domain = basename(inputDir)

    if (cfg.filter && domain !== cfg.filter) {
      console.log(`⏭  Skipping ${domain} (filtered out)`)
      continue
    }

    const files = collectFiles(inputDir)
    if (files.length === 0) {
      console.warn(`⚠️  No files found in ${inputDir}`)
      continue
    }

    console.log(`📂 Chunking ${domain} (${files.length} files)…`)

    for (const filePath of files) {
      const chunks = chunkFile(filePath, {
        domain,
        chunkSize: cfg.chunkSize,
        overlap: cfg.overlap,
      })
      allChunks.push(...chunks)
      if (cfg.verbose) {
        console.log(`   ${basename(filePath)} → ${chunks.length} chunk(s)`)
      }
    }
  }

  const totalChunks = allChunks.length
  console.log(`\n📄 Total chunks to ingest: ${totalChunks}`)

  if (totalChunks === 0) {
    console.log('Nothing to ingest.')
    process.exit(0)
  }

  if (cfg.dryRun) {
    console.log('\n-- Dry run: first 3 chunks --')
    for (const c of allChunks.slice(0, 3)) {
      console.log(JSON.stringify(c, null, 2))
    }
    console.log(`\nDry run complete — ${totalChunks} chunks would be embedded and upserted.`)
    process.exit(0)
  }

  // ── 2. Optional reset ───────────────────────────────────────────────────────

  if (cfg.reset) {
    await maybeReset()
    console.log()
  }

  // ── 3. Embed (with concurrency pool) ───────────────────────────────────────

  console.log(`\n⚙  Embedding ${totalChunks} chunks (concurrency=${cfg.concurrency})…`)

  let embedded = 0
  let failed = 0
  const embeddedChunks = new Array(totalChunks)

  const embedTasks = allChunks.map((chunk, idx) => async () => {
    try {
      const vector = await embedText(chunk.text)
      embeddedChunks[idx] = { ...chunk, embedding: vector }
    } catch (err) {
      console.error(`\n  ✗ Failed to embed chunk ${chunk.id}: ${err.message}`)
      embeddedChunks[idx] = null
      failed++
    } finally {
      embedded++
      clearLine()
      process.stdout.write(`  ${progressBar(embedded, totalChunks)}  ${chunk.id}`)
    }
  })

  const startEmbed = Date.now()
  await pooled(embedTasks, cfg.concurrency)
  clearLine()

  const successfulChunks = embeddedChunks.filter(Boolean)
  const embedSecs = ((Date.now() - startEmbed) / 1000).toFixed(1)
  console.log(
    `  ✅ Embedded ${successfulChunks.length}/${totalChunks} chunks in ${embedSecs}s` +
    (failed > 0 ? `  (${failed} failed — check logs above)` : '')
  )

  if (successfulChunks.length === 0) {
    console.error('\nNo chunks were successfully embedded. Aborting upsert.')
    process.exit(1)
  }

  // ── 4. Upsert in batches ────────────────────────────────────────────────────

  console.log(`\n⬆  Upserting ${successfulChunks.length} vectors (batch=${cfg.batchSize})…`)

  const batches = []
  for (let i = 0; i < successfulChunks.length; i += cfg.batchSize) {
    batches.push(successfulChunks.slice(i, i + cfg.batchSize))
  }

  let upserted = 0
  const startUpsert = Date.now()

  for (const batch of batches) {
    await upsertVectors(
      batch.map(({ id, embedding, text, metadata }) => ({
        id,
        embedding,
        text,
        metadata,
      }))
    )
    upserted += batch.length
    clearLine()
    process.stdout.write(`  ${progressBar(upserted, successfulChunks.length)}`)
  }

  clearLine()
  const upsertSecs = ((Date.now() - startUpsert) / 1000).toFixed(1)
  console.log(`  ✅ Upserted ${upserted} vectors in ${upsertSecs}s`)

  // ── 5. Summary ──────────────────────────────────────────────────────────────

  const totalSecs = (
    (Date.now() - (startEmbed)) / 1000
  ).toFixed(1)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Ingestion complete`)
  console.log(`  Chunks embedded  : ${successfulChunks.length}`)
  console.log(`  Chunks upserted  : ${upserted}`)
  if (failed > 0) console.log(`  Embed failures   : ${failed}`)
  console.log(`  Total time       : ${totalSecs}s`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((err) => {
  console.error('\n❌ Ingestion failed:', err.message)
  if (process.env.NODE_ENV !== 'production') console.error(err.stack)
  process.exit(1)
})

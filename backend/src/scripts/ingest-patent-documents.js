import 'dotenv/config'
import { readFileSync } from 'fs'
import { basename, dirname, extname, relative, resolve } from 'path'
import { PDFParse } from 'pdf-parse'
import { cleanMarkdown, collectFiles, DATA_ROOT, splitIntoChunks } from '../lib/chunker.js'
import { cleanupStalePatentChunks, embedText, upsertVectors } from '../lib/vectorstore.js'

const SUPPORTED_EXTENSIONS = ['.pdf', '.md', '.txt']

function parseArgs(argv) {
  const args = argv.slice(2)
  const config = {
    input: resolve(DATA_ROOT, 'patent-documents'),
    chunkSize: 250,
    overlap: 40,
    batchSize: 40,
    dryRun: false,
    applicationNumber: null,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input': config.input = resolve(args[++i]); break
      case '--chunk-size': config.chunkSize = Number.parseInt(args[++i], 10); break
      case '--overlap': config.overlap = Number.parseInt(args[++i], 10); break
      case '--batch-size': config.batchSize = Number.parseInt(args[++i], 10); break
      case '--application-number': config.applicationNumber = args[++i]; break
      case '--dry-run': config.dryRun = true; break
      case '--help': config.help = true; break
    }
  }

  if (!Number.isInteger(config.chunkSize) || config.chunkSize < 50) {
    throw new Error('--chunk-size must be an integer of at least 50 words')
  }
  if (!Number.isInteger(config.overlap) || config.overlap < 0 || config.overlap >= config.chunkSize) {
    throw new Error('--overlap must be non-negative and smaller than --chunk-size')
  }
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1) {
    throw new Error('--batch-size must be a positive integer')
  }
  return config
}

async function readDocument(filePath) {
  if (extname(filePath).toLowerCase() !== '.pdf') return readFileSync(filePath, 'utf8')

  const parser = new PDFParse({ data: readFileSync(filePath) })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } finally {
    await parser.destroy()
  }
}

function getApplicationNumber(filePath, inputDir, override) {
  if (override) return override.trim()
  const relativePath = relative(inputDir, filePath).replace(/\\/g, '/')
  const segments = relativePath.split('/')
  if (segments.length < 2) return null
  if (segments[0].toLowerCase() === 'applications') return segments.length > 2 ? segments[1] : null
  if (['general', 'forms', 'notices', 'process', 'processes', 'procedures', 'guides', 'reference', 'templates']
    .includes(segments[0].toLowerCase())) return null
  // Keep the existing <application-number>/<file> layout supported.
  return segments[0]
}

function getDocumentType(filename, relativePath = '') {
  const value = `${relativePath} ${filename}`.toLowerCase().replace(/[_-]+/g, ' ')
  const known = [
    ['office action', 'office_action'],
    ['office-action', 'office_action'],
    ['notice', 'notice'],
    ['response', 'response'],
    ['amendment', 'amendment'],
    ['checklist', 'checklist'],
    ['procedure', 'procedure'],
    ['process', 'procedure'],
    ['guide', 'guide'],
    ['form', 'form'],
    ['fee schedule', 'fee_schedule'],
    ['application', 'application'],
    ['filing', 'filing'],
    ['claims', 'claims'],
    ['specification', 'specification'],
    ['grant', 'grant'],
    ['publication', 'publication'],
    ['prior art', 'prior_art'],
  ]
  return known.find(([phrase]) => value.includes(phrase))?.[1] ?? 'patent_document'
}

async function buildChunks(filePath, config) {
  const rawText = await readDocument(filePath)
  const cleaned = cleanMarkdown(rawText)
  if (!cleaned) {
    console.warn(`Skipping ${basename(filePath)}: no extractable text (scanned PDFs need OCR).`)
    return []
  }

  const rawChunks = splitIntoChunks(cleaned, rawText, config.chunkSize, config.overlap)
  const relativePath = relative(DATA_ROOT, filePath).replace(/\\/g, '/')
  const sourceId = relative(config.input, filePath).replace(/\\/g, '/')
  const filename = basename(filePath, extname(filePath))
  const applicationNumber = getApplicationNumber(filePath, config.input, config.applicationNumber)
  const documentType = getDocumentType(filename, relativePath)
  const totalChunks = rawChunks.length

  return rawChunks.map((chunk, index) => ({
    id: `patents/${sourceId}/${index}`,
    text: chunk.text,
    metadata: {
      domain: 'patents',
      source_id: sourceId,
      filename: basename(filePath),
      filePath: relativePath,
      document_type: documentType,
      application_number: applicationNumber,
      chunkIndex: index,
      totalChunks,
      heading: chunk.heading,
      wordCount: chunk.wordCount,
    },
  }))
}

async function main() {
  const config = parseArgs(process.argv)
  if (config.help) {
    console.log('Usage: node src/scripts/ingest-patent-documents.js [--input dir] [--application-number number] [--dry-run]')
    return
  }

  const files = collectFiles(config.input, SUPPORTED_EXTENSIONS)
  if (!files.length) {
    console.log(`No PDF, Markdown, or text documents found in ${config.input}`)
    console.log('Put general reference files under data/patent-documents/general/ and application-specific files under data/patent-documents/applications/<application-number>/.')
    return
  }

  console.log(`Found ${files.length} patent document(s) under ${config.input}`)
  const chunks = []
  const sourceCounts = new Map()
  for (const file of files) {
    const fileChunks = await buildChunks(file, config)
    chunks.push(...fileChunks)
    const sourceId = relative(config.input, file).replace(/\\/g, '/')
    sourceCounts.set(sourceId, fileChunks.length)
    console.log(`  ${basename(file)} → ${fileChunks.length} chunk(s)`)
  }

  if (!chunks.length) {
    console.log('No extractable text found; nothing was sent to the vector store.')
    return
  }
  console.log(`Prepared ${chunks.length} chunk(s).`)
  if (config.dryRun) {
    console.log('Dry run: embeddings and database writes were skipped.')
    for (const chunk of chunks.slice(0, 2)) {
      console.log(JSON.stringify({ id: chunk.id, metadata: chunk.metadata, text: chunk.text.slice(0, 160) }, null, 2))
    }
    return
  }

  const vectorStoreProvider = (process.env.VECTOR_STORE_PROVIDER ?? 'chroma').toLowerCase()
  if (vectorStoreProvider !== 'chroma') {
    throw new Error('This IP tracker branch stores patent documents in Chroma; set VECTOR_STORE_PROVIDER=chroma')
  }

  const embedded = new Array(chunks.length)
  let nextIndex = 0
  let completed = 0
  const workers = Array.from({ length: Math.min(4, chunks.length) }, async () => {
    while (nextIndex < chunks.length) {
      const index = nextIndex++
      const chunk = chunks[index]
      const embedding = await embedText(chunk.text)
      embedded[index] = { ...chunk, embedding }
      completed++
      if (completed % 10 === 0 || completed === chunks.length) {
        console.log(`Embedded ${completed}/${chunks.length} chunks`)
      }
    }
  })
  await Promise.all(workers)

  for (let i = 0; i < embedded.length; i += config.batchSize) {
    const batch = embedded.slice(i, i + config.batchSize)
    await upsertVectors(batch.map(({ id, embedding, text, metadata }) => ({ id, embedding, text, metadata })))
    console.log(`Stored ${Math.min(i + batch.length, embedded.length)}/${embedded.length} chunks`)
  }

  for (const [sourceId, chunkCount] of sourceCounts) {
    await cleanupStalePatentChunks(sourceId, chunkCount)
  }
  console.log(`Patent document ingestion complete: ${embedded.length} chunk(s) indexed in ${vectorStoreProvider}.`)
}

main().catch((error) => {
  console.error('Patent document ingestion failed:', error.message)
  if (process.env.NODE_ENV !== 'production') console.error(error.stack)
  process.exitCode = 1
})

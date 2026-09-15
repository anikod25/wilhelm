/**
 * chunk-documents.js
 *
 * Reads all .md and .txt files from one or more source directories,
 * splits each document into overlapping word-window chunks, and writes
 * a single JSON file containing the chunk list with source metadata.
 *
 * Usage:
 *   node src/scripts/chunk-documents.js [--input <dir>...] [--output <file>]
 *                                        [--chunk-size <words>] [--overlap <words>]
 *                                        [--dry-run]
 *
 * Defaults:
 *   --input       ../../data/hr-policies  ../../data/it-support
 *   --output      ../../data/chunks.json
 *   --chunk-size  250   (target words per chunk)
 *   --overlap     40    (words shared between consecutive chunks)
 *
 * Output schema (array of chunk objects):
 * {
 *   id:        string   — "<domain>/<filename>/<chunkIndex>" (URL-safe)
 *   text:      string   — the chunk text
 *   metadata: {
 *     domain:     string  — the input directory basename (e.g. "hr-policies")
 *     filename:   string  — source file name without extension
 *     filePath:   string  — relative path from the data root
 *     chunkIndex: number  — 0-based index within this file
 *     totalChunks: number — total chunks produced from this file
 *     heading:    string  — nearest markdown heading above this chunk, or ""
 *     wordCount:  number  — actual word count of this chunk
 *   }
 * }
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative, basename, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Path helpers ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_ROOT = resolve(__dirname, '../../../data')

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2)
  const result = {
    inputs: [],
    output: join(DATA_ROOT, 'chunks.json'),
    chunkSize: 250,
    overlap: 40,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        // Collect all consecutive non-flag values as input directories
        while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          result.inputs.push(resolve(args[++i]))
        }
        break
      case '--output':
        result.output = resolve(args[++i])
        break
      case '--chunk-size':
        result.chunkSize = parseInt(args[++i], 10)
        break
      case '--overlap':
        result.overlap = parseInt(args[++i], 10)
        break
      case '--dry-run':
        result.dryRun = true
        break
    }
  }

  if (result.inputs.length === 0) {
    result.inputs = [
      join(DATA_ROOT, 'hr-policies'),
      join(DATA_ROOT, 'it-support'),
    ]
  }

  return result
}

// ── Text utilities ────────────────────────────────────────────────────────────

/**
 * Split a string into words (preserving whitespace structure is not needed —
 * we only care about word count and the joined text).
 */
function words(text) {
  return text.trim().split(/\s+/).filter(Boolean)
}

/**
 * Strip markdown syntax to produce cleaner text for embedding:
 * - Remove ATX headings markers (#) but keep the heading text
 * - Remove bold/italic markers
 * - Remove horizontal rules
 * - Collapse excess blank lines
 * - Keep table content (strip | separators to spaces)
 */
function cleanMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')          // heading markers
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italic
    .replace(/^[-*_]{3,}\s*$/gm, '')       // horizontal rules
    .replace(/\|/g, ' ')                   // table pipes
    .replace(/^\s*[-+*]\s+/gm, '- ')      // normalise bullet markers
    .replace(/\n{3,}/g, '\n\n')            // collapse excess blank lines
    .trim()
}

/**
 * Extract the nearest markdown heading that appears at or before a given
 * character offset in the original (pre-clean) text.
 */
function headingAtOffset(rawText, charOffset) {
  const headingRe = /^#{1,6}\s+(.+)$/gm
  let lastHeading = ''
  let match
  while ((match = headingRe.exec(rawText)) !== null) {
    if (match.index > charOffset) break
    lastHeading = match[1].trim()
  }
  return lastHeading
}

// ── Core chunking ─────────────────────────────────────────────────────────────

/**
 * Split cleaned text into overlapping word-window chunks.
 *
 * Strategy:
 * 1. Prefer to break at paragraph boundaries when one falls within
 *    ±20% of the target chunk size — this keeps semantically related
 *    sentences together.
 * 2. Fall back to hard word-count cuts when no paragraph boundary is near.
 *
 * @param {string} text       - Cleaned document text
 * @param {string} rawText    - Original text (used for heading lookup)
 * @param {number} chunkSize  - Target words per chunk
 * @param {number} overlap    - Words of overlap between adjacent chunks
 * @returns {Array<{text: string, heading: string, wordCount: number}>}
 */
function chunkText(text, rawText, chunkSize, overlap) {
  // Build an array of paragraphs with their byte offsets so we can resolve
  // the nearest heading for each chunk.
  const paragraphs = []
  const paraRe = /[^\n]+(?:\n(?!\n)[^\n]*)*/g
  let pm
  while ((pm = paraRe.exec(text)) !== null) {
    paragraphs.push({ text: pm[0].trim(), offset: pm.index })
  }

  if (paragraphs.length === 0) return []

  const chunks = []
  let paraIdx = 0                // current paragraph pointer
  let wordBuffer = []            // accumulated words for the current chunk
  let bufferCharOffset = 0       // approximate char offset of the buffer start

  const flush = (forceOffset) => {
    if (wordBuffer.length === 0) return
    const chunkText = wordBuffer.join(' ')
    const heading = headingAtOffset(rawText, forceOffset ?? bufferCharOffset)
    chunks.push({ text: chunkText, heading, wordCount: wordBuffer.length })
    // Retain the last `overlap` words for the next chunk
    wordBuffer = wordBuffer.slice(-overlap)
  }

  while (paraIdx < paragraphs.length) {
    const para = paragraphs[paraIdx]
    const paraWords = words(para.text)

    if (wordBuffer.length === 0) {
      bufferCharOffset = para.offset
    }

    wordBuffer.push(...paraWords)

    // Decide whether to flush after this paragraph
    const overTarget = wordBuffer.length >= chunkSize
    const nearTarget =
      wordBuffer.length >= chunkSize * 0.8 &&
      wordBuffer.length <= chunkSize * 1.2

    if (overTarget || nearTarget) {
      flush(para.offset)
      bufferCharOffset = para.offset
    }

    paraIdx++
  }

  // Flush any remaining words
  if (wordBuffer.length > overlap) {
    flush()
  }

  return chunks
}

// ── File discovery ────────────────────────────────────────────────────────────

function collectFiles(dir, extensions = ['.md', '.txt']) {
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        results.push(...collectFiles(full, extensions))
      } else if (extensions.includes(extname(entry).toLowerCase())) {
        results.push(full)
      }
    }
  } catch (err) {
    console.warn(`⚠️  Could not read directory ${dir}: ${err.message}`)
  }
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const config = parseArgs(process.argv)

  console.log('Chunking configuration:')
  console.log(`  Input dirs : ${config.inputs.join(', ')}`)
  console.log(`  Output     : ${config.output}`)
  console.log(`  Chunk size : ~${config.chunkSize} words`)
  console.log(`  Overlap    : ${config.overlap} words`)
  console.log(`  Dry run    : ${config.dryRun}\n`)

  const allChunks = []
  let fileCount = 0

  for (const inputDir of config.inputs) {
    const domain = basename(inputDir)
    const files = collectFiles(inputDir)

    if (files.length === 0) {
      console.warn(`  ⚠️  No .md or .txt files found in ${inputDir}`)
      continue
    }

    console.log(`📂 ${domain} (${files.length} files)`)

    for (const filePath of files) {
      const rawText = readFileSync(filePath, 'utf8')
      const cleanedText = cleanMarkdown(rawText)
      const filename = basename(filePath, extname(filePath))
      const relPath = relative(DATA_ROOT, filePath).replace(/\\/g, '/')

      const rawChunks = chunkText(cleanedText, rawText, config.chunkSize, config.overlap)

      const fileChunks = rawChunks.map((chunk, i) => ({
        id: `${domain}/${filename}/${i}`,
        text: chunk.text,
        metadata: {
          domain,
          filename,
          filePath: relPath,
          chunkIndex: i,
          totalChunks: rawChunks.length,
          heading: chunk.heading,
          wordCount: chunk.wordCount,
        },
      }))

      allChunks.push(...fileChunks)
      console.log(`  ✓ ${filename} → ${fileChunks.length} chunk(s)`)
      fileCount++
    }
  }

  console.log(
    `\nTotal: ${fileCount} file(s), ${allChunks.length} chunk(s)`
  )

  if (config.dryRun) {
    console.log('\n-- Dry run: first 3 chunks --')
    for (const chunk of allChunks.slice(0, 3)) {
      console.log(JSON.stringify(chunk, null, 2))
    }
    console.log('\nDry run complete — no file written.')
    return
  }

  writeFileSync(config.output, JSON.stringify(allChunks, null, 2), 'utf8')
  console.log(`\n✅ Written to ${config.output}`)
}

main()

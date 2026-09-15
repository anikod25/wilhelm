/**
 * chunker.js — shared document chunking utilities
 *
 * Exported surface:
 *   collectFiles(dir, extensions?)  → string[]
 *   chunkFile(filePath, opts?)      → Chunk[]
 *   chunkDirectory(dir, opts?)      → Chunk[]
 *
 * Chunk shape:
 * {
 *   id:       string   — "<domain>/<filename>/<index>"
 *   text:     string   — clean prose text
 *   metadata: {
 *     domain:      string
 *     filename:    string
 *     filePath:    string   — relative to DATA_ROOT
 *     chunkIndex:  number
 *     totalChunks: number
 *     heading:     string
 *     wordCount:   number
 *   }
 * }
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative, basename, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Absolute path to the data directory (../../data from src/lib) */
export const DATA_ROOT = resolve(__dirname, '../../../data')

// ── Text helpers ──────────────────────────────────────────────────────────────

function wordTokens(text) {
  return text.trim().split(/\s+/).filter(Boolean)
}

/**
 * Strip markdown syntax so the stored chunk text is clean prose.
 * Heading text is preserved; only the markers are removed.
 */
export function cleanMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // ATX heading markers
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/^[-*_]{3,}\s*$/gm, '')    // horizontal rules
    .replace(/\|/g, ' ')                // table cell separators
    .replace(/^\s*[-+*]\s+/gm, '- ')   // normalise bullet markers
    .replace(/\n{3,}/g, '\n\n')         // collapse excess blank lines
    .trim()
}

/**
 * Walk the original (pre-clean) text and return the nearest markdown heading
 * at or before the given character offset.
 */
export function headingAtOffset(rawText, charOffset) {
  const re = /^#{1,6}\s+(.+)$/gm
  let last = ''
  let m
  while ((m = re.exec(rawText)) !== null) {
    if (m.index > charOffset) break
    last = m[1].trim()
  }
  return last
}

// ── Core chunking ─────────────────────────────────────────────────────────────

/**
 * Split cleaned text into overlapping word-window chunks, preferring
 * paragraph boundaries when they fall within ±20 % of the target size.
 *
 * @param {string} cleanedText
 * @param {string} rawText       - used only for heading lookup
 * @param {number} chunkSize     - target word count per chunk
 * @param {number} overlap       - words retained from the previous chunk
 * @returns {Array<{text: string, heading: string, wordCount: number}>}
 */
export function splitIntoChunks(cleanedText, rawText, chunkSize, overlap) {
  const paragraphs = []
  const paraRe = /[^\n]+(?:\n(?!\n)[^\n]*)*/g
  let pm
  while ((pm = paraRe.exec(cleanedText)) !== null) {
    paragraphs.push({ text: pm[0].trim(), offset: pm.index })
  }
  if (paragraphs.length === 0) return []

  const chunks = []
  let paraIdx = 0
  let wordBuf = []
  let bufOffset = 0

  const flush = (offset) => {
    if (wordBuf.length === 0) return
    const text = wordBuf.join(' ')
    const heading = headingAtOffset(rawText, offset ?? bufOffset)
    chunks.push({ text, heading, wordCount: wordBuf.length })
    wordBuf = wordBuf.slice(-overlap)
  }

  while (paraIdx < paragraphs.length) {
    const para = paragraphs[paraIdx]
    if (wordBuf.length === 0) bufOffset = para.offset

    wordBuf.push(...wordTokens(para.text))

    const over = wordBuf.length >= chunkSize
    const near =
      wordBuf.length >= chunkSize * 0.8 &&
      wordBuf.length <= chunkSize * 1.2

    if (over || near) {
      flush(para.offset)
      bufOffset = para.offset
    }
    paraIdx++
  }

  if (wordBuf.length > overlap) flush()

  return chunks
}

// ── File / directory helpers ──────────────────────────────────────────────────

/**
 * Recursively collect files matching the given extensions.
 * @param {string}   dir
 * @param {string[]} [extensions=['.md', '.txt']]
 * @returns {string[]} absolute file paths, sorted
 */
export function collectFiles(dir, extensions = ['.md', '.txt']) {
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        results.push(...collectFiles(full, extensions))
      } else if (extensions.includes(extname(entry).toLowerCase())) {
        results.push(full)
      }
    }
  } catch (err) {
    console.warn(`⚠️  Could not read directory ${dir}: ${err.message}`)
  }
  return results.sort()
}

/**
 * Chunk a single file.
 *
 * @param {string} filePath  - absolute path to the file
 * @param {object} [opts]
 * @param {string} [opts.domain]     - override for the domain label
 * @param {number} [opts.chunkSize=250]
 * @param {number} [opts.overlap=40]
 * @returns {import('./chunker.js').Chunk[]}
 */
export function chunkFile(filePath, opts = {}) {
  const { chunkSize = 250, overlap = 40 } = opts
  const domain = opts.domain ?? basename(dirname(filePath))

  const rawText = readFileSync(filePath, 'utf8')
  const cleanedText = cleanMarkdown(rawText)
  const filename = basename(filePath, extname(filePath))
  const relPath = (() => {
    try {
      return relative(DATA_ROOT, filePath).replace(/\\/g, '/')
    } catch {
      return filePath
    }
  })()

  const raw = splitIntoChunks(cleanedText, rawText, chunkSize, overlap)
  const totalChunks = raw.length

  return raw.map((c, i) => ({
    id: `${domain}/${filename}/${i}`,
    text: c.text,
    metadata: {
      domain,
      filename,
      filePath: relPath,
      chunkIndex: i,
      totalChunks,
      heading: c.heading,
      wordCount: c.wordCount,
    },
  }))
}

/**
 * Chunk every eligible file in a directory.
 *
 * @param {string} dir
 * @param {object} [opts]
 * @param {string}   [opts.domain]
 * @param {number}   [opts.chunkSize=250]
 * @param {number}   [opts.overlap=40]
 * @param {string[]} [opts.extensions]
 * @returns {import('./chunker.js').Chunk[]}
 */
export function chunkDirectory(dir, opts = {}) {
  const files = collectFiles(dir, opts.extensions)
  const domain = opts.domain ?? basename(dir)
  return files.flatMap((f) => chunkFile(f, { ...opts, domain }))
}

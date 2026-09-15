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
 */

import { writeFileSync } from 'fs'
import { join, resolve, basename } from 'path'
import { collectFiles, chunkFile, DATA_ROOT } from '../lib/chunker.js'

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
      const chunks = chunkFile(filePath, {
        domain,
        chunkSize: config.chunkSize,
        overlap: config.overlap,
      })
      allChunks.push(...chunks)
      console.log(`  ✓ ${basename(filePath, '.md')} → ${chunks.length} chunk(s)`)
      fileCount++
    }
  }

  console.log(`\nTotal: ${fileCount} file(s), ${allChunks.length} chunk(s)`)

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

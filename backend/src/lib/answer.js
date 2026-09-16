/**
 * answer.js — RAG answer generation
 *
 * Public API:
 *   generateAnswer(query, chunks, options?)  →  Promise<AnswerResult>
 *
 * AnswerResult:
 * {
 *   answer:   string             — prose answer, or the "I don't have that information"
 *                                  fallback if the context doesn't cover the question
 *   sources:  SourceRef[]        — deduplicated list of documents the answer drew from
 *   grounded: boolean            — false when the LLM signalled it had no relevant context
 *   usage: {
 *     contextChunks:  number     — how many chunks were passed in
 *     contextWords:   number     — approximate words of context sent to the LLM
 *   }
 * }
 *
 * SourceRef:
 * {
 *   filename: string             — e.g. "01-annual-leave"
 *   filePath: string             — e.g. "hr-policies/01-annual-leave.md"
 *   heading:  string             — section heading of the most-relevant chunk from this file
 *   domain:   string             — e.g. "hr-policies"
 * }
 *
 * Behaviour when chunks is empty:
 *   Returns the standard "I don't have that information" response immediately
 *   without calling the LLM — no token spend for unroutable queries.
 *
 * Context budget:
 *   To avoid exceeding model context windows, each chunk is truncated at
 *   MAX_CHUNK_WORDS before being included.  The chunks are included in
 *   ranked order (best-first) up to MAX_CONTEXT_WORDS total.
 *   These limits can be overridden via options.
 */

import { generateText } from './llm.js'

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TEMPERATURE   = 0.3   // low — factual answers, minimal hallucination
const DEFAULT_MAX_TOKENS    = 512   // generous for a support/HR answer; cap spend
const MAX_CONTEXT_WORDS     = 1500  // total words of context passed to the LLM
const MAX_CHUNK_WORDS       = 300   // per-chunk word cap (avoids one chunk dominating)

// The exact phrase the LLM is instructed to use when it has no answer.
// Detecting this phrase in the response lets us set grounded=false reliably.
const NO_ANSWER_PHRASE = "I don't have that information"

// ── Prompt construction ───────────────────────────────────────────────────────

/**
 * Truncate a string to at most maxWords words.
 * @param {string} text
 * @param {number} maxWords
 * @returns {string}
 */
function truncateWords(text, maxWords) {
  const tokens = text.trim().split(/\s+/)
  if (tokens.length <= maxWords) return text
  return tokens.slice(0, maxWords).join(' ') + ' …'
}

/**
 * Format a single chunk as a numbered context block.
 * @param {import('./retriever.js').RetrievalResult} chunk
 * @param {number} index  1-based
 * @param {number} maxChunkWords
 * @returns {string}
 */
function formatChunk(chunk, index, maxChunkWords) {
  const source = [
    chunk.metadata.domain,
    chunk.metadata.filename,
    chunk.metadata.heading,
  ]
    .filter(Boolean)
    .join(' › ')

  const body = truncateWords(chunk.text, maxChunkWords)
  return `[${index}] ${source}\n${body}`
}

/**
 * Build the full prompt string sent to the LLM.
 *
 * Design choices:
 * - System role is baked into the prompt (works for models without a
 *   system-turn API like older Ollama models).
 * - Chunks are numbered so the LLM can reference them naturally.
 * - The "ONLY use the context" instruction is repeated twice — once in the
 *   system block and once just before the question — because models under
 *   instruction-following pressure occasionally ignore a single mention.
 * - The exact fallback phrase is quoted in the instruction so the model
 *   reproduces it faithfully enough for our detector to catch.
 * - When conversationHistory is provided it is injected between the CONTEXT
 *   block and the current QUESTION so the model can resolve pronouns and
 *   follow-up references (e.g. "give me that as JSON", "and what about sick
 *   leave?") without re-retrieving prior answers.
 *
 * @param {string} query
 * @param {import('./retriever.js').RetrievalResult[]} chunks
 * @param {number} maxContextWords
 * @param {number} maxChunkWords
 * @param {string} [conversationHistory]  — pre-formatted prior turns from session.getContext()
 * @returns {{ prompt: string, contextWords: number }}
 */
function buildPrompt(query, chunks, maxContextWords, maxChunkWords, conversationHistory = '') {
  // Build context blocks, respecting the total word budget
  const blocks = []
  let wordCount = 0

  for (let i = 0; i < chunks.length; i++) {
    if (wordCount >= maxContextWords) break
    const remaining = maxContextWords - wordCount
    const chunkCap  = Math.min(maxChunkWords, remaining)
    const block     = formatChunk(chunks[i], i + 1, chunkCap)
    const blockWords = block.split(/\s+/).length
    blocks.push(block)
    wordCount += blockWords
  }

  const context = blocks.join('\n\n')

  // History section — only rendered when there are prior turns
  const historySection = conversationHistory.trim()
    ? `CONVERSATION HISTORY (for context only — do NOT treat prior answers as new facts):
${conversationHistory}

`
    : ''

  const prompt = `You are a helpful internal knowledge-base assistant for a company.
Your role is to answer employee questions about HR policies and IT support.

STRICT RULES — you must follow these without exception:
1. Answer ONLY using the information in the CONTEXT section below.
2. Do NOT use any knowledge from your training data.
3. If the context does not contain enough information to answer the question,
   respond with exactly this phrase and nothing else:
   "${NO_ANSWER_PHRASE}"
4. Be concise and direct. Cite the source number(s) (e.g. [1], [2]) inline
   when referencing specific facts.
5. Do not invent policies, numbers, dates, or procedures not present in the context.
6. Do not speculate or say "it depends" unless the context explicitly states conditions.
7. You may use the CONVERSATION HISTORY to understand what "it", "that", or
   "the previous answer" refers to, but never cite history as a source.

CONTEXT:
${context}

${historySection}QUESTION (answer using ONLY the context above):
${query}

ANSWER:`

  return { prompt, contextWords: wordCount }
}

// ── Source deduplication ──────────────────────────────────────────────────────

/**
 * Build a deduplicated, ordered list of source references from the chunks
 * that were actually passed to the LLM.  One entry per unique file;
 * the heading comes from the highest-scoring chunk for that file.
 *
 * @param {import('./retriever.js').RetrievalResult[]} chunks
 * @returns {SourceRef[]}
 */
function buildSources(chunks) {
  /** @type {Map<string, SourceRef>} */
  const seen = new Map()

  for (const chunk of chunks) {
    const key = chunk.metadata.filePath || chunk.metadata.filename
    if (!seen.has(key)) {
      seen.set(key, {
        filename: chunk.metadata.filename,
        filePath: chunk.metadata.filePath,
        heading:  chunk.metadata.heading,
        domain:   chunk.metadata.domain,
      })
    }
  }

  return Array.from(seen.values())
}

// ── Grounding detection ───────────────────────────────────────────────────────

/**
 * Returns true if the answer text signals that the context was insufficient.
 * Checks for the canonical phrase and a few common paraphrases in case
 * the model slightly reformulated it.
 *
 * @param {string} answer
 * @returns {boolean}
 */
function isUngrounded(answer) {
  const lower = answer.toLowerCase()
  return (
    lower.includes("i don't have that information") ||
    lower.includes("i do not have that information") ||
    lower.includes("not covered in the") ||
    lower.includes("context does not") ||
    lower.includes("context doesn't") ||
    lower.includes("no information") && lower.length < 120  // short "no info" reply
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   filename: string,
 *   filePath: string,
 *   heading:  string,
 *   domain:   string,
 * }} SourceRef
 */

/**
 * @typedef {{
 *   answer:   string,
 *   sources:  SourceRef[],
 *   grounded: boolean,
 *   usage: {
 *     contextChunks: number,
 *     contextWords:  number,
 *   }
 * }} AnswerResult
 */

/**
 * Generate a grounded answer from retrieved context chunks.
 *
 * @param {string}  query    - The original user question
 * @param {import('./retriever.js').RetrievalResult[]} chunks
 *                           - Ranked chunks from retrieve(); may be empty
 * @param {object}  [options]
 * @param {number}  [options.temperature=0.3]        - LLM sampling temperature
 * @param {number}  [options.maxTokens=512]           - Max tokens in the LLM response
 * @param {number}  [options.maxContextWords=1500]    - Total context word budget
 * @param {number}  [options.maxChunkWords=300]       - Per-chunk word cap
 * @param {string}  [options.history='']              - Pre-formatted prior turns from
 *                                                      session.getContext(); injected
 *                                                      between CONTEXT and QUESTION
 * @returns {Promise<AnswerResult>}
 *
 * @example
 * // Typical call after retrieve():
 * const chunks = await retrieve(query, 'hr')
 * const result = await generateAnswer(query, chunks)
 * console.log(result.answer)
 * console.log(result.sources)   // [{ filename, filePath, heading, domain }]
 * console.log(result.grounded)  // false when LLM had nothing relevant
 *
 * @example
 * // Tighter temperature for highly factual answers:
 * const result = await generateAnswer(query, chunks, { temperature: 0, maxTokens: 256 })
 */
export async function generateAnswer(query, chunks, options = {}) {
  const {
    temperature      = DEFAULT_TEMPERATURE,
    maxTokens        = DEFAULT_MAX_TOKENS,
    maxContextWords  = MAX_CONTEXT_WORDS,
    maxChunkWords    = MAX_CHUNK_WORDS,
    history          = '',   // pre-formatted prior turns from session.getContext()
  } = options

  // ── Fast path: no context ─────────────────────────────────────────────────
  // Avoids an LLM call when the retriever found nothing (out_of_scope queries,
  // empty vector store, etc.)
  if (!chunks || chunks.length === 0) {
    return {
      answer:   NO_ANSWER_PHRASE,
      sources:  [],
      grounded: false,
      usage:    { contextChunks: 0, contextWords: 0 },
    }
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const { prompt, contextWords } = buildPrompt(
    query,
    chunks,
    maxContextWords,
    maxChunkWords,
    history,
  )

  // ── Generate ──────────────────────────────────────────────────────────────
  const raw = await generateText(prompt, { temperature, maxTokens })
  const answer = raw.trim()

  // ── Assess grounding and build sources ───────────────────────────────────
  const grounded = !isUngrounded(answer)
  const sources  = grounded ? buildSources(chunks) : []

  return {
    answer,
    sources,
    grounded,
    usage: {
      contextChunks: chunks.length,
      contextWords,
    },
  }
}

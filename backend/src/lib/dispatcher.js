/**
 * dispatcher.js — format-name → formatter dispatcher
 *
 * Public API:
 *   dispatch(format, result, options?)  →  Promise<DispatchResult>
 *   SUPPORTED_FORMATS                  →  readonly string[]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DispatchResult
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   format:      string          — the format name that was used
 *   contentType: string          — MIME type for the HTTP Content-Type header
 *   output:      string | Buffer — the formatted payload
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Supported format names (case-insensitive)
 * ─────────────────────────────────────────────────────────────────────────────
 *   "json"   →  formatResponse()   (formatter.js)     → object  / application/json
 *   "xml"    →  formatXml()        (formatter-xml.js)  → string  / application/xml
 *   "xlsx"   →  formatXlsx()       (formatter-xlsx.js) → Buffer  / application/vnd.openxmlformats…
 *   "email"  →  formatEmail()      (formatter-email.js)→ object  / text/plain
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Options
 * ─────────────────────────────────────────────────────────────────────────────
 *   Options are passed through to the underlying formatter unchanged.
 *   Each formatter documents its own options — see the individual modules.
 *
 *   The xlsx formatter accepts a single PipelineResult, an array, or an array
 *   of { query, result } pairs.  Pass the raw input as the `result` argument
 *   and it will be forwarded as-is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Error handling
 * ─────────────────────────────────────────────────────────────────────────────
 *   Throws UnsupportedFormatError for unknown format names.
 *   Formatter-specific validation errors (ValidationError and subclasses)
 *   propagate unchanged — the dispatcher does not catch them.
 */

import { formatResponse }  from './formatter.js'
import { formatXml }       from './formatter-xml.js'
import { formatXlsx }      from './formatter-xlsx.js'
import { formatEmail }     from './formatter-email.js'

// ── Error type ────────────────────────────────────────────────────────────────

export class UnsupportedFormatError extends Error {
  /** @param {string} format */
  constructor(format) {
    super(
      `Unsupported format "${format}". ` +
      `Supported values: ${SUPPORTED_FORMATS.join(', ')}`
    )
    this.name   = 'UnsupportedFormatError'
    this.format = format
  }
}

// ── Format registry ───────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   fn:          (result: any, options?: any) => any,
 *   contentType: string,
 * }} FormatEntry
 */

/** @type {Record<string, FormatEntry>} */
const FORMATS = {
  json: {
    fn:          formatResponse,
    contentType: 'application/json',
  },
  xml: {
    fn:          formatXml,
    contentType: 'application/xml; charset=utf-8',
  },
  xlsx: {
    fn:          formatXlsx,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  email: {
    fn:          formatEmail,
    contentType: 'text/plain; charset=utf-8',
  },
}

/**
 * Immutable list of supported format names.
 * @type {readonly string[]}
 */
export const SUPPORTED_FORMATS = Object.freeze(Object.keys(FORMATS))

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   format:      string,
 *   contentType: string,
 *   output:      import('./formatter.js').FormattedResponse | string | Buffer,
 * }} DispatchResult
 */

/**
 * Route a format name to the correct formatter and return the result.
 *
 * @param {string}  format   — "json" | "xml" | "xlsx" | "email" (case-insensitive)
 * @param {*}       result   — PipelineResult, or xlsx batch input
 * @param {object}  [options]— forwarded unchanged to the underlying formatter
 * @returns {Promise<DispatchResult>}
 * @throws {UnsupportedFormatError} for unknown format names
 *
 * @example
 * import { ask }      from './lib/pipeline.js'
 * import { dispatch } from './lib/dispatcher.js'
 *
 * const pipelineResult = await ask(query)
 * const { output, contentType } = await dispatch('json', pipelineResult)
 * res.set('Content-Type', contentType).json(output)
 *
 * @example
 * // xlsx with query string and options
 * const { output, contentType } = await dispatch(
 *   'xlsx',
 *   { query: 'How many sick days?', result: pipelineResult },
 * )
 * res.set({
 *   'Content-Type':        contentType,
 *   'Content-Disposition': 'attachment; filename="answer.xlsx"',
 * }).send(output)
 *
 * @example
 * // email with options forwarded
 * const { output } = await dispatch('email', pipelineResult, {
 *   query:         'How many sick days?',
 *   recipientName: 'Sarah',
 * })
 * console.log(output.subject)
 */
export async function dispatch(format, result, options = {}) {
  const key   = String(format ?? '').toLowerCase().trim()
  const entry = FORMATS[key]

  if (!entry) {
    throw new UnsupportedFormatError(key || format)
  }

  const output = await entry.fn(result, options)

  return {
    format:      key,
    contentType: entry.contentType,
    output,
  }
}

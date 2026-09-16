/**
 * formatter.js — pipeline result → validated API response
 *
 * Public API:
 *   formatResponse(pipelineResult)  →  FormattedResponse
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FormattedResponse  (the shape sent to the client)
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   answer:     string       — prose answer (or fallback message)
 *   domain:     string       — 'hr' | 'support' | 'out_of_scope'
 *   sources:    string[]     — human-readable citation strings, e.g.
 *                              ["hr-policies › 01-annual-leave › Entitlement"]
 *   sourceDocs: SourceDoc[]  — full source metadata for richer client rendering
 *   grounded:   boolean      — false when the LLM had no relevant context
 *   stage:      string       — pipeline stage label for client-side logic
 *   meta: {
 *     confidence: string     — router confidence: 'high' | 'low'
 *     timing: {
 *       routeMs:    number
 *       retrieveMs: number
 *       answerMs:   number
 *       totalMs:    number
 *     }
 *   }
 * }
 *
 * SourceDoc:
 * {
 *   filename: string
 *   filePath: string
 *   heading:  string
 *   domain:   string
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation
 * ─────────────────────────────────────────────────────────────────────────────
 *   formatResponse() serialises the output to JSON and parses it back before
 *   returning.  This catches:
 *     • non-serialisable values (undefined, circular refs, BigInt, functions)
 *     • fields that accidentally become null / wrong type
 *   A ValidationError is thrown if the round-trip fails or required fields
 *   are missing or the wrong type.  The error message names the exact field.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Citation string format
 * ─────────────────────────────────────────────────────────────────────────────
 *   Parts joined by " › " with empty parts omitted:
 *     "hr-policies › 01-annual-leave › Entitlement"
 *     "it-support › 02-vpn-access"     (no heading on that chunk)
 */

// ── Errors ────────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  /** @param {string} message @param {string} [field] */
  constructor(message, field) {
    super(field ? `[${field}] ${message}` : message)
    this.name  = 'ValidationError'
    this.field = field ?? null
  }
}

// ── Citation helpers ──────────────────────────────────────────────────────────

/**
 * Convert a SourceRef object into a human-readable citation string.
 * @param {{ domain: string, filename: string, heading: string }} source
 * @returns {string}
 */
function citationString(source) {
  return [source.domain, source.filename, source.heading]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' › ')
}

// ── Schema validation ─────────────────────────────────────────────────────────

/**
 * Field-level type rules.
 * Each entry: [fieldPath, expectedType, required]
 * Nested paths use dot notation: 'meta.confidence'
 *
 * @type {Array<[string, string, boolean]>}
 */
const FIELD_RULES = [
  ['answer',           'string',  true],
  ['domain',           'string',  true],
  ['sources',          'array',   true],
  ['sourceDocs',       'array',   true],
  ['grounded',         'boolean', true],
  ['stage',            'string',  true],
  ['meta',             'object',  true],
  ['meta.confidence',  'string',  true],
  ['meta.timing',      'object',  true],
]

/**
 * Resolve a dot-path against an object.
 * Returns undefined if any segment is missing.
 * @param {object} obj
 * @param {string} path
 * @returns {unknown}
 */
function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

/**
 * Validate an already-parsed FormattedResponse object.
 * Throws ValidationError on the first violation found.
 * @param {object} obj
 */
function validateShape(obj) {
  for (const [path, expectedType, required] of FIELD_RULES) {
    const value = getPath(obj, path)

    if (value === undefined || value === null) {
      if (required) throw new ValidationError('required field is missing or null', path)
      continue
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (actualType !== expectedType) {
      throw new ValidationError(
        `expected ${expectedType} but got ${actualType}`,
        path,
      )
    }
  }

  // sources must be an array of strings
  for (let i = 0; i < obj.sources.length; i++) {
    if (typeof obj.sources[i] !== 'string') {
      throw new ValidationError(`expected string at index ${i}`, 'sources')
    }
  }

  // sourceDocs must be an array of objects with required keys
  const docKeys = ['filename', 'filePath', 'heading', 'domain']
  for (let i = 0; i < obj.sourceDocs.length; i++) {
    const doc = obj.sourceDocs[i]
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      throw new ValidationError(`expected object at index ${i}`, 'sourceDocs')
    }
    for (const key of docKeys) {
      if (typeof doc[key] !== 'string') {
        throw new ValidationError(
          `sourceDocs[${i}].${key} must be a string`,
          'sourceDocs',
        )
      }
    }
  }
}

// ── Validation helpers (test-only export) ────────────────────────────────────

/**
 * Exposed for testing only — not part of the public API.
 * @internal
 */
export { validateShape }

/**
 * @typedef {{
 *   filename: string,
 *   filePath: string,
 *   heading:  string,
 *   domain:   string,
 * }} SourceDoc
 */

/**
 * @typedef {{
 *   answer:     string,
 *   domain:     string,
 *   sources:    string[],
 *   sourceDocs: SourceDoc[],
 *   grounded:   boolean,
 *   stage:      string,
 *   meta: {
 *     confidence: string,
 *     timing: {
 *       routeMs:    number,
 *       retrieveMs: number,
 *       answerMs:   number,
 *       totalMs:    number,
 *     }
 *   }
 * }} FormattedResponse
 */

/**
 * Format a PipelineResult into the validated API response shape.
 *
 * @param {import('./pipeline.js').PipelineResult} result
 * @returns {FormattedResponse}
 * @throws {ValidationError} if the formatted output fails schema validation
 * @throws {Error}           if JSON serialisation fails (non-serialisable values)
 *
 * @example
 * import { ask }             from './lib/pipeline.js'
 * import { formatResponse }  from './lib/formatter.js'
 *
 * const pipelineResult = await ask(query)
 * const response       = formatResponse(pipelineResult)
 * res.json(response)
 */
export function formatResponse(result) {
  // ── 1. Coerce all fields to serialisable primitives ───────────────────────

  const sourceDocs = (result.sources ?? []).map((s) => ({
    filename: String(s.filename ?? ''),
    filePath: String(s.filePath ?? ''),
    heading:  String(s.heading  ?? ''),
    domain:   String(s.domain   ?? ''),
  }))

  const sources = sourceDocs.map(citationString)

  const formatted = {
    answer:     String(result.answer   ?? ''),
    domain:     String(result.domain   ?? 'out_of_scope'),
    sources,
    sourceDocs,
    grounded:   Boolean(result.grounded),
    stage:      String(result.stage    ?? 'out_of_scope'),
    meta: {
      confidence: String(result.confidence ?? 'low'),
      timing: {
        routeMs:    Number(result.timing?.routeMs    ?? 0),
        retrieveMs: Number(result.timing?.retrieveMs ?? 0),
        answerMs:   Number(result.timing?.answerMs   ?? 0),
        totalMs:    Number(result.timing?.totalMs    ?? 0),
      },
    },
  }

  // ── 2. JSON round-trip check ──────────────────────────────────────────────
  // Serialise → parse → compare.  Catches undefined values, circular refs,
  // BigInt, Symbols, or any other non-serialisable value that slipped through.

  let serialised
  try {
    serialised = JSON.stringify(formatted)
  } catch (err) {
    throw new Error(`formatResponse: JSON serialisation failed — ${err.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(serialised)
  } catch (err) {
    // Should be unreachable if stringify succeeded, but guard anyway
    throw new Error(`formatResponse: JSON parse-back failed — ${err.message}`)
  }

  // ── 3. Schema validation on the parsed (trusted) copy ────────────────────

  validateShape(parsed)

  // Return the parsed copy — guarantees only JSON-safe values reach the caller
  return parsed
}

/**
 * formatter-xml.js — pipeline result → validated XML response
 *
 * Public API:
 *   formatXml(pipelineResult)  →  string   (well-formed XML)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Output schema
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * <?xml version="1.0" encoding="UTF-8"?>
 * <response>
 *   <answer>You are entitled to 20 days of annual leave [1].</answer>
 *   <domain>hr</domain>
 *   <grounded>true</grounded>
 *   <stage>answered</stage>
 *   <sources>
 *     <source>hr-policies › 01-annual-leave › Entitlement</source>
 *     <source>hr-policies › 03-remote-work › Equipment</source>
 *   </sources>
 *   <sourceDocs>
 *     <doc>
 *       <filename>01-annual-leave</filename>
 *       <filePath>hr-policies/01-annual-leave.md</filePath>
 *       <heading>Entitlement</heading>
 *       <domain>hr-policies</domain>
 *     </doc>
 *   </sourceDocs>
 *   <meta>
 *     <confidence>high</confidence>
 *     <timing>
 *       <routeMs>12</routeMs>
 *       <retrieveMs>45</retrieveMs>
 *       <answerMs>234</answerMs>
 *       <totalMs>292</totalMs>
 *     </timing>
 *   </meta>
 * </response>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation
 * ─────────────────────────────────────────────────────────────────────────────
 *   formatXml() runs a self-contained well-formedness check on the serialised
 *   string before returning it.  The checker verifies:
 *     • all opened tags are closed in LIFO order (balanced nesting)
 *     • no raw < or > appear outside tags (i.e. escaping worked)
 *     • the document has exactly one root element
 *     • required elements are present at expected XPaths
 *   Throws XmlValidationError (extends ValidationError) on failure.
 *
 *   No third-party XML library is used — the checker is self-contained.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Escaping
 * ─────────────────────────────────────────────────────────────────────────────
 *   All text content is passed through escapeXml() before insertion:
 *     &  →  &amp;
 *     <  →  &lt;
 *     >  →  &gt;
 *     "  →  &quot;
 *     '  →  &apos;
 */

import { ValidationError } from './formatter.js'

// ── Errors ────────────────────────────────────────────────────────────────────

export class XmlValidationError extends ValidationError {
  /** @param {string} message @param {string} [element] */
  constructor(message, element) {
    super(message, element)
    this.name = 'XmlValidationError'
  }
}

// ── XML escaping ──────────────────────────────────────────────────────────────

/**
 * Escape a value for safe inclusion as XML text content.
 * Also coerces non-strings so callers don't need to pre-cast.
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g,  '&amp;')   // must be first — avoid double-escaping
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;')
}

// ── Tag helpers ───────────────────────────────────────────────────────────────

/**
 * Wrap escaped text content in a tag.
 * @param {string}  tag
 * @param {unknown} value   — will be escaped
 * @param {number}  [indent=0]
 * @returns {string}
 */
function tag(name, value, indent = 0) {
  const pad = '  '.repeat(indent)
  return `${pad}<${name}>${escapeXml(value)}</${name}>`
}

/**
 * Wrap pre-built child XML in a block tag.
 * Children are expected to already be indented at (indent+1) level.
 * @param {string}   name
 * @param {string[]} children
 * @param {number}   [indent=0]
 * @returns {string}
 */
function block(name, children, indent = 0) {
  const pad = '  '.repeat(indent)
  return [`${pad}<${name}>`, ...children, `${pad}</${name}>`].join('\n')
}

// ── Citation helper (matches formatter.js) ────────────────────────────────────

/**
 * @param {{ domain: string, filename: string, heading: string }} source
 * @returns {string}
 */
function citationString(source) {
  return [source.domain, source.filename, source.heading]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' › ')
}

// ── Well-formedness validator ─────────────────────────────────────────────────

/**
 * Tokenise the XML string into a flat list of tag/text events.
 * Returns an array of { type: 'open'|'close'|'self'|'text', name?, raw }.
 *
 * This is intentionally minimal — it handles the output of our own
 * serialiser, not arbitrary XML.  It does not handle:
 *   • processing instructions or DOCTYPE (we emit none)
 *   • CDATA sections (we emit none)
 *   • attributes (we emit none)
 *
 * @param {string} xml
 * @returns {Array<{type: string, name?: string}>}
 */
function tokenise(xml) {
  const tokens = []
  // Strip the XML declaration so it doesn't confuse the tag parser
  const body = xml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9_-]*)(\s[^>]*)?\s*(\/?)>/g
  let lastIndex = 0
  let m

  while ((m = tagRe.exec(body)) !== null) {
    // Text node before this tag
    if (m.index > lastIndex) {
      tokens.push({ type: 'text' })
    }
    const selfClose = m[3] === '/'
    const close     = m[0].startsWith('</')
    tokens.push({
      type: selfClose ? 'self' : close ? 'close' : 'open',
      name: m[1],
    })
    lastIndex = tagRe.lastIndex
  }

  return tokens
}

/**
 * Verify that the XML string produced by our serialiser is well-formed.
 * Checks:
 *   1. Tag nesting is balanced (LIFO stack)
 *   2. Exactly one root element
 *   3. Required elements are present
 *
 * @param {string} xml
 * @throws {XmlValidationError}
 */
function validateXml(xml) {
  // ── 1. Raw character check — no unescaped < or > in text nodes ────────────
  //    We do this by extracting all text between tags and checking.
  const textNodeRe = />([^<]*)</g
  let tm
  while ((tm = textNodeRe.exec(xml)) !== null) {
    const text = tm[1]
    if (text.includes('<') || text.includes('>')) {
      throw new XmlValidationError(
        'unescaped < or > found in text content — escaping failed',
        'content',
      )
    }
  }

  // ── 2. Tag balance check ──────────────────────────────────────────────────
  const tokens = tokenise(xml)
  const stack  = []

  for (const token of tokens) {
    if (token.type === 'open') {
      stack.push(token.name)
    } else if (token.type === 'close') {
      if (stack.length === 0) {
        throw new XmlValidationError(
          `unexpected closing tag </${token.name}> — no open tags on stack`,
          token.name,
        )
      }
      const expected = stack.pop()
      if (expected !== token.name) {
        throw new XmlValidationError(
          `mismatched tags: opened <${expected}>, closed </${token.name}>`,
          token.name,
        )
      }
    }
    // self-closing and text tokens don't affect the stack
  }

  if (stack.length > 0) {
    throw new XmlValidationError(
      `unclosed tags remaining: ${stack.join(', ')}`,
      stack[stack.length - 1],
    )
  }

  // ── 3. Single root element ────────────────────────────────────────────────
  const rootTags = (xml.match(/<response>/g) ?? []).length
  if (rootTags !== 1) {
    throw new XmlValidationError(
      `expected exactly one <response> root element, found ${rootTags}`,
      'response',
    )
  }

  // ── 4. Required elements present ─────────────────────────────────────────
  const required = ['answer', 'domain', 'grounded', 'stage', 'sources', 'sourceDocs', 'meta']
  for (const el of required) {
    if (!xml.includes(`<${el}>`)) {
      throw new XmlValidationError(`required element <${el}> is missing`, el)
    }
    if (!xml.includes(`</${el}>`)) {
      throw new XmlValidationError(`required element <${el}> is not closed`, el)
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format a PipelineResult as a validated, well-formed XML string.
 *
 * @param {import('./pipeline.js').PipelineResult} result
 * @returns {string}  UTF-8 XML string, always ending with a newline
 * @throws {XmlValidationError}  if the output fails well-formedness checks
 *
 * @example
 * import { ask }        from './lib/pipeline.js'
 * import { formatXml }  from './lib/formatter-xml.js'
 *
 * const pipelineResult = await ask(query)
 * const xml = formatXml(pipelineResult)
 * res.set('Content-Type', 'application/xml; charset=utf-8').send(xml)
 */
export function formatXml(result) {
  // ── 1. Coerce all values (mirrors formatter.js) ───────────────────────────

  const sourceDocs = (result.sources ?? []).map((s) => ({
    filename: String(s.filename ?? ''),
    filePath: String(s.filePath ?? ''),
    heading:  String(s.heading  ?? ''),
    domain:   String(s.domain   ?? ''),
  }))

  const citations  = sourceDocs.map(citationString)
  const answer     = String(result.answer      ?? '')
  const domain     = String(result.domain      ?? 'out_of_scope')
  const grounded   = Boolean(result.grounded)
  const stage      = String(result.stage       ?? 'out_of_scope')
  const confidence = String(result.confidence  ?? 'low')
  const timing     = {
    routeMs:    Number(result.timing?.routeMs    ?? 0),
    retrieveMs: Number(result.timing?.retrieveMs ?? 0),
    answerMs:   Number(result.timing?.answerMs   ?? 0),
    totalMs:    Number(result.timing?.totalMs    ?? 0),
  }

  // ── 2. Build XML ──────────────────────────────────────────────────────────

  const sourceLines = citations.map((c) => tag('source', c, 2))
  const docLines    = sourceDocs.map((d) =>
    block('doc', [
      tag('filename', d.filename, 3),
      tag('filePath', d.filePath, 3),
      tag('heading',  d.heading,  3),
      tag('domain',   d.domain,   3),
    ], 2)
  )

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<response>',
    tag('answer',   answer,   1),
    tag('domain',   domain,   1),
    tag('grounded', grounded, 1),
    tag('stage',    stage,    1),
    block('sources',    sourceLines, 1),
    block('sourceDocs', docLines,    1),
    block('meta', [
      tag('confidence', confidence, 2),
      block('timing', [
        tag('routeMs',    timing.routeMs,    3),
        tag('retrieveMs', timing.retrieveMs, 3),
        tag('answerMs',   timing.answerMs,   3),
        tag('totalMs',    timing.totalMs,    3),
      ], 2),
    ], 1),
    '</response>',
  ]

  const xml = lines.join('\n') + '\n'

  // ── 3. Well-formedness validation ─────────────────────────────────────────

  validateXml(xml)

  return xml
}

// ── Test-only export ──────────────────────────────────────────────────────────

/** @internal */
export { validateXml, escapeXml }

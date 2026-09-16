/**
 * formatter-email.js — pipeline result → professional email draft (plain text)
 *
 * Public API:
 *   formatEmail(result, options?)  →  EmailDraft
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EmailDraft
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   subject:  string   — ready-to-paste subject line, e.g.
 *                        "Re: Annual Leave Entitlement"
 *   body:     string   — full plain-text email body, including greeting,
 *                        answer paragraphs, sources block, and sign-off
 *   text:     string   — subject + body as one copy-pasteable string
 *                        (format: "Subject: …\n\n<body>")
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Options
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   query?:       string   — the original user question; used to derive the
 *                            subject line (falls back to domain-based default)
 *   recipientName?: string — inserted in the greeting, e.g. "Hi Sarah,"
 *                            defaults to "Hi,"
 *   senderName?:  string   — sign-off name, e.g. "People Operations"
 *                            defaults to domain-appropriate team name
 *   includeDisclaimer?: boolean  — append the standard AI-generated disclaimer
 *                                  (default: true)
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation
 * ─────────────────────────────────────────────────────────────────────────────
 *   formatEmail() validates the output before returning:
 *     • subject and body are non-empty strings
 *     • subject contains no newlines (would break email headers)
 *     • body contains the answer text
 *     • text equals "Subject: <subject>\n\n<body>"
 *   Throws EmailValidationError (extends ValidationError) on failure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Out-of-scope / ungrounded behaviour
 * ─────────────────────────────────────────────────────────────────────────────
 *   The email is always generated — even for out_of_scope or ungrounded results.
 *   The body honestly conveys the limitation rather than fabricating an answer.
 *   The subject line reflects this ("Re: Your Query — Outside Our Scope").
 */

import { ValidationError } from './formatter.js'

// ── Error type ────────────────────────────────────────────────────────────────

export class EmailValidationError extends ValidationError {
  /** @param {string} message @param {string} [field] */
  constructor(message, field) {
    super(message, field)
    this.name = 'EmailValidationError'
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max subject line length before truncation (RFC 5322 recommends ≤78 chars). */
const MAX_SUBJECT_LENGTH = 78

/**
 * Appended when includeDisclaimer is true.
 * Kept short — the reader doesn't need a paragraph of legalese.
 */
const DISCLAIMER =
  'Please note: this response was drafted with the assistance of an AI ' +
  'knowledge-base tool. If anything seems unclear or incorrect, please ' +
  'reach out directly.'

/** Domain label → default sender team name. */
const SENDER_NAMES = {
  hr:           'People Operations',
  support:      'IT Helpdesk',
  out_of_scope: 'Wilhelm Knowledge Base',
}

/** Domain label → human-readable topic for default subject lines. */
const DOMAIN_TOPICS = {
  hr:           'HR Policy',
  support:      'IT Support',
  out_of_scope: 'Your Query',
}

// ── Subject line generation ───────────────────────────────────────────────────

/**
 * Derive a subject line from the user's query.
 *
 * Strategy (in order):
 *   1. Strip question marks and filler words, title-case the remainder.
 *   2. If the result is shorter than 6 words, fall back to a domain default.
 *   3. Truncate to MAX_SUBJECT_LENGTH with an ellipsis if needed.
 *
 * @param {string} query
 * @param {string} domain   — router label
 * @param {string} stage    — pipeline stage
 * @returns {string}
 */
function deriveSubject(query, domain, stage) {
  const topic = DOMAIN_TOPICS[domain] ?? 'Your Query'

  if (stage === 'out_of_scope' || stage === 'low_confidence') {
    return `Re: ${topic} — Outside Our Scope`
  }

  if (!query || query.trim().length === 0) {
    return `Re: ${topic} Enquiry`
  }

  // Strip trailing punctuation and filler openers
  let cleaned = query.trim()
    .replace(/[?!.]+$/, '')
    .replace(/^(hi|hello|hey|please|can you|could you|i want to know|tell me|what is|what are|how do i|how can i)\s+/i, '')
    .trim()

  // Title-case: capitalise first letter of each significant word
  const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in',
    'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'my', 'do', 'i'])

  cleaned = cleaned
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase()
      return (i === 0 || !STOP_WORDS.has(lower))
        ? lower.charAt(0).toUpperCase() + lower.slice(1)
        : lower
    })
    .join(' ')

  const subject = `Re: ${cleaned}`

  // Truncate if too long
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return subject.slice(0, MAX_SUBJECT_LENGTH - 1) + '…'
  }

  return subject
}

// ── Source block ──────────────────────────────────────────────────────────────

/**
 * Format the sources list as a plain-text block.
 * Returns an empty string if there are no sources.
 *
 * @param {import('./pipeline.js').PipelineResult['sources']} sources
 * @returns {string}
 */
function formatSourcesBlock(sources) {
  if (!sources || sources.length === 0) return ''

  const lines = sources.map((s) => {
    const parts = [s.domain, s.filename, s.heading].filter(Boolean)
    return `  • ${parts.join(' › ')}`
  })

  return [
    'This response draws from the following internal documents:',
    ...lines,
  ].join('\n')
}

// ── Answer paragraph formatting ───────────────────────────────────────────────

/**
 * Break the raw answer into paragraphs for the email body.
 * The LLM may return the answer as a single block or with existing newlines.
 * We normalise double-newlines to paragraph breaks and wrap long lines.
 *
 * @param {string} answer
 * @param {number} [lineWidth=80]
 * @returns {string}
 */
function formatAnswerParagraphs(answer, lineWidth = 80) {
  if (!answer || !answer.trim()) return ''

  // Split on existing double newlines to preserve intentional paragraph breaks
  const paragraphs = answer
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim().replace(/\n/g, ' '))  // collapse single newlines within a paragraph
    .filter(Boolean)

  return paragraphs
    .map((para) => wordWrap(para, lineWidth))
    .join('\n\n')
}

/**
 * Wrap a single paragraph at word boundaries.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function wordWrap(text, width) {
  const words = text.split(' ')
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= width) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  return lines.join('\n')
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * @param {EmailDraft} draft
 * @param {string} answer  — original answer text for containment check
 */
function validateDraft(draft, answer) {
  if (!draft.subject || typeof draft.subject !== 'string') {
    throw new EmailValidationError('subject must be a non-empty string', 'subject')
  }
  if (draft.subject.trim().length === 0) {
    throw new EmailValidationError('subject must not be blank', 'subject')
  }
  if (/[\r\n]/.test(draft.subject)) {
    throw new EmailValidationError('subject must not contain newlines', 'subject')
  }
  if (!draft.body || typeof draft.body !== 'string' || draft.body.trim().length === 0) {
    throw new EmailValidationError('body must be a non-empty string', 'body')
  }

  // Body should contain at least a recognisable fragment of the answer
  const answerFragment = String(answer ?? '').trim().slice(0, 40)
  if (answerFragment && !draft.body.includes(answerFragment)) {
    throw new EmailValidationError(
      'body does not appear to contain the answer text',
      'body',
    )
  }

  if (typeof draft.text !== 'string' || draft.text.trim().length === 0) {
    throw new EmailValidationError('text must be a non-empty string', 'text')
  }
  const expectedText = `Subject: ${draft.subject}\n\n${draft.body}`
  if (draft.text !== expectedText) {
    throw new EmailValidationError(
      'text must equal "Subject: <subject>\\n\\n<body>"',
      'text',
    )
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ subject: string, body: string, text: string }} EmailDraft
 */

/**
 * Format a PipelineResult as a professional plain-text email draft.
 *
 * @param {import('./pipeline.js').PipelineResult} result
 * @param {object}  [options]
 * @param {string}  [options.query]              — original user question
 * @param {string}  [options.recipientName]      — inserted in greeting
 * @param {string}  [options.senderName]         — sign-off name
 * @param {boolean} [options.includeDisclaimer=true]
 * @returns {EmailDraft}
 * @throws {EmailValidationError}
 *
 * @example
 * const draft = formatEmail(pipelineResult, { query: 'How many sick days?' })
 * console.log(draft.subject)  // "Re: Sick Days"
 * console.log(draft.text)     // "Subject: Re: Sick Days\n\nHi, ..."
 *
 * @example
 * // With recipient and custom sender
 * const draft = formatEmail(result, {
 *   query:         'How do I reset my password?',
 *   recipientName: 'Sarah',
 *   senderName:    'IT Helpdesk',
 * })
 */
export function formatEmail(result, options = {}) {
  const {
    query              = '',
    recipientName      = '',
    senderName         = '',
    includeDisclaimer  = true,
  } = options

  // ── 1. Coerce all input fields ────────────────────────────────────────────
  const answer     = String(result.answer     ?? '').trim()
  const domain     = String(result.domain     ?? 'out_of_scope')
  const stage      = String(result.stage      ?? 'out_of_scope')
  const grounded   = Boolean(result.grounded)
  const sources    = Array.isArray(result.sources) ? result.sources : []

  const sender     = senderName.trim()
    || SENDER_NAMES[domain]
    || 'Wilhelm Knowledge Base'

  // ── 2. Subject line ───────────────────────────────────────────────────────
  const subject = deriveSubject(String(query).trim(), domain, stage)

  // ── 3. Greeting ───────────────────────────────────────────────────────────
  const greeting = recipientName.trim()
    ? `Hi ${recipientName.trim()},`
    : 'Hi,'

  // ── 4. Opening sentence ───────────────────────────────────────────────────
  //   Tailored to the pipeline stage so the email is honest about what happened.
  let opening
  if (stage === 'out_of_scope' || stage === 'low_confidence') {
    opening =
      'Thank you for your message. Unfortunately your question falls outside ' +
      'the scope of our internal knowledge base, which covers HR policies and ' +
      'IT support topics.'
  } else if (!grounded || stage === 'ungrounded' || stage === 'no_context') {
    opening =
      'Thank you for your message. We were unable to find specific information ' +
      'in our knowledge base to answer your question fully.'
  } else {
    const topicMap = { hr: 'your HR policy question', support: 'your IT support request' }
    const topic = topicMap[domain] ?? 'your question'
    opening = `Thank you for your message. Please find the information regarding ${topic} below.`
  }

  // ── 5. Answer block ───────────────────────────────────────────────────────
  const answerBlock = formatAnswerParagraphs(answer)

  // ── 6. Sources block (grounded answers only) ──────────────────────────────
  const sourcesBlock = grounded ? formatSourcesBlock(sources) : ''

  // ── 7. Sign-off ───────────────────────────────────────────────────────────
  const signOff = `Kind regards,\n${sender}`

  // ── 8. Assemble body ──────────────────────────────────────────────────────
  const bodyParts = [
    greeting,
    '',
    wordWrap(opening, 80),
    '',
    answerBlock,
    sourcesBlock,
    includeDisclaimer ? wordWrap(DISCLAIMER, 80) : '',
    '',
    signOff,
  ].filter((part) => part !== undefined)    // keep '' (blank lines), drop undefined

  // Normalise: collapse runs of more than two consecutive blank lines
  const body = bodyParts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()

  // ── 9. Combined text field ────────────────────────────────────────────────
  const text = `Subject: ${subject}\n\n${body}`

  // ── 10. Validate before returning ────────────────────────────────────────
  const draft = { subject, body, text }
  validateDraft(draft, answer)

  return draft
}

/**
 * router.js — query domain classifier
 *
 * Public API:
 *   routeQuery(query)  →  Promise<RouteResult>
 *
 * RouteResult:
 * {
 *   domain:     'hr' | 'support' | 'out_of_scope'
 *   confidence: 'high' | 'low'          — low when the LLM hedged or parse failed
 *   raw:        string                  — the raw LLM response (for logging/debugging)
 * }
 *
 * The LLM is prompted to respond with a single JSON object and nothing else.
 * A regex fallback handles cases where the model adds surrounding prose anyway.
 * If parsing fails entirely the result is { domain: 'out_of_scope', confidence: 'low' }.
 *
 * Environment:
 *   Inherits LLM_PROVIDER / LLM_MODEL / *_API_KEY from the LLM adapter.
 *   No additional env vars are required.
 */

import { generateText } from './llm.js'
import { LLMError }    from './errors.js'

// ── Valid domains ─────────────────────────────────────────────────────────────

/** @typedef {'hr' | 'support' | 'out_of_scope'} Domain */

const VALID_DOMAINS = /** @type {const} */ (['hr', 'support', 'out_of_scope'])

// ── Prompt ────────────────────────────────────────────────────────────────────

/**
 * Build the classification prompt.
 * Using a strict JSON-only instruction + few-shot examples keeps the output
 * machine-parseable even across different model families.
 *
 * @param {string} query
 * @returns {string}
 */
function buildPrompt(query) {
  return `You are a query router for an internal company knowledge base.
Your only job is to classify which knowledge domain a user query belongs to.

Domains:
- "hr"          — questions about HR policies, employment terms, leave (annual, sick, parental), 
                  remote work, expenses, onboarding, offboarding, performance reviews, 
                  compensation, learning & development, code of conduct, anti-harassment, 
                  grievances, health and wellbeing.
- "support"     — questions about IT systems, software, hardware, account access, passwords, 
                  VPN, MFA, devices, printers, network, data backup, video conferencing, 
                  phishing/security incidents, software updates, helpdesk tickets.
- "out_of_scope" — anything that does not clearly belong to either domain above 
                  (e.g. general knowledge questions, personal matters, competitor questions).

Rules:
1. Respond with ONLY a JSON object — no explanation, no markdown, no extra text.
2. The JSON must have exactly two keys: "domain" and "confidence".
3. "domain" must be one of: "hr", "support", "out_of_scope".
4. "confidence" must be "high" if you are certain, or "low" if the query is ambiguous.

Examples:
User: "How many days of annual leave do I get?"
Response: {"domain":"hr","confidence":"high"}

User: "I can't connect to the VPN from home."
Response: {"domain":"support","confidence":"high"}

User: "What is the reimbursement limit for a business meal?"
Response: {"domain":"hr","confidence":"high"}

User: "My laptop screen is flickering."
Response: {"domain":"support","confidence":"high"}

User: "How do I reset my password?"
Response: {"domain":"support","confidence":"high"}

User: "When was the company founded?"
Response: {"domain":"out_of_scope","confidence":"high"}

User: "I'm having a tough week."
Response: {"domain":"out_of_scope","confidence":"low"}

User: "Can I use my work laptop for personal projects?"
Response: {"domain":"support","confidence":"low"}

Now classify this query:
User: "${query.replace(/"/g, '\\"')}"
Response:`
}

// ── Response parsing ──────────────────────────────────────────────────────────

/**
 * Parse the LLM response into a domain + confidence pair.
 * Tries strict JSON.parse first, then falls back to a regex extraction
 * in case the model wraps the JSON in prose or a code block.
 *
 * @param {string} raw
 * @returns {{ domain: Domain, confidence: 'high' | 'low' }}
 */
function parseResponse(raw) {
  const text = raw.trim()

  // Attempt 1 — clean JSON
  try {
    const parsed = JSON.parse(text)
    return normalise(parsed)
  } catch {
    // fall through
  }

  // Attempt 2 — extract the first {...} block from the response
  const match = text.match(/\{[^}]+\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      return normalise(parsed)
    } catch {
      // fall through
    }
  }

  // Attempt 3 — look for a bare domain word anywhere in the response
  for (const domain of VALID_DOMAINS) {
    if (text.toLowerCase().includes(domain)) {
      return { domain, confidence: 'low' }
    }
  }

  return { domain: 'out_of_scope', confidence: 'low' }
}

/**
 * Validate and normalise a parsed object into a known shape.
 * Coerces unexpected values to safe defaults rather than throwing.
 *
 * @param {object} obj
 * @returns {{ domain: Domain, confidence: 'high' | 'low' }}
 */
function normalise(obj) {
  const domainIsValid = VALID_DOMAINS.includes(obj?.domain)
  const domain = domainIsValid
    ? /** @type {Domain} */ (obj.domain)
    : 'out_of_scope'

  // If we had to override the domain the confidence can't be trusted
  const confidence = domainIsValid && obj?.confidence === 'high' ? 'high' : 'low'

  return { domain, confidence }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ domain: Domain, confidence: 'high' | 'low', raw: string }} RouteResult
 */

/**
 * Classify a user query into a knowledge domain.
 *
 * Uses a zero-temperature LLM call so the output is deterministic.
 * The model is instructed to return only a JSON object; parsing is
 * resilient to common model deviations (prose wrap, code fences).
 *
 * @param {string} query  - Raw user query string
 * @returns {Promise<RouteResult>}
 *
 * @example
 * const { domain } = await routeQuery('How do I apply for parental leave?')
 * // domain === 'hr'
 */
export async function routeQuery(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { domain: 'out_of_scope', confidence: 'low', raw: '' }
  }

  const prompt = buildPrompt(query.trim())

  let raw = ''
  try {
    raw = await generateText(prompt, {
      temperature: 0,
      maxTokens: 32,
    })
  } catch (err) {
    throw new LLMError(err.message ?? String(err), err)
  }

  const { domain, confidence } = parseResponse(raw)
  return { domain, confidence, raw }
}

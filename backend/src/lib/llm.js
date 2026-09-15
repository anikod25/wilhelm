/**
 * LLM adapter
 *
 * Single public API:
 *   generateText(prompt, options?) → Promise<string>
 *
 * Controlled entirely by environment variables:
 *   LLM_PROVIDER   = openai | gemini | local   (default: openai)
 *   LLM_MODEL      = model name passed to the provider
 *   LLM_BASE_URL   = base URL for local OpenAI-compatible servers (local only)
 *   OPENAI_API_KEY / GEMINI_API_KEY / LOCAL_API_KEY
 *
 * The rest of the app should only ever import generateText from this module.
 * No provider SDK should be imported anywhere else.
 */

import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function getModel(fallback) {
  return process.env.LLM_MODEL || fallback
}

// ── Provider implementations ─────────────────────────────────────────────────

/**
 * OpenAI path — uses the official OpenAI SDK against api.openai.com.
 * @param {string} prompt
 * @param {object} opts
 * @returns {Promise<string>}
 */
async function generateOpenAI(prompt, opts) {
  const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })

  const response = await client.chat.completions.create({
    model: getModel('gpt-4o-mini'),
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens,
    ...opts.extra,
  })

  return response.choices[0].message.content ?? ''
}

/**
 * Gemini path — uses the @google/genai SDK.
 * @param {string} prompt
 * @param {object} opts
 * @returns {Promise<string>}
 */
async function generateGemini(prompt, opts) {
  const ai = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') })

  const response = await ai.models.generateContent({
    model: getModel('gemini-2.0-flash'),
    contents: prompt,
    config: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens,
      ...opts.extra,
    },
  })

  return response.text ?? ''
}

/**
 * Local path — uses the OpenAI SDK pointed at LLM_BASE_URL.
 * Works with Ollama, LM Studio, vLLM, llama.cpp server, or any
 * other OpenAI-compatible endpoint.  No real API key is needed;
 * the SDK requires a non-empty string so we default to "local".
 * @param {string} prompt
 * @param {object} opts
 * @returns {Promise<string>}
 */
async function generateLocal(prompt, opts) {
  const baseURL = requireEnv('LLM_BASE_URL')
  const apiKey = process.env.LOCAL_API_KEY || 'local'

  const client = new OpenAI({ baseURL, apiKey })

  const response = await client.chat.completions.create({
    model: getModel('llama3'),
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens,
    ...opts.extra,
  })

  return response.choices[0].message.content ?? ''
}

// ── Public API ────────────────────────────────────────────────────────────────

const PROVIDERS = {
  openai: generateOpenAI,
  gemini: generateGemini,
  local: generateLocal,
}

/**
 * Generate text from a plain-string prompt.
 *
 * @param {string} prompt - The user/system prompt.
 * @param {object} [options]
 * @param {number} [options.temperature]   - Sampling temperature (0–2).
 * @param {number} [options.maxTokens]     - Max tokens in the response.
 * @param {object} [options.extra]         - Provider-specific overrides merged
 *                                          into the underlying SDK call.
 * @returns {Promise<string>} Plain text response from the model.
 */
export async function generateText(prompt, options = {}) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()

  const handler = PROVIDERS[provider]
  if (!handler) {
    throw new Error(
      `Unknown LLM_PROVIDER "${provider}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`
    )
  }

  return handler(prompt, options)
}

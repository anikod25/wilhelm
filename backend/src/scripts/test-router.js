/**
 * test-router.js
 *
 * Runs a set of representative queries through routeQuery() and prints
 * a formatted results table for manual review.  Not a unit test —
 * no assertions are made.  The intent is to let a human eyeball whether
 * the router is making sensible calls.
 *
 * Usage:
 *   node src/scripts/test-router.js [--verbose]
 *
 * Requires a configured .env (LLM_PROVIDER + the corresponding API key).
 */

import 'dotenv/config'
import { routeQuery } from '../lib/router.js'

// ── Test queries ──────────────────────────────────────────────────────────────

/**
 * Each entry has:
 *   query    — the raw user string
 *   category — human label for the expected bucket (used only in display)
 *   expect   — the domain you'd expect a well-tuned router to return
 */
const TEST_QUERIES = [
  // ── Clear HR ──────────────────────────────────────────────────────────────
  {
    category: 'HR (clear)',
    query: 'How many days of annual leave am I entitled to?',
    expect: 'hr',
  },
  {
    category: 'HR (clear)',
    query: "What's the process for submitting a parental leave request?",
    expect: 'hr',
  },
  {
    category: 'HR (clear)',
    query: 'Can I carry over unused holiday into next year?',
    expect: 'hr',
  },
  {
    category: 'HR (clear)',
    query: 'What is the maximum daily meal allowance when travelling for work?',
    expect: 'hr',
  },

  // ── Clear support ─────────────────────────────────────────────────────────
  {
    category: 'Support (clear)',
    query: "I forgot my password and can't log in to my account.",
    expect: 'support',
  },
  {
    category: 'Support (clear)',
    query: 'How do I connect to the VPN when working from a coffee shop?',
    expect: 'support',
  },
  {
    category: 'Support (clear)',
    query: 'My laptop is making a loud fan noise and running really slowly.',
    expect: 'support',
  },

  // ── Ambiguous / cross-domain ──────────────────────────────────────────────
  {
    category: 'Ambiguous',
    query: 'Am I allowed to use my work computer for a side project in the evenings?',
    expect: 'support', // touches IT acceptable-use policy — reasonable either way
  },
  {
    category: 'Ambiguous',
    query: 'I received a suspicious email asking for my login details — what should I do?',
    expect: 'support', // phishing is IT security but could feel HR to some users
  },
  {
    category: 'Ambiguous',
    query: 'My manager keeps messaging me outside of working hours. Is there a policy?',
    expect: 'hr', // could be wellbeing/code-of-conduct or IT acceptable-use
  },

  // ── Clearly out of scope ──────────────────────────────────────────────────
  {
    category: 'Out of scope',
    query: "What's the capital of France?",
    expect: 'out_of_scope',
  },
  {
    category: 'Out of scope',
    query: 'Write me a Python function to sort a list.',
    expect: 'out_of_scope',
  },
]

// ── Display helpers ───────────────────────────────────────────────────────────

const DOMAIN_COLOUR = {
  hr:           '\x1b[32m',   // green
  support:      '\x1b[34m',   // blue
  out_of_scope: '\x1b[33m',   // yellow
}
const RESET   = '\x1b[0m'
const BOLD    = '\x1b[1m'
const DIM     = '\x1b[2m'
const RED     = '\x1b[31m'
const GREEN   = '\x1b[32m'

function coloured(domain, text) {
  return `${DOMAIN_COLOUR[domain] ?? ''}${text}${RESET}`
}

function padEnd(str, len) {
  // visible-length pad (strip ANSI codes for measurement)
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '')
  return str + ' '.repeat(Math.max(0, len - visible.length))
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const verbose = process.argv.includes('--verbose')

  console.log()
  console.log(`${BOLD}Wilhelm — router test${RESET}`)
  console.log(`${DIM}Provider: ${process.env.LLM_PROVIDER ?? 'openai'}  Model: ${process.env.LLM_MODEL ?? 'gpt-4o-mini'}${RESET}`)
  console.log()

  // Header row
  const COL = { cat: 20, query: 50, got: 16, conf: 6, match: 6 }
  const header =
    padEnd(`${BOLD}Category${RESET}`,      COL.cat)   + '  ' +
    padEnd(`${BOLD}Query${RESET}`,         COL.query) + '  ' +
    padEnd(`${BOLD}Domain${RESET}`,        COL.got)   + '  ' +
    padEnd(`${BOLD}Conf${RESET}`,          COL.conf)  + '  ' +
    `${BOLD}Match?${RESET}`
  console.log(header)
  console.log('─'.repeat(120))

  let passed = 0
  let failed = 0

  for (const tc of TEST_QUERIES) {
    process.stdout.write(`${DIM}  routing…${RESET}\r`)

    let result
    try {
      result = await routeQuery(tc.query)
    } catch (err) {
      console.error(`  ERROR: ${err.message}`)
      failed++
      continue
    }

    const { domain, confidence, raw } = result
    const matched = domain === tc.expect
    if (matched) passed++; else failed++

    const matchStr = matched
      ? `${GREEN}  ✓${RESET}`
      : `${RED}  ✗ (expected ${tc.expect})${RESET}`

    const row =
      padEnd(DIM + tc.category + RESET,           COL.cat)   + '  ' +
      padEnd(truncate(tc.query, COL.query),        COL.query) + '  ' +
      padEnd(coloured(domain, domain),             COL.got)   + '  ' +
      padEnd(DIM + confidence + RESET,             COL.conf)  + '  ' +
      matchStr

    // Clear the "routing…" line then print the result
    process.stdout.write('\r\x1b[K')
    console.log(row)

    if (verbose) {
      console.log(`${DIM}         raw: ${raw}${RESET}`)
    }
  }

  console.log('─'.repeat(120))
  console.log()
  console.log(
    `${BOLD}Results:${RESET}  ` +
    `${GREEN}${passed} matched${RESET}  /  ` +
    (failed > 0 ? `${RED}${failed} differed${RESET}` : `${DIM}0 differed${RESET}`) +
    `  ${DIM}(out of ${TEST_QUERIES.length})${RESET}`
  )
  console.log()
  console.log(
    `${DIM}Note: "differed" means the result didn't match the expected label in this` +
    ` script — not necessarily wrong.\nAmbiguous queries may legitimately land in` +
    ` either adjacent domain. Review manually.${RESET}`
  )
  console.log()
}

main().catch((err) => {
  console.error('\n❌', err.message)
  process.exit(1)
})

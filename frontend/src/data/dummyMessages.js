/**
 * Seed messages shown on first load so the demo has visible content
 * without needing a live backend connection.
 */

/**
 * @typedef {{
 *   id:               string,
 *   role:             'user' | 'assistant',
 *   content:          string,
 *   domain?:          string,
 *   stage?:           string,
 *   grounded?:        boolean,
 *   sources?:         string[],
 *   sourceDocs?:      Array<{ filename: string, filePath: string, heading: string, domain: string }>,
 *   format?:          string,
 *   formattedPayload?: string | null,
 *   downloadUrl?:     string | null,
 *   downloadName?:    string | null,
 *   timestamp:        number,
 * }} Message
 */

/** @type {Message[]} */
export const DUMMY_MESSAGES = [
  {
    id:        '1',
    role:      'assistant',
    content:   "Hi! I'm Wilhelm, your internal knowledge-base assistant. Ask me anything about HR policies or IT support.",
    timestamp: Date.now() - 60_000 * 5,
  },
  {
    id:        '2',
    role:      'user',
    content:   'How many days of annual leave am I entitled to?',
    timestamp: Date.now() - 60_000 * 4,
  },
  {
    id:        '3',
    role:      'assistant',
    content:
      'Full-time employees accrue 20 days of paid annual leave per calendar year, ' +
      'pro-rated for part-time staff. Leave accrues from your first day of employment ' +
      'at a rate of 1.67 days per month in your first year.',
    domain:   'hr',
    stage:    'answered',
    grounded: true,
    sources:  [
      'hr-policies › 01-annual-leave › Entitlement',
      'hr-policies › 01-annual-leave › Accrual',
    ],
    sourceDocs: [
      { filename: '01-annual-leave.md', filePath: 'data/hr-policies/01-annual-leave.md', heading: 'Entitlement',    domain: 'hr-policies' },
      { filename: '01-annual-leave.md', filePath: 'data/hr-policies/01-annual-leave.md', heading: 'Accrual',        domain: 'hr-policies' },
    ],
    timestamp: Date.now() - 60_000 * 3,
  },
  {
    id:        '4',
    role:      'user',
    content:   'And how do I reset my VPN if it stops connecting?',
    timestamp: Date.now() - 60_000 * 2,
  },
  {
    id:        '5',
    role:      'assistant',
    content:
      "Open the VPN client and click Disconnect, then Reconnect. If that doesn't work, " +
      'try reinstalling the client from intranet.company.com/it/vpn. For persistent issues ' +
      'contact the IT Helpdesk at ext. 4357 with the client log file (Help → Export Logs).',
    domain:   'support',
    stage:    'answered',
    grounded: true,
    sources:  [
      'it-support › 02-vpn-access › Troubleshooting',
      'it-support › 02-vpn-access › Reinstalling the client',
    ],
    sourceDocs: [
      { filename: '02-vpn-access.md', filePath: 'data/it-support/02-vpn-access.md', heading: 'Troubleshooting',        domain: 'it-support' },
      { filename: '02-vpn-access.md', filePath: 'data/it-support/02-vpn-access.md', heading: 'Reinstalling the client', domain: 'it-support' },
    ],
    timestamp: Date.now() - 60_000 * 1,
  },
]

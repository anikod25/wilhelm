/**
 * Seed messages used while the backend is not yet wired up.
 * Replace with real API responses once the /api/chat endpoint is live.
 */

/** @typedef {{ id: string, role: 'user'|'assistant', content: string, domain?: string, stage?: string, sources?: string[], timestamp: number }} Message */

/** @type {Message[]} */
export const DUMMY_MESSAGES = [
  {
    id:        '1',
    role:      'assistant',
    content:   'Hi! I\'m Wilhelm, your internal knowledge-base assistant. Ask me anything about HR policies or IT support.',
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
    content:   'Full-time employees accrue 20 days of paid annual leave per calendar year, pro-rated for part-time staff. Leave accrues from your first day of employment at a rate of 1.67 days per month in your first year.',
    domain:    'hr',
    stage:     'answered',
    sources:   ['hr-policies › 01-annual-leave › Entitlement'],
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
    content:   'Open the VPN client and click Disconnect, then Reconnect. If that doesn\'t work, try reinstalling the client from intranet.company.com/it/vpn. For persistent issues contact the IT Helpdesk at ext. 4357 with the client log file (Help → Export Logs).',
    domain:    'support',
    stage:     'answered',
    sources:   ['it-support › 02-vpn-access › Troubleshooting'],
    timestamp: Date.now() - 60_000 * 1,
  },
]

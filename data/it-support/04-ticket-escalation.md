# IT Ticket Escalation Process

**Category:** Helpdesk Operations  
**Last updated:** January 2024  
**Owner:** IT Helpdesk Manager

## Ticket Priority Levels

| Priority | Definition | First Response SLA | Resolution SLA |
|----------|-----------|-------------------|----------------|
| P1 – Critical | Production system down; business-wide impact; data breach suspected | 15 minutes | 4 hours |
| P2 – High | Significant service degradation; one team or department blocked | 1 hour | 8 hours |
| P3 – Medium | Individual user impacted but has a workaround; non-urgent access requests | 4 hours | 2 business days |
| P4 – Low | General questions, how-to requests, minor cosmetic issues | 8 hours | 5 business days |

SLAs apply during business hours (8 AM – 6 PM, Monday to Friday). P1 and P2 tickets trigger on-call response outside business hours.

## How to Submit a Ticket

- **Portal:** helpdesk.company.com (preferred — allows file attachments and status tracking)
- **Email:** helpdesk@company.com (automatically creates a P3 ticket)
- **Phone:** ext. 4357 — use for P1 and P2 issues only; phone creates a ticket automatically

When submitting, include:
- A clear description of the issue
- Steps you have already tried
- Any error messages (screenshots preferred)
- Business impact (who is affected and how)

## Escalation Path

### Tier 1 — Helpdesk Analyst
Handles password resets, account unlocks, standard software installs, general how-to questions, and routine hardware swaps. Resolves approximately 80% of tickets.

### Tier 2 — Systems / Infrastructure Engineer
Handles complex application issues, server-side problems, network configuration, and security incidents. Tier 1 escalates to Tier 2 when:
- The issue cannot be resolved within the Tier 1 SLA
- The issue requires elevated system access
- The issue affects more than one user

### Tier 3 — Vendor / Specialist
Engaged for issues requiring vendor support (e.g., SaaS platform bugs, hardware warranty claims) or specialist knowledge (e.g., cloud infrastructure, security forensics).

## Escalating a Ticket Yourself

If you feel your ticket is not being resolved within the SLA:

1. Add a comment to the ticket noting the SLA breach
2. If no response within two hours, email the IT Helpdesk Manager at it-manager@company.com with the ticket number
3. For business-critical issues, call ext. 4357 and state that you are escalating

**Do not** create duplicate tickets — it resets the SLA clock and slows resolution.

## P1 Incident Protocol

For P1 incidents:
1. Call ext. 4357 immediately — do not email
2. A P1 bridge call is opened within 15 minutes with the on-call engineer and IT Manager
3. Status updates are posted to the #it-incidents Slack channel every 30 minutes
4. A post-incident review is completed within two business days of resolution

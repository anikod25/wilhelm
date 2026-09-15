# Account Lockout Troubleshooting

**Category:** Account Access  
**Last updated:** January 2024  
**Owner:** IT Helpdesk

## Why Accounts Get Locked

Accounts are automatically locked after **5 consecutive failed sign-in attempts**. This is a security control — it prevents brute-force attacks. The lockout applies to:

- Your main company account (email, Slack, Google Workspace)
- VPN
- Any application using single sign-on (SSO)

## Unlocking Your Account

### Self-Service Unlock

If your account is locked and you remember your password:

1. Go to **account.company.com/unlock**
2. Enter your email address and complete MFA verification
3. Your account will be unlocked immediately

### Helpdesk Unlock

If self-service is not available (e.g., you also do not have MFA access):

1. Call the IT Helpdesk at ext. 4357 or submit a ticket at helpdesk.company.com
2. Provide your employee ID and answer the identity verification questions
3. IT will unlock the account within 15 minutes during business hours

## Common Causes and Fixes

| Cause | Fix |
|-------|-----|
| Caps Lock was on | Turn off Caps Lock and try again with your correct password |
| Saved password in browser is outdated | Clear the saved password, then type it manually |
| Mobile device reconnecting with old password | Update the password on your phone's mail/calendar app after a reset |
| Shared machine still using old credentials | Sign out of all sessions via account.company.com/sessions |

After changing your password, make sure to update it in:
- Your phone (mail, calendar, Slack)
- Any automation scripts or tools that use your credentials (replace with a service account instead — see Software Access Request guide)

## Repeated Lockouts

If your account locks repeatedly without you causing it, someone may be attempting to access your account. Report this to IT Security immediately at security@company.com or ext. 4358. Change your password and review active sessions at **account.company.com/sessions**.

## Service Account Lockouts

Service accounts used in scripts or integrations should not use personal credentials. If a service account is locked:

1. Submit a P2 ticket immediately if it is causing a service disruption
2. Include the service account name and which systems are affected
3. IT will unlock and investigate the cause (usually an outdated secret in a deployment config)

Service accounts should use long randomly generated passwords stored in the company secrets manager, rotated at least every 90 days.

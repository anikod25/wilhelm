# Wi-Fi and Network Access Guide

**Category:** Network  
**Last updated:** January 2024  
**Owner:** IT Infrastructure

## Office Wi-Fi Networks

| Network name | Who it's for | Access |
|--------------|-------------|--------|
| CorpNet | All employees | Sign in with your company account (SSO) |
| CorpNet-Guest | Visitors and contractors | Ask reception for the daily guest code |
| CorpNet-IOT | Smart office devices (printers, displays) | Managed by IT — employees do not connect to this |

**Do not share the CorpNet credentials or SSO session with guests.** Use the Guest network for visitors.

## Connecting to CorpNet

1. Select **CorpNet** from your Wi-Fi menu
2. When prompted, enter your company email and password
3. Approve the MFA push notification
4. Your device is registered automatically — you will not need to sign in again on the same device

If you are prompted to accept a security certificate, verify the issuer reads **corp-cert.company.com** before accepting. Contact IT if you are unsure.

## Wired Network (Ethernet)

Ethernet ports are available at all desks and meeting rooms. Plug in your USB-C adapter — no authentication is required on managed devices. If you get a "limited connectivity" message on an unmanaged device, submit a ticket for a port to be enabled.

## Guest Wi-Fi

The Guest network is isolated from the corporate network and provides internet access only. Guests should be escorted by an employee who is responsible for their access. Guest codes rotate daily — collect a fresh code from reception each morning.

## Working from a Coffee Shop or Public Wi-Fi

Public Wi-Fi is untrusted. You **must** connect to the company VPN before accessing any work systems. See the VPN Access Guide for setup instructions.

If you cannot connect to the VPN, do not access work email, code, or any company data until you have a trusted connection.

## Network Drives (Shared File Storage)

Shared network drives are available for teams that need a shared file space outside Google Drive (e.g., large media files, legacy file shares):

- Map a drive: Connect via VPN, then map `\\fileserver.company.internal\<team-share>`
- On macOS: Finder → Go → Connect to Server → `smb://fileserver.company.internal/<team-share>`
- Credentials: your standard company account

Access to specific shares is provisioned on request — submit a ticket with your manager's approval.

## Network Troubleshooting

| Issue | Steps |
|-------|-------|
| Cannot connect to CorpNet | Forget the network and reconnect; clear MFA cache if SSO loop occurs |
| Connected to Wi-Fi but no internet | Check if VPN is interfering; disconnect VPN, test, reconnect |
| Very slow speeds | Try wired connection; report to IT if persistent (floor and desk number helps) |
| Cannot reach internal sites from home | Ensure VPN is connected; try reconnecting the VPN |

For persistent issues, run a speed test (speedtest.net) and include the results in your helpdesk ticket.

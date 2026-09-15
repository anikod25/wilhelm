# VPN Access Guide

**Category:** Network Access  
**Last updated:** January 2024  
**Owner:** IT Infrastructure

## What the VPN Is For

The company VPN encrypts your internet traffic and routes it through the corporate network, giving you secure access to internal systems (code repositories, internal dashboards, on-premise databases) that are not reachable from the public internet.

VPN use is **mandatory** when:
- Accessing any internal system from outside the office
- Working on any public or shared Wi-Fi network
- Handling customer data or Confidential-classified company data remotely

## Getting Access

VPN access is provisioned automatically for all employees on their first day. If you do not have the VPN client installed, submit a ticket at helpdesk.company.com with the subject "VPN client install request" and include your device model and operating system version.

## Installing the Client

1. Go to **intranet.company.com/it/vpn**
2. Download the installer for your OS (Windows, macOS, or Linux)
3. Run the installer — no admin password is required on company-managed devices
4. Sign in with your company email and password when prompted
5. Approve the MFA push notification on your registered device

## Connecting

1. Open the VPN client (look for the shield icon in your system tray or menu bar)
2. Select the **Corporate – Standard** profile
3. Click **Connect**
4. The status indicator will turn green when connected

For access to production infrastructure, select the **Corporate – Production** profile. This profile requires a separate approval — see "Requesting Production Access" below.

## Requesting Production Access

Production VPN access is restricted to engineers with a business need. To request it:

1. Submit a ticket at helpdesk.company.com with subject "Production VPN access request"
2. Include your manager's name and a brief justification
3. Your manager will receive an approval email — access is granted within one business day of approval

## Troubleshooting

| Symptom | Action |
|---------|--------|
| Client fails to connect | Check your internet connection, then restart the client |
| MFA push not received | Check the Authenticator app manually; use the one-time code if needed |
| Connected but cannot reach internal site | Check the site URL; try disconnecting and reconnecting |
| "Certificate error" message | Your client may be out of date — reinstall from the intranet link above |

If the issue persists, contact the IT Helpdesk at ext. 4357 with the client log file (Help → Export Logs in the client menu).

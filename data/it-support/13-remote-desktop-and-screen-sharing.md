# Remote Desktop and Screen Sharing Guide

**Category:** Remote Access  
**Last updated:** January 2024  
**Owner:** IT Helpdesk

## Use Cases

| Scenario | Recommended tool |
|----------|-----------------|
| IT support agent helping you remotely | Company Remote Support Tool (see below) |
| Sharing your screen in a meeting | Zoom screen share |
| Accessing your office desktop from home | Chrome Remote Desktop (approved use only) |
| Accessing a server or VM | SSH / RDP via VPN (engineers only) |

## IT Remote Support Sessions

When you have a helpdesk ticket open and the technician needs to see your screen, they will initiate a remote support session:

1. The technician will send you a session link via the helpdesk ticket or Slack
2. Click the link — it will open the company-approved remote support tool
3. You will see a prompt asking you to grant screen-sharing and control permission
4. **Verify the technician's name** matches the person who raised your ticket before accepting
5. You can see everything the technician does on your screen at all times
6. Click **End Session** at any time to disconnect

**Never accept remote access requests from unknown senders or unsolicited phone calls.** Legitimate IT staff will only initiate sessions through the helpdesk ticket system.

## Chrome Remote Desktop (Personal Use)

Chrome Remote Desktop allows you to access your work laptop from another device when you are away from the office. It is approved for use by employees who need access to applications only available on their work machine.

### Setup (on your work laptop)

1. Go to **remotedesktop.google.com/access**
2. Click **Set up remote access**
3. Download and install the Chrome Remote Desktop Host
4. Set a PIN of at least 6 digits — use a strong PIN, not something obvious
5. The device will appear in your remote desktop list when the laptop is on and connected to the internet

### Connecting remotely

1. From another device, go to **remotedesktop.google.com/access**
2. Sign in with your company Google account
3. Select your work laptop and enter the PIN

**Security requirements:**
- Your work laptop must be encrypted and have its screen locked
- Do not leave an active remote session unattended
- Disconnect the session when you are finished, do not just close the browser tab

## RDP / SSH Access for Engineers

Engineers needing RDP or SSH access to company servers must:
1. Be connected to the VPN (Corporate – Production profile for production servers)
2. Use SSH key authentication — password-based SSH is disabled on all company servers
3. SSH keys must be rotated at least annually and stored in the company secrets manager

RDP is available for Windows servers where SSH is not applicable. Contact IT Security for RDP credentials — they are not distributed by default.

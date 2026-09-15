# Software Updates and Patching Policy

**Category:** Security & Maintenance  
**Last updated:** January 2024  
**Owner:** IT Security

## Why Updates Matter

Software updates fix security vulnerabilities. Unpatched devices are one of the most common entry points for attackers. This is not optional maintenance — it is a security requirement.

## OS and System Updates

Company laptops are managed via an MDM (Mobile Device Management) platform that pushes OS updates automatically.

**Timeline:**
- **Critical security patches** — deployed within 72 hours of release. A system notification will prompt you to restart. Do not postpone more than once.
- **Standard OS updates** — deployed within 14 days. You will receive a notification with a scheduled maintenance window.
- **Major OS upgrades** — tested by IT before rollout; deployed within 30 days of IT sign-off. You will receive at least one week's notice.

If you dismiss a critical patch notification, IT will enforce the restart after 24 hours to protect the company network.

## Application Updates

### Managed Applications
Applications distributed through the company's software management tool (Jamf for macOS, Intune for Windows) are updated automatically in the background. No action is required from you.

### Self-Installed Applications
If you have installed approved software yourself (e.g., from the Software Catalogue):
- Keep auto-update enabled where available
- Check for updates manually at least once a week for high-risk tools (browsers, code editors, Docker)
- Report outdated software you cannot update yourself to the IT Helpdesk

### Browser Updates
Company-managed Chrome updates automatically. If you see a **Relaunch to update** prompt in the top-right corner of Chrome, relaunch the browser as soon as practical — do not leave it pending for more than 24 hours.

## Checking Your Patch Status

You can check whether your device is compliant at **compliance.company.com/my-device**. A green status means your device is up to date. A red status means action is required — follow the instructions on the page or contact IT.

IT runs a compliance report weekly. Devices that are non-compliant for more than five days will be contacted directly; devices non-compliant for more than 10 days may have network access restricted until patched.

## Requesting a Patch Deferral

If an update is incompatible with a critical tool you need for work, submit a ticket with:
- The update version and the affected application
- Business justification for deferral
- A proposed alternative timeline

Deferrals are only granted for documented compatibility issues and are time-limited (maximum 30 days). Security patches cannot be deferred.

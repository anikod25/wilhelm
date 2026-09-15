# Data Backup and Recovery Guide

**Category:** Data Management  
**Last updated:** January 2024  
**Owner:** IT Infrastructure

## What Is Backed Up Automatically

The following systems have automated backups managed by IT. You do not need to do anything for these:

| System | Backup frequency | Retention |
|--------|-----------------|-----------|
| Google Drive (company files) | Continuous (Google Vault) | 5 years |
| Email (Gmail) | Continuous (Google Vault) | 5 years |
| Production databases | Every 6 hours | 30 days |
| Code repositories (GitHub) | Daily snapshot | 90 days |
| HR portal data | Nightly | 1 year |

## What Is NOT Automatically Backed Up

- **Local files on your laptop** — anything saved to your Desktop, Documents, or Downloads folder that is not synced to Google Drive
- **Browser bookmarks** (use Chrome's profile sync or export manually)
- **Local application data** (IDE settings, terminal configs) — use dotfiles repos or tool-specific sync features

**Store all work files in Google Drive, not your local hard drive.** If your laptop is lost, stolen, or fails, local-only files cannot be recovered.

## Syncing to Google Drive

1. Install the **Google Drive desktop app** (pre-installed on company laptops; reinstall from intranet if missing)
2. Sign in with your company account
3. In the app settings, add your local **Documents** folder as a mirrored folder
4. Files in mirrored folders are available both locally and in Drive and are backed up continuously

## Recovering a Deleted or Overwritten File

### From Google Drive

1. Go to drive.google.com
2. Right-click the file or folder → **View versions** (for overwritten files) or go to **Trash** (for deleted files)
3. Files remain in Trash for 30 days; versions are kept for 180 days
4. Click **Restore** to recover

### From Gmail

1. Go to mail.google.com → **Trash**
2. Deleted emails are retained for 30 days
3. For emails deleted more than 30 days ago, submit a Google Vault recovery request via helpdesk.company.com

### Requesting IT-Assisted Recovery

For files deleted more than 30 days ago, database data, or large-scale recovery needs:

1. Submit a ticket at helpdesk.company.com with category **Data Recovery**
2. Include: what was lost, approximate date of loss, business impact
3. IT will assess feasibility against available backups — recovery is not guaranteed for all scenarios
4. Recovery requests are prioritised by business impact; allow 1–5 business days

## Laptop Failure Recovery

If your laptop fails unexpectedly:

1. IT will provide a replacement or loan device (see Hardware Request guide)
2. Sign in to the new device with your company account — Drive, email, and browser profile restore automatically
3. Reinstall specialist applications from the Software Catalogue at intranet.company.com/it/software
4. Local-only files (if any) may require disk extraction by IT — not always possible if the drive has failed

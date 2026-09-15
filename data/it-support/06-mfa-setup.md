# Multi-Factor Authentication (MFA) Setup Guide

**Category:** Account Security  
**Last updated:** January 2024  
**Owner:** IT Security

## What Is MFA?

Multi-factor authentication adds a second verification step when you sign in. Even if someone obtains your password, they cannot access your account without also having your second factor. MFA is mandatory for all company accounts.

## Supported MFA Methods

| Method | Security level | Recommended |
|--------|---------------|-------------|
| Authenticator app (TOTP) | High | ✅ Yes |
| Hardware security key (FIDO2/YubiKey) | Very high | ✅ Yes (engineers with production access) |
| SMS one-time code | Medium | ⚠️ Fallback only |
| Email one-time code | Medium | ⚠️ Fallback only |

SMS and email are available as fallback methods only. Do not use them as your primary MFA method if you can avoid it.

## Setting Up an Authenticator App

1. Install an authenticator app on your phone:
   - **Recommended:** Google Authenticator, Authy, or Microsoft Authenticator
2. Go to **account.company.com/security**
3. Under **Two-factor authentication**, click **Add authenticator app**
4. Open your authenticator app and tap the **+** or **Scan QR code** button
5. Scan the QR code displayed on screen
6. Enter the 6-digit code shown in the app to confirm setup
7. Save your **backup codes** in your password manager — these allow access if you lose your phone

## Setting Up a Hardware Security Key

1. Submit a request at helpdesk.company.com with subject "Hardware security key request" — keys are provided free of charge to all engineers
2. When the key arrives, go to **account.company.com/security**
3. Under **Security keys**, click **Add security key**
4. Follow the browser prompts and insert your key when asked
5. Register a backup method (authenticator app) in case you lose the key

## Registering a Backup Method

Always register at least two MFA methods. To add a backup:
1. Sign in at **account.company.com/security**
2. Under **Two-factor authentication**, click **Add method**
3. Follow the prompts for your chosen backup type

## Lost Phone or Device

If you lose your primary MFA device:
1. Use a backup code (from your password manager) to sign in
2. Immediately go to **account.company.com/security** and remove the lost device
3. Set up MFA on your new device before removing the backup codes

If you do not have backup codes, contact the IT Helpdesk at ext. 4357. Identity verification will be required before an MFA reset is performed.

# Push Notifications Migration Guide

This document describes the migration from VAPID-based Web Push to OneSignal/FCM.

## Overview

The application has been migrated from VAPID (web-push library) to support both **OneSignal** and **Firebase Cloud Messaging (FCM)** as push notification providers. Both providers are available behind a feature flag.

## Feature Flag

Set the `PUSH_NOTIFICATION_PROVIDER` environment variable to choose the provider:
- `onesignal` (default) - Uses OneSignal Web Push
- `fcm` - Uses Firebase Cloud Messaging

## Files Changed

### Backend Changes

1. **`backend/src/utils/pushNotifications.js`** - COMPLETELY REWRITTEN
   - Removed: VAPID/web-push implementation
   - Added: OneSignal REST API and FCM Admin SDK support
   - Feature flag support for provider selection

2. **`backend/src/models/User.js`** - UPDATED
   - Added: `notificationProvider` field (enum: 'onesignal', 'fcm')
   - Added: `oneSignalUserId` field
   - Added: `fcmTokens` array (supports multiple devices)
   - Kept: `pushSubscription` field (deprecated, for backward compatibility)

3. **`backend/src/routes/players.js`** - UPDATED
   - Updated: `/push-subscription` endpoint to support both providers
   - Added: `/push-subscription/status` endpoint
   - Added: `DELETE /push-subscription` endpoint
   - Updated: `/test-push` endpoint to use new system
   - Deprecated: `/vapid-public-key` endpoint (returns 410)

4. **`backend/src/routes/matches.js`** - UPDATED
   - Updated: `notifyNearbyPlayers()` function to use new push notification system
   - Supports both OneSignal and FCM

5. **`backend/package.json`** - UPDATED
   - Removed: `web-push` dependency
   - Added: `firebase-admin` dependency

### Frontend Changes

1. **`frontend/src/lib/notifications.ts`** - NEW FILE
   - Complete notification service implementation
   - Supports OneSignal Web SDK and Firebase Web SDK
   - Consent flow helpers

2. **`frontend/src/pages/NotificationSettings.tsx`** - NEW FILE
   - New UI page for managing notification settings
   - Shows current subscription status
   - Enable/disable notifications
   - Test notification button

3. **`frontend/src/pages/PlayerProfile.tsx`** - UPDATED
   - Removed: All VAPID subscription logic
   - Removed: `urlBase64ToUint8Array()` helper function
   - Added: Link to Notification Settings page
   - Simplified: `requestLocationAndSubscribe()` only handles location now

4. **`frontend/src/App.tsx`** - UPDATED
   - Added: Route for `/notification-settings`

5. **`frontend/src/sw.js`** - UNCHANGED
   - Kept for PWA precaching functionality
   - OneSignal and FCM use their own service workers

6. **`frontend/public/OneSignalSDKWorker.js`** - NEW FILE
   - Required OneSignal service worker (must be at root)

7. **`frontend/public/OneSignalSDKUpdaterWorker.js`** - NEW FILE
   - Required OneSignal updater worker (must be at root)

8. **`frontend/public/firebase-messaging-sw.js`** - NEW FILE
   - Required FCM service worker (must be at root)
   - Note: Firebase config needs to be set in this file or loaded dynamically

9. **`frontend/package.json`** - UPDATED
   - Added: `firebase` dependency

10. **`frontend/src/types.ts`** - MAY NEED UPDATE
    - `PushSubscriptionJSON` type is now deprecated
    - Consider adding types for new notification provider fields

## Environment Variables

### Backend (.env)

#### For OneSignal:
```env
PUSH_NOTIFICATION_PROVIDER=onesignal
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

#### For FCM:
```env
PUSH_NOTIFICATION_PROVIDER=fcm
# Option 1: JSON string directly in .env
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"..."}

# Option 2: Path to credentials file
FIREBASE_ADMIN_CREDENTIALS_PATH=./path/to/service-account-key.json
```

**Remove these VAPID variables (no longer needed):**
```env
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# VAPID_SUBJECT=...
```

### Frontend (.env or .env.local)

#### For OneSignal:
```env
VITE_PUSH_NOTIFICATION_PROVIDER=onesignal
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
```

#### For FCM:
```env
VITE_PUSH_NOTIFICATION_PROVIDER=fcm
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

## Setup Instructions

### Option A: OneSignal Setup

1. **Create OneSignal Account**
   - Go to https://onesignal.com
   - Create a new account or log in
   - Create a new Web Push app

2. **Get Credentials**
   - App ID: Found in Settings → Keys & IDs
   - REST API Key: Found in Settings → Keys & IDs

3. **Configure Backend**
   ```env
   PUSH_NOTIFICATION_PROVIDER=onesignal
   ONESIGNAL_APP_ID=your_app_id
   ONESIGNAL_REST_API_KEY=your_rest_api_key
   ```

4. **Configure Frontend**
   ```env
   VITE_PUSH_NOTIFICATION_PROVIDER=onesignal
   VITE_ONESIGNAL_APP_ID=your_app_id
   ```

5. **Service Workers**
   - OneSignalSDKWorker.js and OneSignalSDKUpdaterWorker.js must be at the root of your domain
   - They are already in `frontend/public/` and will be copied to `dist/` during build

### Option B: Firebase Cloud Messaging Setup

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create a new project or use existing
   - Add a Web app to your project

2. **Get Firebase Config**
   - Go to Project Settings → General → Your apps
   - Copy the Firebase configuration object

3. **Generate VAPID Key**
   - Go to Project Settings → Cloud Messaging → Web configuration
   - Generate a Web Push certificate (VAPID key)

4. **Download Service Account Key**
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely

5. **Configure Backend**
   ```env
   PUSH_NOTIFICATION_PROVIDER=fcm
   FIREBASE_ADMIN_CREDENTIALS_PATH=./path/to/service-account-key.json
   # OR
   FIREBASE_ADMIN_CREDENTIALS='{"type":"service_account",...}'
   ```

6. **Configure Frontend**
   ```env
   VITE_PUSH_NOTIFICATION_PROVIDER=fcm
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_VAPID_KEY=...
   ```

7. **Update firebase-messaging-sw.js**
   - The service worker needs Firebase config
   - Options:
     a) Update the config directly in `frontend/public/firebase-messaging-sw.js`
     b) Load config from a config endpoint (recommended for production)

## Database Migration

Existing users with VAPID subscriptions will need to re-subscribe using the new system. The old `pushSubscription` field is kept for backward compatibility but is no longer used.

### Optional: Clean up old subscriptions

```javascript
// Run this in MongoDB shell or migration script
db.users.updateMany(
  { pushSubscription: { $exists: true } },
  { $unset: { pushSubscription: 1 } }
);
```

## Testing

### Local Testing

1. **Start Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Test OneSignal**
   - Go to Notification Settings page
   - Click "Enable Notifications"
   - Allow browser permission
   - Send test notification

4. **Test FCM**
   - Same as above, but ensure `PUSH_NOTIFICATION_PROVIDER=fcm` is set

### Testing Notifications

1. **Via UI**
   - Go to `/notification-settings`
   - Click "Send Test Notification"

2. **Via API**
   ```bash
   POST /api/players/test-push
   Authorization: Cookie with session
   ```

## Deployment Checklist

- [ ] Set `PUSH_NOTIFICATION_PROVIDER` in production backend `.env`
- [ ] Set provider credentials (OneSignal or Firebase) in backend `.env`
- [ ] Set frontend environment variables (via build-time or runtime config)
- [ ] Ensure service workers are accessible at root (OneSignalSDKWorker.js, firebase-messaging-sw.js)
- [ ] Update build/deploy scripts to copy service workers to root
- [ ] Test notification subscription flow in production
- [ ] Test sending notifications in production
- [ ] Monitor error logs for notification failures
- [ ] Remove `web-push` package from production (already removed from package.json)

## Breaking Changes

1. **VAPID endpoints deprecated**
   - `/api/players/vapid-public-key` now returns 410
   - Old VAPID subscriptions no longer work

2. **Subscription format changed**
   - Old: `pushSubscription` field with endpoint/keys
   - New: `oneSignalUserId` or `fcmTokens` arrays

3. **Frontend subscription flow changed**
   - No longer uses `PushManager.subscribe()` with VAPID key
   - Uses OneSignal SDK or Firebase SDK instead

## Rollback Plan

If you need to rollback:

1. Restore `backend/src/utils/pushNotifications.js` from git history
2. Restore `backend/src/routes/players.js` from git history
3. Restore `frontend/src/pages/PlayerProfile.tsx` from git history
4. Re-add `web-push` to `backend/package.json`
5. Restore VAPID environment variables

However, users who have already migrated to OneSignal/FCM will need to re-subscribe with VAPID.

## Support

For issues:
- OneSignal: https://documentation.onesignal.com
- Firebase: https://firebase.google.com/docs/cloud-messaging
- Check backend logs for notification sending errors

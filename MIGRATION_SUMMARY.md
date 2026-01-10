# Push Notifications Migration Summary

## Overview

Successfully migrated from VAPID-based Web Push to support both **OneSignal** and **Firebase Cloud Messaging (FCM)**. Both providers are available behind a feature flag (`PUSH_NOTIFICATION_PROVIDER`).

## Files Modified/Added/Removed

### Backend Files

#### Modified Files

1. **`backend/src/utils/pushNotifications.js`** - COMPLETELY REWRITTEN
   - **Why**: Removed VAPID/web-push dependency, added OneSignal REST API and FCM Admin SDK support
   - **Changes**: 
     - Removed all VAPID-related code (webpush, VAPID keys)
     - Added `initOneSignal()` and `initFCM()` functions
     - Added `sendOneSignalNotification()` and `sendFCMNotification()` functions
     - Updated `sendPushNotification()` and `sendPushNotifications()` to route to appropriate provider
     - Feature flag support via `PUSH_NOTIFICATION_PROVIDER` env var

2. **`backend/src/models/User.js`** - UPDATED
   - **Why**: Need to store subscription data for both providers
   - **Changes**:
     - Added `notificationProvider` field (enum: 'onesignal', 'fcm')
     - Added `oneSignalUserId` field (stores OneSignal external user ID)
     - Added `fcmTokens` array (supports multiple devices/browsers per user)
     - Kept `pushSubscription` field for backward compatibility (deprecated)

3. **`backend/src/routes/players.js`** - UPDATED
   - **Why**: Update subscription endpoints to support new providers
   - **Changes**:
     - Updated `POST /push-subscription` to accept `provider` field and handle both OneSignal/FCM
     - Added `GET /push-subscription/status` endpoint
     - Added `DELETE /push-subscription` endpoint for unsubscribing
     - Updated `POST /test-push` to work with both providers
     - Deprecated `GET /vapid-public-key` (now returns 410)

4. **`backend/src/routes/matches.js`** - UPDATED
   - **Why**: Update notification sending logic to use new system
   - **Changes**:
     - Updated `notifyNearbyPlayers()` function to query users by `notificationProvider`
     - Builds subscriptions array based on active provider (OneSignal external IDs or FCM tokens)
     - Handles expired FCM tokens cleanup

5. **`backend/package.json`** - UPDATED
   - **Why**: Replace dependencies
   - **Changes**:
     - Removed: `web-push` package
     - Added: `firebase-admin` package

### Frontend Files

#### New Files

1. **`frontend/src/lib/notifications.ts`** - NEW
   - **Why**: Centralized notification service for both providers
   - **Purpose**: 
     - Initialize OneSignal/FCM SDKs
     - Handle subscription/unsubscription
     - Provide consent flow helpers
     - Get notification status

2. **`frontend/src/pages/NotificationSettings.tsx`** - NEW
   - **Why**: Dedicated UI for managing notifications
   - **Purpose**:
     - Show current subscription status
     - Enable/disable notifications
     - Display permission status
     - Send test notifications

3. **`frontend/public/OneSignalSDKWorker.js`** - NEW
   - **Why**: Required by OneSignal SDK (must be at root)
   - **Purpose**: Handle notification clicks for OneSignal

4. **`frontend/public/OneSignalSDKUpdaterWorker.js`** - NEW
   - **Why**: Required by OneSignal SDK for updates
   - **Purpose**: OneSignal SDK maintenance worker

5. **`frontend/public/firebase-messaging-sw.js`** - NEW
   - **Why**: Required by FCM (must be at root)
   - **Purpose**: Handle background messages and notification clicks for FCM

#### Modified Files

1. **`frontend/src/pages/PlayerProfile.tsx`** - UPDATED
   - **Why**: Remove VAPID subscription logic
   - **Changes**:
     - Removed `urlBase64ToUint8Array()` helper function
     - Removed VAPID subscription code from `requestLocationAndSubscribe()`
     - Added link to Notification Settings page
     - Simplified function to only handle geolocation

2. **`frontend/src/App.tsx`** - UPDATED
   - **Why**: Add route for Notification Settings
   - **Changes**:
     - Added import for `NotificationSettings` component
     - Added route: `/notification-settings`

3. **`frontend/src/main.tsx`** - UPDATED
   - **Why**: Initialize push notifications on app startup
   - **Changes**:
     - Added import for `initPushNotifications()`
     - Call `initPushNotifications()` on app startup

4. **`frontend/package.json`** - UPDATED
   - **Why**: Add Firebase dependency
   - **Changes**:
     - Added: `firebase` package

5. **`frontend/src/sw.js`** - UNCHANGED
   - **Note**: Kept for PWA precaching. OneSignal and FCM use their own service workers.

### Documentation Files

1. **`PUSH_NOTIFICATIONS_MIGRATION.md`** - NEW
   - **Why**: Complete migration guide
   - **Contents**: Setup instructions, environment variables, testing guide, deployment checklist

2. **`README.md`** - UPDATED
   - **Why**: Document new environment variables
   - **Changes**: Added push notification provider configuration to backend setup section

## Environment Variables Added

### Backend (.env)
- `PUSH_NOTIFICATION_PROVIDER` (required): `onesignal` or `fcm`
- **For OneSignal**:
  - `ONESIGNAL_APP_ID` (required)
  - `ONESIGNAL_REST_API_KEY` (required)
- **For FCM**:
  - `FIREBASE_ADMIN_CREDENTIALS_PATH` (path to service account JSON file)
  - OR `FIREBASE_ADMIN_CREDENTIALS` (JSON string)

### Frontend (.env or .env.local)
- `VITE_PUSH_NOTIFICATION_PROVIDER` (optional, defaults to 'onesignal')
- **For OneSignal**:
  - `VITE_ONESIGNAL_APP_ID` (required)
- **For FCM**:
  - `VITE_FIREBASE_API_KEY` (required)
  - `VITE_FIREBASE_AUTH_DOMAIN` (required)
  - `VITE_FIREBASE_PROJECT_ID` (required)
  - `VITE_FIREBASE_STORAGE_BUCKET` (required)
  - `VITE_FIREBASE_MESSAGING_SENDER_ID` (required)
  - `VITE_FIREBASE_APP_ID` (required)
  - `VITE_FIREBASE_VAPID_KEY` (required)

## Environment Variables Removed

- `VAPID_PUBLIC_KEY` (no longer needed)
- `VAPID_PRIVATE_KEY` (no longer needed)
- `VAPID_SUBJECT` (no longer needed)

## Database Schema Changes

### User Model - New Fields:
- `notificationProvider`: String (enum: 'onesignal', 'fcm')
- `oneSignalUserId`: String (stores OneSignal external user ID, which is our userId)
- `fcmTokens`: Array of objects:
  ```javascript
  {
    token: String,
    deviceInfo: {
      userAgent: String,
      platform: String,
      language: String
    },
    createdAt: Date,
    lastSeenAt: Date
  }
  ```

### User Model - Deprecated:
- `pushSubscription`: Mixed (kept for backward compatibility, no longer used)

## API Endpoint Changes

### New Endpoints:
- `GET /api/players/push-subscription/status` - Get notification subscription status
- `DELETE /api/players/push-subscription` - Unsubscribe from notifications

### Modified Endpoints:
- `POST /api/players/push-subscription` - Now accepts `provider` field ('onesignal' or 'fcm')
- `POST /api/players/test-push` - Works with both providers

### Deprecated Endpoints:
- `GET /api/players/vapid-public-key` - Returns 410 Gone

## Breaking Changes

1. **VAPID no longer supported**: Existing VAPID subscriptions will stop working. Users need to re-subscribe via the new system.

2. **Subscription format changed**: 
   - Old: `pushSubscription` object with `endpoint` and `keys`
   - New: `oneSignalUserId` or `fcmTokens` array

3. **Frontend subscription flow**: 
   - Old: Direct `PushManager.subscribe()` with VAPID key
   - New: Uses OneSignal SDK or Firebase SDK

## Migration Path for Existing Users

1. Users visit `/notification-settings` page
2. Click "Enable Notifications"
3. Browser prompts for permission (if not already granted)
4. System subscribes using configured provider (OneSignal or FCM)
5. Subscription stored in new format (`oneSignalUserId` or `fcmTokens`)

## Testing Checklist

- [ ] OneSignal subscription flow
- [ ] FCM subscription flow
- [ ] Notification sending via OneSignal
- [ ] Notification sending via FCM
- [ ] Test notification button
- [ ] Unsubscribe flow
- [ ] Multiple devices (FCM only - user can have multiple tokens)
- [ ] Notification clicks redirect correctly
- [ ] Background notifications work
- [ ] Expired token cleanup (FCM)

## Next Steps

1. Choose provider (OneSignal or FCM)
2. Set up credentials (see `PUSH_NOTIFICATIONS_MIGRATION.md`)
3. Update environment variables
4. Test locally
5. Deploy to production
6. Monitor for errors
7. (Optional) Clean up old VAPID subscriptions from database

## Notes

- Both providers support the same notification payload format: `{title, body, url, image?}`
- FCM supports multiple devices per user (array of tokens)
- OneSignal uses external user ID (our internal userId)
- Service workers must be accessible at root domain (OneSignalSDKWorker.js, firebase-messaging-sw.js)
- The existing PWA service worker (sw.js) is kept for precaching and works alongside provider-specific workers

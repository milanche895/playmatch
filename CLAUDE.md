# PlayMatch — Project Reference for Claude Code

## Project Overview

**PlayMatch** is a full-stack sports match-making PWA (Progressive Web App) for the Serbian market. Players can discover sports fields on a map, create or join matches, rate teammates, and receive push notifications for nearby matches. Court owners can manage fields and approve match reservations.

The UI language is **Serbian (sr-RS)**. All user-facing strings, error messages, and date formats use Serbian locale.

---

## Tech Stack

### Backend (`/backend`)
- **Runtime**: Node.js (CommonJS, `require`)
- **Framework**: Express 4.19
- **Database**: MongoDB via Mongoose 8.6
- **Auth**: JWT in HttpOnly cookies + Passport.js for OAuth (Google, Facebook)
- **Real-time**: Socket.IO 4.7
- **Push Notifications**: `web-push` with VAPID keys (PWA Web Push)
- **File Uploads**: Multer (memory storage) → Cloudinary
- **Scheduler**: `node-cron`
- **Port**: 5050 (dev), `process.env.PORT` (prod)

### Frontend (`/frontend`)
- **Framework**: React 18.3 + TypeScript 5.6
- **Build tool**: Vite 5.4
- **UI Library**: Material-UI (MUI) 6.1
- **Routing**: React Router 6.26
- **Maps**: Leaflet 1.9 + react-leaflet 4.2
- **Real-time**: Socket.IO Client 4.7
- **PWA**: vite-plugin-pwa 1.2 (service workers, push notifications)
- **HTTP Client**: Axios (via `src/lib/api.ts`)
- **Dev port**: 5173

### Deployment
- Platform: **Render** (Frankfurt region)
- Backend URL: set via `BACKEND_URL` / `API_URL` env vars
- Frontend URL: set via `CLIENT_URL` env var

---

## Project Structure

```
playmatch/
├── CLAUDE.md                        ← this file
├── backend/
│   ├── .env                         ← secrets (never commit)
│   ├── config/
│   │   └── playmatch-*-firebase-adminsdk-*.json  ← ⚠️ MUST move to env var
│   ├── scripts/
│   │   └── backfill-user-metrics.js
│   └── src/
│       ├── server.js                ← app entry point, Socket.IO, cron
│       ├── middleware/
│       │   └── auth.js              ← JWT auth middleware (cookie + Bearer header)
│       ├── models/
│       │   ├── User.js
│       │   ├── Match.js
│       │   └── Field.js
│       ├── routes/
│       │   ├── auth.js              ← login, register, OAuth, /me
│       │   ├── matches.js           ← match CRUD, join, leave, ratings
│       │   ├── players.js           ← profile, analytics, push, block
│       │   ├── fields.js            ← field CRUD
│       │   └── courts.js            ← court owner management
│       └── utils/
│           ├── cloudinary.js        ← image upload helpers
│           ├── pushNotifications.js ← VAPID web push
│           └── notifications.js     ← calculateDistance helper
└── frontend/
    ├── src/
    │   ├── App.tsx                  ← routing, ErrorBoundary
    │   ├── types.ts                 ← TypeScript interfaces
    │   ├── context/
    │   │   ├── AuthContext.tsx      ← auth state, login/logout/register
    │   │   └── ThemeContext.tsx     ← dark/light mode
    │   ├── lib/
    │   │   ├── api.ts               ← axios instance (withCredentials, no localStorage)
    │   │   ├── socket.ts            ← Socket.IO client
    │   │   └── notifications.ts     ← PWA push subscription helpers
    │   ├── components/
    │   │   ├── Navbar.tsx
    │   │   └── RoleSelectionModal.tsx
    │   └── pages/
    │       ├── Home.tsx             ← map + match discovery
    │       ├── CreateMatch.tsx
    │       ├── MatchDetails.tsx
    │       ├── PlayerProfile.tsx
    │       ├── MojiMecevi.tsx       ← organizer's matches
    │       ├── MojTermine.tsx       ← player's schedule
    │       ├── MojiIgraci.tsx       ← court's player list
    │       ├── ManageFields.tsx
    │       ├── NotificationSettings.tsx
    │       ├── Login.tsx / Register.tsx
    │       └── AuthCallback.tsx     ← OAuth redirect handler
    └── vite.config.ts
```

---

## Running the Project

### Backend
```bash
cd backend
npm install
npm run dev        # nodemon src/server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # vite dev server on :5173
```

### Environment Variables (backend `.env`)
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
SESSION_SECRET=...
PORT=5050

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-backend/api/auth/google/callback
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=https://your-backend/api/auth/facebook/callback

# URLs
CLIENT_URL=https://playmatch-1.onrender.com
BACKEND_URL=https://your-backend.onrender.com
API_URL=https://your-backend.onrender.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...

NODE_ENV=production
```

### Frontend `.env` (Vite)
```
VITE_API_URL=https://your-backend.onrender.com
VITE_SOCKET_URL=https://your-backend.onrender.com
```

---

## Authentication Architecture

**IMPORTANT — cookie-only auth (changed 2026-03-27):**

- Auth uses **HttpOnly cookies only**. There is no `localStorage` token anymore.
- The `api.ts` axios instance uses `withCredentials: true` — cookies are sent automatically.
- Do NOT add `Authorization: Bearer` header interceptors back. The auth middleware supports Bearer headers for API clients, but the frontend must not use localStorage for token storage (XSS risk).
- OAuth callbacks (Google, Facebook) set the cookie via redirect and do NOT embed the token in the redirect URL.
- `AuthCallback.tsx` calls `/api/auth/me` to verify the cookie after OAuth redirect.

### Auth Middleware (`middleware/auth.js`)
```js
auth(true)   // require auth — 401 if missing/invalid
auth(false)  // optional auth — req.user is null if no valid token
```
- Checks cookie first, then `Authorization: Bearer <token>` header
- Sets `req.user = { id: payload.id }`

### Token Creation (`setTokenCookie` in `routes/auth.js`)
- Signs JWT with `{ id: userId }`, expires in 7d
- `SameSite: 'none', Secure: true` in production
- `SameSite: 'lax', Secure: false` in development

---

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `email` | String | unique, indexed |
| `password` | String | optional (OAuth users have none) |
| `provider` | Enum | `local`, `google`, `facebook`, `instagram` |
| `providerId` | String | OAuth provider ID |
| `role` | Enum | `player` or `court` |
| `workingHours` | Object | per-day open/close (court only) |
| `bio`, `skills`, `phone`, `location` | String | player profile |
| `preferredSports` | [String] | player sports |
| `experience` | Enum | `beginner/intermediate/advanced/professional` |
| `ratingAvg` | Number | 0–5, updated by aggregate after each rating |
| `ratingsCount` | Number | total ratings received |
| `reliabilityScore` | Number | 0–100, decremented on late cancellations |
| `sportSkillLevels` | [{sport, skillLevel}] | per-sport skill 1–5 |
| `notificationEnabled` | Boolean | push notification opt-in |
| `notificationRadius` | Number | km radius for notifications (default 10) |
| `lastKnownLocation` | {lat, lng, updatedAt} | updated from browser geolocation |
| `pushSubscription` | Mixed | PWA Web Push subscription object |
| `blockedPlayers` | [ObjectId] | users blocked from joining this user's matches |

### Match
| Field | Type | Notes |
|---|---|---|
| `sport` | String | required |
| `fieldId` | ObjectId → Field | required |
| `dateTime` | Date | rounded to full hour |
| `registrationDeadline` | Date | auto-calculated from field's `registrationDeadlineHours` |
| `minPlayers` | Number | minimum to confirm the match |
| `maxPlayers` | Number | optional cap |
| `playersNeeded` | Number | **legacy** — kept equal to `minPlayers` via pre-save hook |
| `players` | [ObjectId → User] | registered players |
| `createdBy` | ObjectId → User | organizer |
| `status` | Enum | `open`, `full`, `completed`, `failed`, `otkazano` |
| `courtApproval` | Enum | `pending`, `approved`, `rejected` |
| `playerCancellations` | [{playerId, comment, cancelledAt, penalizedReliability}] | |
| `ratings` | [{raterId, ratedUserId, stars, fairPlay, sport}] | post-match ratings |

**Status transitions:**
- `open` → `full` when `players.length >= minPlayers`
- `open/full` → `failed` when deadline passes and not enough players (cron, hourly at :00)
- `open` → `otkazano` when `registrationDeadline` passes with no court approval
- `full/completed` → only organizer can't leave

### Field
- `name`, `lat`, `lng`, `sports[]`, `price`, `registrationDeadlineHours`
- `courtOwner` (ObjectId → User) — if set, matches require court approval
- `workingHours` per day

---

## API Routes

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Local registration |
| POST | `/login` | — | Local login |
| POST | `/logout` | — | Clear cookie |
| GET | `/me` | required | Current user (full object, no password) |
| GET | `/google` | — | Start Google OAuth |
| GET | `/google/callback` | — | Google OAuth callback |
| GET | `/facebook` | — | Start Facebook OAuth |
| GET | `/facebook/callback` | — | Facebook OAuth callback |
| POST | `/instagram` | — | Instagram token auth |

### Matches (`/api/matches`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | optional | List matches (paginated: `?limit=50&skip=0`); filters blocked creators |
| POST | `/` | required | Create match; triggers push notifications |
| GET | `/:id` | — | Match details |
| POST | `/:id/join` | required | Join match |
| POST | `/:id/leave` | required | Leave match (no penalty) |
| POST | `/:id/cancel-attendance` | required | Leave with comment + reliability penalty |
| GET | `/:id/rating-status` | required | Pending ratings for completed match |
| POST | `/:id/rate` | required | Submit post-match ratings |

### Players (`/api/players`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | required | Own profile |
| GET | `/profile/:id` | — | Public player profile |
| PUT | `/profile` | required | Update profile |
| POST | `/upload-avatar` | required | Upload avatar to Cloudinary |
| GET | `/analytics` | required | Own stats |
| GET | `/analytics/:id` | — | Public stats |
| POST | `/location` | required | Update last known location |
| POST | `/push-subscription` | required | Register push subscription |
| DELETE | `/push-subscription` | required | Remove push subscription |
| GET | `/push-subscription/status` | required | Check subscription status |
| GET | `/vapid-public-key` | — | VAPID public key |
| POST | `/test-push` | required | Send test push notification |
| GET | `/my-matches/created` | required | Matches created by current player |
| GET | `/my-matches/joined` | required | Matches current player joined |
| GET | `/my-players` | required | Unique players who joined organizer's matches |
| GET | `/blocked-players` | required | Current user's blocked list |
| POST | `/block-player/:id` | required | Block a player |
| DELETE | `/block-player/:id` | required | Unblock a player |
| GET | `/is-blocked-by/:userId` | required | Check if blocked by user |

### Fields (`/api/fields`)
- `GET /` — list all fields
- `GET /:id` — field details
- `POST /` — create field (court role required)

---

## Real-time (Socket.IO)

- Client connects per page; `MatchDetails.tsx` joins room `match:<matchId>`
- Events emitted by server on match updates: `match_updated` with populated match object
- Client events: `join_match_room`, `leave_match_room`
- `io` instance is stored on `app.set('io', io)` and passed to `matchesRoutesFactory(io)`

---

## Push Notifications

- **VAPID Web Push** via `web-push` library
- Triggered on `POST /api/matches` (new match creation)
- Filters players within `notificationRadius` km of the new match's field
- Expired subscriptions are automatically cleaned up after a failed send
- Test endpoint: `POST /api/players/test-push`
- Firebase Admin SDK used for FCM fallback — credentials stored in `backend/config/` (⚠️ see Known Issues)

---

## Cron Jobs

| Schedule | Job |
|---|---|
| `0 * * * *` (hourly at :00) | Check open matches whose `registrationDeadline` has passed and mark them `otkazano` |

Also runs once on server startup.

---

## Frontend Conventions

- **API calls**: always use `api` from `src/lib/api.ts` — never raw `fetch` or a new axios instance
- **Socket**: use the singleton `socket` from `src/lib/socket.ts`
- **Auth state**: use `useAuth()` hook from `AuthContext` — never read cookies directly
- **Loading states**: show `<CircularProgress />` while async data loads
- **Errors**: show MUI `<Alert severity="error">` — use `err.response?.data?.message || 'fallback'`
- **Date formatting**: use `toLocaleString('sr-RS', {...})` for all user-visible dates
- **Player count display**: use the local `formatPlayersCount(match)` helper (handles min/max/current)
- **Routes with auth**: wrap in `<ProtectedRoute>` in `App.tsx`

---

## Known Issues & Technical Debt

### Must Fix Before Scaling
1. **Firebase credentials in git** (`backend/config/playmatch-*-firebase-adminsdk-*.json`)
   - Must be moved to env var (`FIREBASE_SERVICE_ACCOUNT_JSON` or similar) and removed from repo history with `git filter-branch` or BFG Repo-Cleaner

2. **`playersNeeded` legacy field** (`Match` model)
   - Still exists alongside `minPlayers` for backward compatibility
   - Pre-save hook keeps them in sync
   - To fix: run a migration script, remove `playersNeeded` field and the pre-save hook

3. **No rate limiting** on auth endpoints
   - Add `express-rate-limit` to prevent brute-force on `/api/auth/login` and `/api/auth/register`

4. **Analytics endpoints duplicate code**
   - `GET /players/analytics` and `GET /players/analytics/:id` share identical DB query logic
   - Should be extracted to a shared `computeAnalytics(userId)` function

5. **`playersNeeded` still referenced in frontend** (`types.ts`, `MatchDetails.tsx`, `Home.tsx`, `MojiMecevi.tsx`)
   - `match.minPlayers ?? match.playersNeeded` pattern used everywhere
   - Can be cleaned up once DB migration is done

### Won't Fix / Out of Scope
- `workingHours` duplicated in both `User` and `Field` models — ambiguous ownership, needs product decision
- No full input sanitization framework (currently manual type checks) — low risk given MongoDB's query structure

---

## Changes Log

### 2026-03-27 — Informal Match Feature
- **Match model**: Added `isInformal: Boolean`, `informalLocation: {name, lat, lng}`; made `fieldId` optional
- **POST /api/matches**: Branches on `isInformal` — skips field lookup, overlap check, deadline calc, court approval; sets 1h registration deadline; auto-approves
- **GET /api/matches validMatches filter**: Now includes informal matches (previously required `fieldId`)
- **Push notifications**: `notifyNearbyPlayers` resolves coords from `informalLocation` when `isInformal`
- **All match routes** (`GET /:id`, `join`, `leave`, `cancel-attendance`): fieldId validation guards skip for informal
- **`frontend/src/types.ts`**: Added `InformalLocation` type; made `Match.fieldId` optional; added `isInformal?`, `informalLocation?`
- **`CreateMatch.tsx`**: Full rewrite — mode toggle (formal/informal), informal step 0 (map click + location name), informal step 1 (datetime-local min=now+2h), step 2 preview conditional on mode
- **`Home.tsx`**: Added `informalMatchIcon` (orange `#f97316`); updated nearby/valid match filters to include informal coords; added separate informal match markers on map; fixed `MatchCard` and `handleJoinMatch` for `fieldId`-less matches
- **`MatchDetails.tsx`**: Map center, location header, map popup, and share text all conditional on `isInformal`; "Privatni teren" chip badge in header for informal matches

### 2026-03-27 — Security & Architecture Fixes
- **CORS**: Fixed CORS callback to reject non-allowlisted origins in production (was silently allowing all)
- **Cron**: Fixed cron schedule from `'* * * * *'` (every minute) to `'0 * * * *'` (hourly)
- **Auth `/me`**: Refactored to use `auth(true)` middleware; removed 3 debug `console.log` lines
- **OAuth redirect**: Removed JWT token from OAuth redirect URLs (`?token=...`). Cookie is set server-side; token in URL is a security leak (browser history, server logs). Frontend `AuthCallback` now relies on cookie.
- **GET /matches**: Replaced inline manual JWT decode (with wrong secret fallback `'your-secret-key'`) with `auth(false)` middleware; fixed blocked-filter to use `req.user.id`
- **Pagination**: Added `?limit` / `?skip` query params to `GET /api/matches` (default 50, max 100)
- **localStorage token removed**: Removed all `localStorage.setItem/getItem/removeItem('token')` from frontend. Auth is now cookie-only. Removed `Authorization: Bearer` header interceptor from `api.ts`.
- **AbortController**: Added to `AuthContext` useEffect to cancel stale `/me` requests on unmount
- **Socket URL**: Simplified `socket.ts` URL resolution logic
- **ErrorBoundary**: Added React error boundary in `App.tsx` — component crashes now show recovery UI instead of blank screen

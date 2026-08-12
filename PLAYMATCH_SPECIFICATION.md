# PlayMatch — Kompletna specifikacija aplikacije

> **Svrha dokumenta:** Referenca za AI asistente i developere pri unapređenju, refaktorisanju ili proširivanju aplikacije.  
> **Jezik UI-ja:** sr-RS (srpski).  
> **Poslednja revizija:** avgust 2026.  
> **Aktivni kod:** `backend/` + `frontend/` (ostale fascikle su legacy — vidi §11).

---

## 1. Pregled projekta

**PlayMatch** je full-stack PWA (Progressive Web App) za organizaciju sportskih mečeva na srpskom tržištu.

### Ključne mogućnosti

| Oblast | Funkcionalnost |
|--------|----------------|
| **Igrači** | Pronalaze mečeve na mapi, kreiraju/priključuju se mečevima, ocenjuju saigrače, blokiraju igrače, primaju push obaveštenja |
| **Vlasnici terena (court)** | Upravljaju terenima, odobravaju/odbijaju rezervacije, rezervišu termine, prate statistiku |
| **Mečevi** | Formalni (na registrovanom terenu) i neformalni (privatna lokacija na mapi) |
| **Real-time** | Socket.IO ažuriranja u detaljima meča |
| **Obaveštenja** | Web Push (VAPID) — PWA push preko service workera |

### Tech stack

| Sloj | Tehnologije |
|------|-------------|
| Backend | Node.js, Express 4.19, MongoDB/Mongoose 8.6, JWT cookies, Passport OAuth, Socket.IO, web-push, Cloudinary, node-cron |
| Frontend | React 18, TypeScript 5.6, Vite 5.4, MUI 6, Leaflet, React Router 6, vite-plugin-pwa, Axios, Socket.IO client |
| Deploy | Render (Frankfurt), `render.yaml` |

---

## 2. Uloge korisnika

### `player` (igrač)
- Kreira mečeve (formalne i neformalne)
- Priključuje se mečevima, otkazuje dolazak (sa kaznom pouzdanosti)
- Upravlja profilom, avatarom, sportskim veštinama
- Prima push obaveštenja u radijusu od lokacije
- Vidi svoje mečeve, igrače sa kojima je igrao, blokira igrače
- Ocenjuje saigrače posle završenog meča

### `court` (vlasnik terena)
- Kreira i uređuje terene (Manage Fields)
- Odobrava/odbija/cancel-uje rezervacije mečeva na svojim terenima
- Rezerviše slobodne termine (court reservation)
- Prati statistiku (nedeljno/mesečno) u Moj Termini
- **Nema** profil stranicu, push postavke ni navigaciju za igrača

---

## 3. Poslovna logika — mečevi

### 3.1 Tipovi mečeva

#### Formalni meč (`isInformal: false`)
- Obavezan `fieldId` → referenca na `Field`
- `registrationDeadline` = `dateTime` − `field.registrationDeadlineHours`
- Ako teren ima `courtOwner` → `courtApproval: 'pending'` (ali vidi bug u §12)
- Provera preklapanja termina na istom terenu
- Push obaveštenja koriste koordinate terena

#### Neformalni meč (`isInformal: true`)
- Nema `fieldId`; koristi `informalLocation: { name, lat, lng }`
- Rok prijave: `informalRegistrationDeadlineHours` (1–48h, default iz UI)
- `courtApproval: 'approved'` automatski
- Organizator može ručno završiti meč (`POST /api/matches/:id/complete`) i označiti no-shows
- Push koristi koordinate iz `informalLocation`

### 3.2 Statusi meča (`Match.status`)

| Status | Značenje |
|--------|----------|
| `open` | Otvoren za prijave |
| `full` | Dostignut `minPlayers` (ili `maxPlayers`) |
| `completed` | Meč odigran/završen |
| `failed` | Rok prošao, nema dovoljno igrača |
| `otkazano` | Otkazan (deadline, court reject/cancel) |

### 3.3 Odobrenje terena (`courtApproval`)

| Vrednost | Značenje |
|----------|----------|
| `pending` | Čeka odobrenje vlasnika terena |
| `approved` | Odobreno |
| `rejected` | Odbijeno → meč ide u `otkazano` |

### 3.4 Prelazi statusa (implementirano)

```
open → full          kada players.length >= minPlayers
open → failed        GET /api/matches side-effect: deadline prošao + malo igrača
open → otkazano      cron + court reject/cancel
full → completed     court complete (formalni) ili organizer complete (neformalni)
```

### 3.5 Prijava / odjava

- **Join** (`POST /:id/join`) — dodaje igrača u `players[]`; ako je bio na waitlist-u, uklanja ga odatle
- **Leave** (`POST /:id/leave`) — bez kazne (implementirano na backendu, **nije u frontend UI**)
- **Cancel attendance** (`POST /:id/cancel-attendance`) — sa komentarom, smanjuje `reliabilityScore`
- Organizator ne može napustiti meč kad je `full` ili `completed`
- **Lista čekanja (waitlist)** — FIFO red kada je meč na kapacitetu (`players.length >= maxPlayers`, ili 100 ako max nije postavljen):
  - `POST /:id/waitlist` — „Stani u red“
  - `POST /:id/waitlist/leave` — napuštanje reda
  - Pri leave / cancel-attendance: prvi podoban sa waitlist-a se automatski prebacuje u `players[]` i dobija push („Mesto se oslobodilo!“); blokirani / court nalozi se preskaču

### 3.6 Ocenjivanje posle meča

- Dostupno kad je `status === 'completed'`
- `GET /:id/rating-status` — ko još nije ocenjen
- `POST /:id/rate` — `{ ratings: [{ ratedUserId, stars, fairPlay, skillLevel?, sport }] }`
- Ažurira `User.ratingAvg` i `ratingsCount` agregatno

### 3.7 Pouzdanost (`reliabilityScore`)

- Početna vrednost: 100
- Kazna pri `cancel-attendance` blizu termina meča
- Analytics endpoint računa fallback iz odnosa otkazivanja ako polje nedostaje (može divergirati od stored vrednosti)

---

## 4. Backend — API referenca

**Base URL:** `/api`  
**Auth:** HttpOnly cookie `token` (JWT 7d) ili `Authorization: Bearer`  
**Middleware:** `auth(true)` = obavezna, `auth(false)` = opciona

### 4.1 Auth — `/api/auth`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| POST | `/register` | — | Lokalna registracija `{ name, email, password, role }` |
| POST | `/login` | — | `{ email, password }` |
| POST | `/logout` | — | Briše cookie |
| GET | `/me` | ✓ | Trenutni korisnik |
| GET | `/google` | — | OAuth start; `?state=player\|court` |
| GET | `/google/callback` | session | OAuth callback → redirect na frontend |
| GET | `/facebook` | — | Facebook OAuth start |
| GET | `/facebook/callback` | session | Facebook callback |
| POST | `/instagram` | — | `{ accessToken, role }` — Instagram token auth |

**Napomena:** Login/register i dalje vraćaju JWT u response body (legacy); frontend ignoriše token i koristi samo cookie.

### 4.2 Tereni — `/api/fields`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| GET | `/` | — | Lista svih terena |
| GET | `/:id` | — | Detalji terena |
| POST | `/` | ✓ | Kreiranje terena (nije ograničeno na `court` rolu!) |

### 4.3 Mečevi — `/api/matches`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| GET | `/` | opciono | Lista mečeva; `?limit=50&skip=0` (max 100); filtrira blokirane kreatore |
| POST | `/` | ✓ | Kreiranje meča; trigger push obaveštenja |
| GET | `/:id` | — | Detalji meča |
| POST | `/:id/join` | ✓ | Prijava na meč |
| POST | `/:id/leave` | ✓ | Odjava bez kazne |
| POST | `/:id/cancel-attendance` | ✓ | Odjava sa kaznom `{ comment }` |
| POST | `/:id/waitlist` | ✓ | Stani u red (kad je meč pun) |
| POST | `/:id/waitlist/leave` | ✓ | Napusti listu čekanja |
| POST | `/:id/complete` | ✓ | Završetak **neformalnog** meča `{ noShowIds? }` |
| GET | `/:id/rating-status` | ✓ | Status ocenjivanja |
| POST | `/:id/rate` | ✓ | Slanje ocena |

**POST /** body (formalni):
```json
{
  "sport": "football",
  "fieldId": "...",
  "dateTime": "2026-08-15T18:00:00.000Z",
  "minPlayers": 10,
  "maxPlayers": 14
}
```

**POST /** body (neformalni):
```json
{
  "isInformal": true,
  "sport": "football",
  "informalLocation": { "name": "Park", "lat": 44.8, "lng": 20.4 },
  "dateTime": "...",
  "minPlayers": 6,
  "maxPlayers": 10,
  "informalRegistrationDeadlineHours": 24
}
```

### 4.4 Igrači — `/api/players`

| Metoda | Putanja | Auth | Rola | Opis |
|--------|---------|------|------|------|
| GET | `/profile/:id` | — | — | Javni profil |
| GET | `/profile` | ✓ | player | Sopstveni profil |
| PUT | `/profile` | ✓ | player | Ažuriranje profila |
| GET | `/analytics/:id` | — | player | Javna statistika |
| GET | `/analytics` | ✓ | player | Sopstvena statistika |
| POST | `/location` | ✓ | player | `{ lat, lng }` — lastKnownLocation |
| POST | `/push-subscription` | ✓ | player | `{ subscription }` Web Push |
| DELETE | `/push-subscription` | ✓ | — | Uklanjanje pretplate |
| GET | `/push-subscription/status` | ✓ | — | Status pretplate |
| GET | `/vapid-public-key` | — | — | VAPID javni ključ |
| POST | `/test-push` | ✓ | — | Test push na sebe |
| GET | `/my-matches/created` | ✓ | player | Mečevi koje je kreirao |
| GET | `/my-matches/joined` | ✓ | player | Mečevi na koje je prijavljen |
| POST | `/upload-avatar` | ✓ | multer | Upload avatara → Cloudinary |
| GET | `/my-players` | ✓ | player | Igrači iz organizatorovih mečeva |
| GET | `/blocked-players` | ✓ | — | Lista blokiranih |
| POST | `/block-player/:playerId` | ✓ | — | Blokiranje |
| DELETE | `/block-player/:playerId` | ✓ | — | Deblokiranje |
| GET | `/is-blocked-by/:userId` | ✓ | — | Da li me je blokirao korisnik |

### 4.5 Tereni (court panel) — `/api/courts`

Svi endpointi zahtevaju auth + `role === 'court'`.

| Metoda | Putanja | Opis |
|--------|---------|------|
| GET | `/matches/pending` | Mečevi na čekanju odobrenja |
| POST | `/matches/:id/approve` | Odobri meč |
| POST | `/matches/:id/reject` | Odbij → `otkazano` |
| POST | `/matches/:id/cancel` | Otkaži odobren meč |
| POST | `/matches/:id/complete` | Završi **formalni** meč |
| PUT | `/working-hours` | Default radno vreme court korisnika |
| PUT | `/default-price` | Default cena |
| PUT | `/default-deadline` | Default rok prijave (sati) |
| GET | `/appointments` | Dashboard: reserved/pending/free/stats |
| GET | `/fields/:fieldId/appointments` | Termini po terenu |
| GET | `/fields` | Tereni vlasnika |
| PUT | `/fields/:fieldId` | Ažuriranje terena |
| PUT | `/fields/:fieldId/working-hours` | Radno vreme terena |
| PUT | `/fields/:fieldId/price` | Cena terena |
| POST | `/appointments/reserve` | Rezervacija slobodnog termina |

---

## 5. Backend — modeli podataka

### 5.1 User

```
name, email, password?, avatarUrl, provider, providerId, providerData
role: 'player' | 'court'
workingHours, defaultPrice, defaultRegistrationDeadlineHours  (court)
bio, skills, phone, location, preferredSports[], experience
ratingAvg, ratingsCount, reliabilityScore (0-100)
sportSkillLevels: [{ sport, skillLevel (1-5) }]
notificationEnabled, notificationRadius (km, default 10)
lastKnownLocation: { lat, lng, updatedAt }
pushSubscription: Mixed (Web Push subscription object)
blockedPlayers: [ObjectId]
```

### 5.2 Match

```
sport, fieldId?, isInformal, informalLocation?, informalRegistrationDeadlineHours?
dateTime, registrationDeadline
minPlayers, maxPlayers?, playersNeeded (legacy, sync sa minPlayers)
players[], waitlist[], createdBy
status: open|full|completed|failed|otkazano
courtApproval: pending|approved|rejected
courtApprovedBy?, courtApprovedAt?, description?
playerCancellations: [{ playerId, comment, cancelledAt, penalizedReliability }]
noShows: [ObjectId]  (neformalni complete)
pricePerPlayer?, playerPayments: [{ playerId, paid, paidAt?, method }]
ratings: [{ raterId, ratedUserId, stars, fairPlay, sport, createdAt }]
```

### 5.3 Field

```
name, sports[], lat, lng, courtOwner?, price?
registrationDeadlineHours (default 24)
workingHours: { [day]: { start, end, closed } }
```

---

## 6. Backend — infrastruktura

### 6.1 Socket.IO

**Klijent → server:**
- `join_match_room(matchId)` → soba `match:<id>`
- `leave_match_room(matchId)`

**Server → klijent:**
- `match_updated` — populated match objekat (matches, courts, cron)

### 6.2 Cron (`server.js`)

- **Raspored:** `0 * * * *` (svakog sata) + jednom pri startu
- **Funkcija:** `checkCancelledMatches()` — `open` mečevi sa prošlim `registrationDeadline` → `otkazano`

### 6.3 Push obaveštenja (`utils/pushNotifications.js`)

- **Samo VAPID Web Push** (`web-push` biblioteka)
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Trigger: `POST /api/matches` → `notifyNearbyPlayers()` filtrira igrače po:
  - `notificationEnabled === true`
  - `pushSubscription` postoji
  - udaljenost ≤ `notificationRadius` km (Haversine)
  - sport se poklapa sa `preferredSports` (ako postoji)
- Trigger: auto-promocija sa waitlist-a → push „Mesto se oslobodilo!“ na promovisanog igrača
- Istekle pretplate (HTTP 410/404) se čiste iz baze

### 6.4 Cloudinary (`utils/cloudinary.js`)

- Upload avatara (400×400 face crop)
- OAuth avatar sync (Google/Facebook/Instagram)

### 6.5 Skripte

| Skripta | Svrha |
|---------|-------|
| `scripts/backfill-user-metrics.js` | Jednokratno popunjavanje metrika |
| `scripts/fix-user-index.js` | Popravka OAuth unique indexa |

---

## 7. Frontend — rute i stranice

| Ruta | Komponenta | Auth | Rola | Funkcije |
|------|------------|------|------|----------|
| `/` | Home | — | svi | Mapa terena/mečeva, geolokacija, radius filter, join, notification banner, FAB create |
| `/create` | CreateMatch | ✓ | player* | 3-korak wizard: formalni/neformalni meč |
| `/matches/:id` | MatchDetails | — | svi | Detalji, mapa, join/leave/cancel, share, Socket.IO, ocene, informal complete |
| `/manage-fields` | ManageFields | ✓ | court* | CRUD terena, radno vreme, approve/reject/cancel |
| `/moji-termini` | MojTermine | ✓ | court* | Tabovi: rezervisano, pending, slobodno, statistika |
| `/profil` | PlayerProfile | ✓ | player* | Profil, avatar, analitika, radius, test push |
| `/moji-mecevi` | MojiMecevi | ✓ | player* | Kreirani vs prijavljeni mečevi |
| `/moji-igraci` | MojiIgraci | ✓ | player* | Lista igrača, block/unblock |
| `/notification-settings` | NotificationSettings | ✓ | svi* | Push subscribe/unsubscribe, test |
| `/login` | Login | — | — | Email/password + OAuth |
| `/register` | Register | — | — | Registracija + RoleSelectionModal za OAuth |
| `/auth/callback` | AuthCallback | — | — | OAuth povratak, verifikacija cookie |

\*Nema role guard na ruti — samo `ProtectedRoute` (auth). Court korisnik može otvoriti player stranice direktno URL-om.

**Nedostaje:** `/profil/:id` (link postoji u MojiIgraci, ruta ne postoji). Nema 404 stranice.

---

## 8. Frontend — arhitektura

### 8.1 Context

| Fajl | Stanje / metode |
|------|-----------------|
| `AuthContext` | `user`, `loading`; `login`, `register`, `logout`, `refreshUser`, OAuth metode |
| `ThemeContext` | light/dark mode, `localStorage` ključ `theme-mode` |

### 8.2 Lib moduli

| Fajl | Svrha |
|------|-------|
| `api.ts` | Axios, `withCredentials: true`, timeout 10s |
| `socket.ts` | Singleton Socket.IO, `autoConnect: false` |
| `notifications.ts` | VAPID push: permission, subscribe, unsubscribe, status |

### 8.3 Komponente

| Komponenta | Gde se koristi |
|------------|----------------|
| `Navbar` | App — role-aware navigacija, theme toggle, logout, PWA install |
| `RoleSelectionModal` | Register — izbor player/court pre OAuth |
| `InstallButton` | Navbar — PWA install prompt (mobile) |

### 8.4 PWA / Service Worker

- **Plugin:** `vite-plugin-pwa`, strategija `injectManifest`
- **SW fajl:** `frontend/src/sw.js`
- **Manifest:** PlayMatch Global, standalone portrait, ikone 192/512
- **Push handler:** parsira JSON/text, prikazuje notifikaciju, `notificationclick` otvara/fokusira tab
- **Registracija:** `main.tsx` → `registerSW({ immediate: true })`

### 8.5 TypeScript tipovi (`types.ts`)

`User`, `Match`, `Field`, `PlayerAnalytics`, `InformalLocation`, `PushSubscriptionJSON`, `MatchRatingStatus`, `PendingRatingUser`, `PlayerCancellation`

---

## 9. Autentifikacija — arhitektura

```
Browser → Axios (withCredentials) → HttpOnly cookie "token"
OAuth → Passport session → callback → setTokenCookie → redirect /auth/callback
Frontend NIKAD ne čuva token u localStorage
```

**Cookie opcije (prod):** `SameSite: none`, `Secure: true`, 7 dana  
**Cookie opcije (dev):** `SameSite: lax`, `Secure: false`

**OAuth redirect:** Backend šalje `?user=<JSON>` u URL (PII u browser history — nije token ali je rizik).

---

## 10. Environment varijable

### Backend (`.env`)

```
MONGO_URI, JWT_SECRET, SESSION_SECRET, PORT=5050
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL
CLIENT_URL, BACKEND_URL, API_URL
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:...
NODE_ENV
```

### Frontend (`.env`)

```
VITE_API_URL=https://your-backend.onrender.com
VITE_SOCKET_URL=https://your-backend.onrender.com
```

---

## 11. Struktura repozitorijuma

### Aktivni kod (koristi se u produkciji)

```
playmatch/
├── backend/src/          ← API server
├── frontend/src/         ← React PWA
├── render.yaml           ← Render deploy
├── CLAUDE.md             ← AI referenca (skraćena)
└── PLAYMATCH_SPECIFICATION.md  ← ovaj fajl
```

### Legacy / neaktivni (NE koristiti)

| Fascikla | Opis |
|----------|------|
| `client/` | Stari frontend (Tailwind, bez MUI) — zastareo |
| `server/` | Stari backend — zastareo, manje ruta |
| `MIGRATION_SUMMARY.md`, `PUSH_NOTIFICATIONS_MIGRATION.md`, `DEBUG_PUSH_NOTIFICATIONS.md`, `QUICK_FIX_PUSH_NOTIFICATIONS.md`, `PUSH_NOTIFICATIONS_TEST.md` | Dokumenti o OneSignal/FCM migraciji koja **nije implementirana** |

---

## 12. Audit — nelogičnosti, bugovi, visak koda

> Prioritet: 🔴 visok · 🟡 srednji · 🟢 nizak

### 12.1 🔴 Kritični problemi

| # | Problem | Gde | Posledica |
|---|---------|-----|-----------|
| 1 | **Push notifikacije ne stižu kad Chrome nije otvoren** | PWA/Android | Service worker mora biti registrovan + push subscription aktivna; na Androidu Chrome ubija SW na free tier telefonima; korisnik mora instalirati PWA i dozvoliti obaveštenja |
| 2 | **NotificationSettings UX bug** | `NotificationSettings.tsx:241` | Dugme "Omogući" je `disabled` dok `permission !== 'granted'`, ali permission se traži tek u `onClick` → **deadlock** za nove korisnike |
| 3 | **Home notification banner ne poziva subscribe** | `Home.tsx` | Postavlja samo `notificationEnabled: true` na backendu, ne registruje push pretplatu |
| 4 | **Konflikt statusa meča: cron vs GET /matches** | `server.js` vs `matches.js` | Cron → svi `open` sa prošlim deadline → `otkazano`; GET /matches → malo igrača → `failed`. Isti meč može dobiti različit status zavisno od redosleda |
| 5 | **Auto-approve court na join** | `matches.js` join handler | Kad se popuni `minPlayers`, `courtApproval` se automatski postavlja na `approved` — court approve flow je delimično besmislen |
| 6 | **Link `/profil/:id` ne postoji** | `MojiIgraci.tsx` | "Vidi profil" vodi na 404 |

### 12.2 🟡 Srednji problemi

| # | Problem | Gde |
|---|---------|-----|
| 7 | Legacy `client/` i `server/` fascikle u repou | root |
| 8 | `firebase` npm paket u frontendu — **nigde se ne importuje** | `frontend/package.json` |
| 9 | `passport-facebook-token`, npm paket `http` — neiskorišćeni | `backend/package.json` |
| 10 | JWT i dalje u response body (register/login/instagram) | `auth.js` — suprotno cookie-only dokumentaciji |
| 11 | OAuth redirect sa `?user=JSON` u URL | `auth.js` — PII u history |
| 12 | Session cookie uvek `secure: false` čak i u produkciji | `server.js:51` |
| 13 | `POST /api/fields` nema proveru `court` role | `fields.js` |
| 14 | Nema role guard na frontend rutama (`/create`, `/profil`, itd.) | `App.tsx` |
| 15 | `POST /leave` endpoint postoji ali frontend ga ne koristi | samo `cancel-attendance` u UI |
| 16 | Duplirana analytics logika (~75 linija × 2) | `players.js` |
| 17 | `playersNeeded` legacy polje + pre-save hook | `Match.js`, ceo frontend |
| 18 | Frontend učitava sve mečeve bez paginacije | `Home.tsx` |
| 19 | Neformalni mečevi prikazuju "Nepoznat teren" | `MojiMecevi.tsx` |
| 20 | Court reservation `playersNeeded: 0` → hook postavlja na 1 | `courts.js` |
| 21 | Join ne blokira `otkazano`, `completed`, `rejected` | `matches.js` |
| 22 | Mešanje jezika u UI | "Last Minute", "Share", "Notification Settings", raw sport keys |
| 23 | `join` failures koriste `alert()` umesto MUI Alert | `Home.tsx` |
| 24 | Dev port 3000 u vite.config, docs kažu 5173 | `vite.config.ts` |
| 25 | Zastarela push migraciona dokumentacija | root MD fajlovi |

### 12.3 🟢 Nizak prioritet / code smell

| # | Problem | Gde |
|---|---------|-----|
| 26 | Nekorišćeni importi | Navbar (`Badge`), Home (`IconButton`, `Tooltip`), Register, AuthCallback, MojTermine, PlayerProfile |
| 27 | Nekorišćene varijable | `upcomingInformalMatches` (Home), `currentUser` (MojiMecevi, MojiIgraci), `user` (NotificationSettings) |
| 28 | `loginWithInstagram` bez UI | AuthContext |
| 29 | `initPushNotifications()` prazan stub | notifications.ts |
| 30 | `CLIENT_URL` dodeljen ali neiskorišćen | server.js:34 |
| 31 | Leaflet icon fix dupliran u 6 fajlova | frontend pages |
| 32 | `formatPlayersCount()` dupliran u 5+ stranica | frontend |
| 33 | Lokalni tipovi umesto `types.ts` | MojiIgraci, MojTermine, ManageFields |
| 34 | `GET /api/courts/matches/pending` ne koristi frontend | koristi per-field appointments |
| 35 | Court default settings endpointi ne koriste frontend | working-hours, default-price, default-deadline |
| 36 | `GET /api/players/analytics/:id`, `is-blocked-by` ne koriste frontend | — |
| 37 | Dupli markeri na mapi (teren + meč na istim koordinatama) | Home.tsx |
| 38 | Nema 404 catch-all rute | App.tsx |
| 39 | `courts.js` free appointments stub (`appointments.free = []`) | nedovršeno |
| 40 | Reliability score dual semantics (stored vs computed) | players.js analytics |

---

## 13. Push obaveštenja — kako rade (detaljno)

### Flow za korisnika

1. Korisnik instalira PWA (preporučeno) ili koristi sajt u Chrome-u
2. Na `/notification-settings` ili `/profil` → dozvola za obaveštenja
3. `subscribeToPushNotifications()` → Service Worker + PushManager + VAPID key
4. Subscription se šalje na `POST /api/players/push-subscription`
5. Korisnik ažurira lokaciju (`POST /api/players/location`) i radius u profilu
6. Kad neko kreira meč → backend šalje push svima u radijusu

### Zašto notifikacije stižu tek kad se otvori Chrome (Android)

- Web Push na Androidu ide preko Chrome-ovog push servisa + service workera
- Ako PWA nije instalirana, SW može biti suspendovan dok browser nije aktivan
- Battery optimization na telefonu može odložiti push delivery
- Ako korisnik nije završio subscribe flow (bug u §12.1 #2, #3), push neće raditi u pozadini
- **Rešenje:** Instalirati PWA, fix NotificationSettings bug, povezati Home banner sa subscribe flow-om

---

## 14. Preporuke za AI pri budućim izmenama

### Uvek poštovati

- UI tekstovi na **srpskom** (`sr-RS` locale za datume)
- Auth preko **cookie-only** — ne vraćati localStorage token pattern
- API pozivi preko `src/lib/api.ts`
- Socket preko `src/lib/socket.ts`
- Greške preko MUI `<Alert severity="error">`
- Minimalan diff — ne refaktorisati širu okolinu bez potrebe

### Pre implementacije proveriti

- Da li izmena utiče na **oba tipa meča** (formalni/neformalni)
- Da li court approval workflow ima smisla posle izmene
- Da li cron i GET /matches daju konzistentan status
- Da li frontend ruta postoji za svaki backend endpoint koji se koristi u UI

### Predloženi redosled popravki

1. Fix NotificationSettings disabled bug
2. Povezati Home banner sa `subscribeToPushNotifications()`
3. Dodati `/profil/:id` rutu
4. Uskladiti cron vs failed/otkazano logiku
5. Role guards na rutama
6. Ukloniti legacy `client/`, `server/`, `firebase` dep, nekorišćene backend pakete
7. Migracija `playersNeeded` → samo `minPlayers`
8. Paginacija na Home
9. Ekstrakcija dupliranih helpera (`formatPlayersCount`, Leaflet icons)

---

## 15. Brzi pregled fajlova

### Backend (13 izvornih fajlova)

| Fajl | Uloga |
|------|-------|
| `server.js` | Entry, MongoDB, cron, Socket.IO, CORS |
| `middleware/auth.js` | JWT middleware |
| `models/User.js`, `Match.js`, `Field.js` | Mongoose šeme |
| `routes/auth.js` | Auth + OAuth |
| `routes/matches.js` | Mečevi, ocene, push trigger |
| `routes/players.js` | Profili, analitika, push, blokiranje |
| `routes/fields.js` | Javni tereni |
| `routes/courts.js` | Court dashboard |
| `utils/notifications.js` | Haversine distanca |
| `utils/pushNotifications.js` | VAPID web push |
| `utils/cloudinary.js` | Upload slika |

### Frontend (27 izvornih fajlova u `src/`)

| Kategorija | Fajlovi |
|------------|---------|
| Pages (12) | Home, CreateMatch, MatchDetails, Login, Register, AuthCallback, ManageFields, MojTermine, PlayerProfile, MojiMecevi, MojiIgraci, NotificationSettings |
| Components (3) | Navbar, RoleSelectionModal, InstallButton |
| Context (2) | AuthContext, ThemeContext |
| Lib (3) | api, socket, notifications |
| Other | App.tsx, main.tsx, types.ts, theme.ts, sw.js, pwa.d.ts, vite-env.d.ts |

---

## 16. Kako pokrenuti lokalno

```bash
# Backend (port 5050)
cd backend && npm install && npm run dev

# Frontend (port 3000 prema vite.config.ts)
cd frontend && npm install && npm run dev
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:5050
VITE_SOCKET_URL=http://localhost:5050
```

---

*Ovaj dokument generisan auditom celog `backend/` i `frontend/` koda. Za kratku AI referencu pogledaj i `CLAUDE.md`.*

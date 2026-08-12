# PlayMatch / Plejko — Kompletna specifikacija aplikacije

> **Svrha dokumenta:** Referenca za AI asistente i developere pri unapređenju, refaktorisanju ili proširivanju aplikacije.  
> **Brend u UI-ju:** **Plejko** (tagline: *Pronađi · Okupi · Igraj*). Repozitorijum i interni naziv projekta: PlayMatch.  
> **Jezik UI-ja:** sr-RS (srpski).  
> **Poslednja revizija:** avgust 2026.  
> **Aktivni kod:** `backend/` + `frontend/` (ostale fascikle su legacy — vidi §11).

---

## 1. Pregled projekta

**Plejko (PlayMatch)** je full-stack PWA za organizaciju okupljanja: sport, društvene igre, pub igre i e-sport / gaming — na srpskom tržištu.

### Ključne mogućnosti

| Oblast | Funkcionalnost |
|--------|----------------|
| **Igre / kategorije** | Katalog `GAME_TYPES`: sport, tabletop, pub, esports; preferirane igre na registraciji i feed filter |
| **Igrači** | Mapa mečeva, kreiranje/prijava, waitlist, brzi chat, cost splitter, ocene, blokiranje, push, trust badge |
| **Vlasnici terena (court)** | Upravljanje terenima, odobrenje rezervacija, rezervacija termina, statistika |
| **Mečevi** | Formalni (registrovan teren) i neformalni (privatna lokacija na mapi) |
| **Real-time** | Socket.IO: `match_updated`, `match_message` |
| **Obaveštenja** | Web Push (VAPID) preko PWA service workera |

### Tech stack

| Sloj | Tehnologije |
|------|-------------|
| Backend | Node.js, Express 4.19, MongoDB/Mongoose 8.6, JWT cookies, Passport OAuth, Socket.IO, web-push, Cloudinary, node-cron |
| Frontend | React 18, TypeScript 5.6, Vite 5.4, MUI 6, Leaflet, React Router 6, vite-plugin-pwa, Axios, Socket.IO client |
| Deploy | Render (Frankfurt), `render.yaml` |

---

## 2. Uloge korisnika

### `player` (igrač)
- Birа preferirane igre pri registraciji (obavezno ≥1)
- Kreira mečeve (formalne i neformalne) **samo** za igre iz `preferredSports`
- Priključuje se mečevima, staje na waitlist, otkazuje dolazak (sa kaznom pouzdanosti)
- Vidi cost splitter, brzi chat (kao učesnik), ocenjuje saigrače
- Upravlja profilom, avatarom, veštinama po sportu/igri
- Prima push u radijusu od lokacije; trust badge na osnovu `reliabilityScore`
- Stranice: Moji mečevi, Moji igrači, Profil, Notification settings

### `court` (vlasnik terena)
- Kreira i uređuje terene (Manage Fields)
- Odobrava/odbija/cancel-uje rezervacije; završava formalne mečeve
- Rezerviše slobodne termine (court reservation)
- Prati statistiku u Moj Termini
- **Nema** player navigaciju (role guard: `CourtRoute` / `PlayerRoute`)

---

## 3. Katalog igara (`GAME_TYPES`)

Izvor istine:
- Backend: `backend/src/constants/games.js`
- Frontend: `frontend/src/constants/games.ts` (+ `CATEGORY_META`, helperi, aliasi)

### Kategorije

| ID | Label (UI) | Primeri |
|----|------------|---------|
| `sport` | Sport | Mali fudbal, košarka, tenis, padel, trčanje… |
| `tabletop` | Društvene igre | Catan, šah, UNO, Codenames, D&D… |
| `pub` | Pub igre | Pikado, bilijar, kuglanje, kviz… |
| `esports` | Gaming | FIFA, LoL, CS2, Valorant, Mario Kart… |

Svaka igra: `{ id, name, category, defaultMinPlayers, defaultMaxPlayers }` (backend ima i alias `minPlayers`/`maxPlayers`).

CreateMatch / Register koriste default min/max iz kataloga. `Match.sport` i `User.preferredSports[]` čuvaju **canonical id** (npr. `football`, `catan`).

---

## 4. Poslovna logika — mečevi

### 4.1 Tipovi mečeva

#### Formalni (`isInformal: false`)
- Obavezan `fieldId` → `Field`
- `registrationDeadline` = `dateTime` − `field.registrationDeadlineHours` (ako bi bio u prošlosti → clamp na ~30 min pre meča)
- Ako teren ima `courtOwner` → `courtApproval: 'pending'`, inače `approved`
- Provera preklapanja termina na istom terenu
- Push koristi koordinate terena
- Završetak: court `POST /api/courts/matches/:id/complete`

#### Neformalni (`isInformal: true`)
- Nema `fieldId`; `informalLocation: { name, lat, lng }`
- Rok prijave: `informalRegistrationDeadlineHours` (1–48h)
- `courtApproval: 'approved'` automatski
- Organizator: `POST /api/matches/:id/complete` + opciono `noShowIds`
- Push koristi `informalLocation`

### 4.2 Statusi (`Match.status`)

| Status | Značenje |
|--------|----------|
| `open` | Otvoren za prijave |
| `full` | Dostignut `minPlayers` |
| `completed` | Meč odigran |
| `failed` | Deadline prošao, nema dovoljno igrača |
| `otkazano` | Otkazan (court reject/cancel ili dovoljno igrača ali court i dalje `pending`) |

### 4.3 Odobrenje terena (`courtApproval`)

| Vrednost | Značenje |
|----------|----------|
| `pending` | Čeka vlasnika terena |
| `approved` | Odobreno |
| `rejected` | Odbijeno → meč `otkazano` |

Default u šemi: `approved`. Formalni meč sa `courtOwner` kreira se kao `pending`.

### 4.4 Prelazi statusa

```
create → open (+ courtApproval pending|approved)
open → full          players.length >= minPlayers
                     (quirk: applyFullStatus tada i auto-approve courtApproval)
open/full → failed   processExpiredMatches: deadline prošao + players < min
open/full → otkazano processExpiredMatches: dovoljno igrača + courtApproval pending
                   | court reject / cancel
full → completed     court complete (formal) ili organizer complete (informal)
```

`processExpiredMatches` (`utils/matchStatus.js`) radi:
- na cron-u (`0 * * * *` + jednom na startu)
- kao side-effect na `GET /api/matches`

### 4.5 Prijava / odjava / waitlist

- **Join** — u `players[]`; skida sa waitlist-a ako je bio; court role zabranjen; blok lista organizatora
- **Leave** — bez kazne (backend postoji; UI koristi cancel-attendance)
- **Cancel attendance** — komentar + reliability kazna po vremenu do meča
- Organizator ne može napustiti kad je `full` / `completed`
- **Waitlist (FIFO)** — kad je kapacitet pun (`maxPlayers` ili 100):
  - `POST /:id/waitlist` / `POST /:id/waitlist/leave`
  - Pri leave/cancel: prvi podoban sa waitlist-a → `players[]` + push „Mesto se oslobodilo!“
  - Preskaču se blokirani i court nalozi

### 4.6 Cost splitter

- Organizator postavlja `pricePerPlayer` (RSD) pri kreiranju ili kasnije (`PUT /:id/price-per-player`)
- `playerPayments[]`: `{ playerId, paid, paidAt?, method: cash|transfer|other }`
- Organizator: `POST /:id/mark-paid` (toggle plaćeno + metod; UI može pominjati IPS)

### 4.7 Brzi chat (`quickMessages`)

- Samo učesnici meča
- Preset poruke + slobodan tekst ≤200 karaktera
- Rate limit ~2s; čuva se do ~100 poruka
- Nije u standardnom match payload-u (`-quickMessages`); API: `GET/POST /:id/messages`
- Socket: `match_message`
- Preseti (npr.): „Donosim loptu“, „Zasmetaću 5 min“, „Koju boju majica?“…

### 4.8 Ocenjivanje

- Kad je `status === 'completed'`
- `GET /:id/rating-status`, `POST /:id/rate` — `{ ratedUserId, stars, fairPlay, skillLevel?, sport }`
- Ažurira `ratingAvg` / `ratingsCount`; opciono `sportSkillLevels`

### 4.9 Pouzdanost (`reliabilityScore`)

Početna: **100** (opseg 0–100).

| Događaj | Poeni |
|---------|-------|
| Cancel ≥2h pre meča | 0 |
| Cancel 1–2h pre | −10 |
| Cancel &lt;1h pre | −15 |
| No-show (informal complete) | −15 |
| Uspešno odigran meč (complete) | +2 (cap 100) |

Implementacija: `backend/src/utils/reliability.js`.  
Frontend trust badge (`lib/reliability.ts`):

| Score | Badge |
|-------|--------|
| &gt; 90 | 🟢 Pouzdan igrač |
| 70–90 | 🟡 Zna da otkaže |
| &lt; 70 | 🔴 Rizičan |

---

## 5. Backend — API referenca

**Base URL:** `/api`  
**Auth:** HttpOnly cookie `token` (JWT 7d) ili `Authorization: Bearer`  
**Middleware:** `auth(true)` obavezna, `auth(false)` opciona

### 5.1 Auth — `/api/auth`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| POST | `/register` | — | Lokalna registracija; player mora `preferredSports` (≥1) |
| POST | `/login` | — | Email/password |
| POST | `/logout` | — | Briše cookie |
| GET | `/me` | ✓ | Trenutni korisnik |
| GET | `/google` (+ callback) | — | Google OAuth; `?state=player\|court` |
| GET | `/facebook` (+ callback) | — | Facebook OAuth |
| POST | `/instagram` | — | Token auth `{ accessToken, role }` |

**Napomena:** Login/register i dalje mogu vratiti JWT u body (legacy); frontend koristi samo cookie.

### 5.2 Tereni — `/api/fields`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| GET | `/` | — | Lista terena |
| GET | `/:id` | — | Detalji |
| POST | `/` | ✓ | Kreiranje; ako je `role===court` → `courtOwner` + default price/deadline |

### 5.3 Mečevi — `/api/matches`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| GET | `/` | opciono | Lista; `?limit`/`?skip`; `processExpiredMatches`; filter blokiranih |
| POST | `/` | ✓ | Kreiranje; validacija `GAME_TYPES` + preferred; push |
| GET | `/:id` | — | Detalji (bez `quickMessages`) |
| POST | `/:id/join` | ✓ | Prijava |
| POST | `/:id/leave` | ✓ | Odjava bez kazne |
| POST | `/:id/cancel-attendance` | ✓ | Odjava sa kaznom |
| POST | `/:id/waitlist` | ✓ | Stani u red |
| POST | `/:id/waitlist/leave` | ✓ | Napusti red |
| PUT | `/:id/price-per-player` | ✓ | Cost splitter (organizator) |
| POST | `/:id/mark-paid` | ✓ | Označi plaćeno (organizator) |
| POST | `/:id/complete` | ✓ | Završetak **neformalnog** meča `{ noShows? }` |
| GET | `/:id/messages` | ✓ | Brzi chat (učesnici) |
| POST | `/:id/messages` | ✓ | Pošalji poruku / preset |
| GET | `/:id/rating-status` | ✓ | Pending ocene |
| POST | `/:id/rate` | ✓ | Pošalji ocene |

**POST /** formalni:
```json
{
  "sport": "football",
  "fieldId": "...",
  "dateTime": "2026-08-15T18:00:00.000Z",
  "minPlayers": 10,
  "maxPlayers": 14,
  "pricePerPlayer": 500
}
```

**POST /** neformalni:
```json
{
  "isInformal": true,
  "sport": "catan",
  "informalLocation": { "name": "Park", "lat": 44.8, "lng": 20.4 },
  "dateTime": "...",
  "minPlayers": 3,
  "maxPlayers": 4,
  "informalRegistrationDeadlineHours": 24,
  "pricePerPlayer": 0
}
```

### 5.4 Igrači — `/api/players`

| Metoda | Putanja | Auth | Opis |
|--------|---------|------|------|
| GET | `/profile/:id` | — | Javni profil |
| GET | `/profile` | ✓ | Sopstveni |
| PUT | `/profile` | ✓ | Ažuriranje (bio, preferredSports, radius…) |
| GET | `/analytics` / `/analytics/:id` | ✓ / — | Statistika |
| POST | `/location` | ✓ | `lastKnownLocation` |
| POST/DELETE | `/push-subscription` | ✓ | Web Push |
| GET | `/push-subscription/status` | ✓ | Status |
| GET | `/vapid-public-key` | — | VAPID public |
| POST | `/test-push` | ✓ | Test |
| GET | `/my-matches/created` | ✓ | Kreirani |
| GET | `/my-matches/joined` | ✓ | Prijavljeni |
| POST | `/upload-avatar` | ✓ | Cloudinary |
| GET | `/my-players` | ✓ | Igrači sa organizatorovih mečeva |
| GET | `/blocked-players` | ✓ | Blok lista |
| POST/DELETE | `/block-player/:playerId` | ✓ | Block / unblock |
| GET | `/is-blocked-by/:userId` | ✓ | Da li me je blokirao |

### 5.5 Court panel — `/api/courts`

Svi zahtevaju auth + `role === 'court'`.

| Metoda | Putanja | Opis |
|--------|---------|------|
| GET | `/matches/pending` | Pending odobrenja |
| POST | `/matches/:id/approve` | Odobri |
| POST | `/matches/:id/reject` | Odbij → `otkazano` |
| POST | `/matches/:id/cancel` | Otkaži odobren |
| POST | `/matches/:id/complete` | Završi formalni (+ reliability reward) |
| PUT | `/working-hours` | Default radno vreme |
| PUT | `/default-price` | Default cena |
| PUT | `/default-deadline` | Default rok prijave (sati) |
| GET | `/appointments` | Dashboard reserved/pending/free/stats |
| GET | `/fields/:fieldId/appointments` | Termini po terenu |
| GET | `/fields` | Tereni vlasnika |
| PUT | `/fields/:fieldId` (+ working-hours, price) | Uređivanje |
| POST | `/appointments/reserve` | Rezervacija termina |

---

## 6. Backend — modeli podataka

### 6.1 User

```
name, email, password?, avatarUrl
provider: local|google|facebook|instagram, providerId, providerData
role: player|court
workingHours, defaultPrice, defaultRegistrationDeadlineHours   (court)
bio, skills, phone, location
preferredSports[]          ← GAME_TYPES id-jevi
experience: beginner|intermediate|advanced|professional
ratingAvg, ratingsCount, reliabilityScore (0–100, default 100)
sportSkillLevels: [{ sport, skillLevel 1–5 }]
notificationEnabled (default true), notificationRadius (default 10 km)
lastKnownLocation: { lat, lng, updatedAt }
pushSubscription: Mixed
blockedPlayers: [ObjectId]
```

### 6.2 Match

```
sport                      ← GAME_TYPES id
fieldId?                   ← obavezan ako !isInformal
isInformal, informalLocation?, informalRegistrationDeadlineHours? (1–48)
dateTime, registrationDeadline
minPlayers, maxPlayers?, playersNeeded (legacy ↔ minPlayers pre-save)
players[], waitlist[], createdBy
status: open|full|completed|failed|otkazano
courtApproval: pending|approved|rejected (default approved)
courtApprovedBy?, courtApprovedAt?, description?
playerCancellations: [{ playerId, comment, cancelledAt, penalizedReliability }]
noShows: [ObjectId]
pricePerPlayer?, playerPayments: [{ playerId, paid, paidAt?, method }]
ratings: [{ raterId, ratedUserId, stars, fairPlay, sport, createdAt }]
quickMessages: [{ userId, text ≤200, isPreset, createdAt }]  ← samo /messages
```

### 6.3 Field

```
name, sports[], lat, lng, courtOwner?, price?
registrationDeadlineHours  (default 0 = do kickoff-a / clamp logika)
workingHours: { [day]: { start, end, closed } }
```

---

## 7. Backend — infrastruktura

### 7.1 Socket.IO

**Klijent → server:** `join_match_room`, `leave_match_room`  
**Server → klijent:**
- `match_updated` — populated match (mutacije, cron)
- `match_message` — brzi chat

### 7.2 Cron / status job

- Raspored: `0 * * * *` + jednom pri startu
- `checkCancelledMatches()` → `processExpiredMatches(io)` (`utils/matchStatus.js`)
- Isti helper i na `GET /api/matches`

### 7.3 Push (`utils/pushNotifications.js`)

- Samo VAPID Web Push
- Triggeri:
  1. `POST /api/matches` → `notifyNearbyPlayers` (lokacija + radius + subscription + `notificationEnabled`; **bez** filtera po `preferredSports`)
  2. Auto-promocija sa waitlist-a
- Default title u payload-u: „Plejko“ / „Novi meč u blizini!“
- Istekle pretplate (410/404) se čiste

### 7.4 Ostali utiliti

| Fajl | Uloga |
|------|--------|
| `utils/notifications.js` | Haversine `calculateDistance` |
| `utils/reliability.js` | Kazne / nagrade pouzdanosti |
| `utils/matchStatus.js` | `processExpiredMatches` |
| `utils/quickMessages.js` | Preseti, limity, format |
| `utils/cloudinary.js` | Avatar upload / OAuth sync |

### 7.5 Skripte

| Skripta | Svrha |
|---------|-------|
| `scripts/backfill-user-metrics.js` | Backfill metrika |
| `scripts/fix-user-index.js` | OAuth unique index |

---

## 8. Frontend — rute i stranice

Role guardovi: `PlayerRoute` / `CourtRoute` (auth + role), plus javne rute.

| Ruta | Komponenta | Guard | Funkcije |
|------|------------|-------|----------|
| `/` | Home | — | Lista/mapa; preferred vs svi mečevi; geolokacija; formal + informal markeri; join/waitlist; notif banner (+ subscribe) |
| `/create` | CreateMatch | Player | 2 koraka: lokacija → datetime/igrači; formal/neformal; price; preferred igre; last-match preset |
| `/matches/:id` | MatchDetails | — | Detalji, mapa, join/waitlist/cancel, share, cost splitter, chat, ocene, informal complete, Socket |
| `/manage-fields` | ManageFields | Court | CRUD terena, radno vreme, approve flow |
| `/moji-termini` | MojTermine | Court | Reserved / pending / free / stats; reserve; complete |
| `/profil` | PlayerProfile | Player | Profil, avatar, analitika, preferred igre, radius |
| `/profil/:id` | PublicPlayerProfile | — | Javni profil + analitika |
| `/moji-mecevi` | MojiMecevi | Player | Kreirani / prijavljeni; informal complete CTA |
| `/moji-igraci` | MojiIgraci | Player | Igrači, block, link na `/profil/:id` |
| `/notification-settings` | NotificationSettings | Player | Subscribe / unsubscribe / test |
| `/login` | Login | — | Email + OAuth |
| `/register` | Register | — | Role + preferred games picker |
| `/auth/callback` | AuthCallback | — | Cookie verify via `/me` |

Nema 404 catch-all rute.

---

## 9. Frontend — arhitektura

### 9.1 Context

| Fajl | Stanje |
|------|--------|
| `AuthContext` | `user`, `loading`; login/register/logout/refreshUser; OAuth |
| `ThemeContext` | light/dark (`theme-mode` u localStorage) |

### 9.2 Lib

| Fajl | Svrha |
|------|-------|
| `api.ts` | Axios, `withCredentials: true`, timeout 10s |
| `socket.ts` | Singleton Socket.IO, `autoConnect: false` |
| `notifications.ts` | VAPID subscribe / unsubscribe / status |
| `reliability.ts` | Trust badge helperi |

### 9.3 Constants / theme

| Fajl | Svrha |
|------|-------|
| `constants/games.ts` | `GAME_TYPES`, kategorije, imena, aliasi |
| `theme.ts` | MUI tema + `brand` tokeni (navy/cyan/magenta…) |

### 9.4 Komponente

| Komponenta | Uloga |
|------------|--------|
| `Navbar` | Role-aware nav, theme, logout, PWA install |
| `PlejkoLogo` | Brend logo / tagline |
| `BrandHero` | Hero na Home (kategorije Sport/Gaming/Društvene) |
| `PreferredGamesPicker` | Multi-select preferiranih igara |
| `SingleGamePreferencePicker` | Single-game izbor (CreateMatch) |
| `MatchQuickChat` | Brzi chat na MatchDetails |
| `RoleSelectionModal` | Player/court pre OAuth |
| `InstallButton` | PWA install prompt |

### 9.5 PWA

- `vite-plugin-pwa`, `injectManifest`, SW: `frontend/src/sw.js`
- Manifest / naslov: **Plejko**
- Push handler + `notificationclick`
- Registracija: `main.tsx` → `registerSW({ immediate: true })`

### 9.6 Tipovi (`types.ts`)

`User`, `Match`, `Field`, `PlayerAnalytics`, `InformalLocation`, `PlayerPayment`, `MatchQuickMessage`, `PushSubscriptionJSON`, `MatchRatingStatus`, `PendingRatingUser`, `PlayerCancellation`

---

## 10. Autentifikacija

```
Browser → Axios (withCredentials) → HttpOnly cookie "token"
OAuth → Passport → setTokenCookie → redirect /auth/callback → GET /me
Frontend NIKAD ne čuva token u localStorage
```

**Cookie (prod):** `SameSite=none`, `Secure=true`, 7d  
**Cookie (dev):** `SameSite=lax`, `Secure=false`

Auth middleware: cookie prvo, zatim Bearer.  
OAuth može i dalje slati `?user=JSON` u redirect URL (PII rizik u history).

---

## 11. Environment varijable

### Backend

```
MONGO_URI, JWT_SECRET, SESSION_SECRET, PORT=5050
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL
CLIENT_URL, BACKEND_URL, API_URL
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:...
NODE_ENV
```

### Frontend

```
VITE_API_URL=...
VITE_SOCKET_URL=...
```

---

## 12. Struktura repozitorijuma

### Aktivni kod

```
playmatch/
├── backend/src/
│   ├── constants/games.js
│   ├── middleware/auth.js
│   ├── models/{User,Match,Field}.js
│   ├── routes/{auth,matches,players,fields,courts}.js
│   ├── utils/{cloudinary,pushNotifications,notifications,
│   │         reliability,matchStatus,quickMessages}.js
│   └── server.js
├── frontend/src/
│   ├── pages/… (uklj. PublicPlayerProfile)
│   ├── components/… (PlejkoLogo, BrandHero, MatchQuickChat, pickers…)
│   ├── constants/games.ts
│   ├── lib/{api,socket,notifications,reliability}.ts
│   └── …
├── render.yaml
├── CLAUDE.md
└── PLAYMATCH_SPECIFICATION.md
```

### Legacy / neaktivni

| Fascikla / fajlovi | Opis |
|--------------------|------|
| `client/`, `server/` | Stari stack — ne koristiti |
| Stari push migracioni MD-ovi | OneSignal/FCM migracija nije aktivna |

---

## 13. Audit — poznati problemi

> Prioritet: 🔴 visok · 🟡 srednji · 🟢 nizak  
> Stavke označene ✅ su rešene u odnosu na prethodnu reviziju specifikacije.

### 13.1 ✅ Rešeno od prethodnog audita

| Ranije | Sada |
|--------|------|
| NotificationSettings deadlock (`disabled` dok permission nije granted) | Dugme disabled samo ako je `permission === 'denied'` |
| Home banner bez subscribe | Banner poziva `subscribeToPushNotifications()` |
| Nema `/profil/:id` | `PublicPlayerProfile` + ruta |
| Nema role guarda | `PlayerRoute` / `CourtRoute` |
| Cron samo `otkazano` vs GET `failed` | Zajednički `processExpiredMatches` (failed **ili** otkazano) |

### 13.2 🔴 Visok prioritet

| # | Problem | Gde | Posledica |
|---|---------|-----|-----------|
| 1 | Push često radi pouzdano tek sa instaliranom PWA | Android/Chrome | SW može biti suspendovan bez install-a |
| 2 | Auto-approve court na `applyFullStatus` | `matches.js` | Kad se popuni `minPlayers`, `courtApproval` → `approved` — court workflow delimično zaobiđen |
| 3 | Push ne filtrira po preferiranim igrama | `notifyNearbyPlayers` | Igrač dobija notifikacije za sve sportove/igre u radijusu |

### 13.3 🟡 Srednji

| # | Problem | Gde |
|---|---------|-----|
| 4 | Legacy `client/` i `server/` | root |
| 5 | JWT i dalje u response body (register/login) | `auth.js` |
| 6 | OAuth redirect `?user=JSON` | `auth.js` |
| 7 | Session cookie `secure: false` i u produkciji | `server.js` |
| 8 | `POST /api/fields` nema strogu proveru `court` role | `fields.js` |
| 9 | `POST /leave` postoji, UI koristi samo cancel-attendance | matches UI |
| 10 | Duplirana analytics logika | `players.js` |
| 11 | `playersNeeded` legacy + pre-save | Match + frontend |
| 12 | Home učitava mečeve bez korišćenja paginacije | `Home.tsx` |
| 13 | Join ne blokira sve terminalne statuse konzistentno | `matches.js` |
| 14 | Mešanje engleskih stringova u UI | razni |
| 15 | Dev port 3000 u `vite.config` (docs ponekad kažu 5173) | vite |
| 16 | Court `appointments.free` često prazan stub | `courts.js` |
| 17 | Reliability dual semantics u analytics (stored vs computed fallback) | `players.js` |

### 13.4 🟢 Nizak / code smell

| # | Problem |
|---|---------|
| 18 | Leaflet icon fix / `formatPlayersCount` duplikati |
| 19 | Lokalni tipovi umesto `types.ts` na nekim court stranicama |
| 20 | Court default settings endpointi retko korišćeni iz UI |
| 21 | Dupli markeri (teren + meč) na istim koordinatama |
| 22 | Nema 404 rute |
| 23 | `loginWithInstagram` bez UI |
| 24 | Nekorišćeni importi / dead code na mestima |

---

## 14. Push obaveštenja — flow

1. Instalirati PWA (preporučeno) ili Chrome sa dozvolom
2. `/notification-settings`, `/profil` ili Home banner → permission + subscribe
3. `subscribeToPushNotifications()` → SW + PushManager + VAPID → `POST /api/players/push-subscription`
4. Lokacija: `POST /api/players/location`; radius u profilu
5. Novi meč → push svima u radijusu (bez preferred-sports filtera)
6. Waitlist promocija → poseban push

---

## 15. Preporuke za AI pri izmenama

### Uvek poštovati

- UI na **srpskom**; brend **Plejko** u user-facing copy
- Cookie-only auth na frontendu
- API preko `src/lib/api.ts`; socket preko `src/lib/socket.ts`
- Igre iz `GAME_TYPES` (backend + frontend sync)
- Formalni **i** neformalni mečevi pri svakoj izmeni match logike
- Greške: MUI `<Alert>`; datumi: `toLocaleString('sr-RS', …)`
- Minimalan diff

### Pre implementacije proveriti

- Court approval vs `applyFullStatus` auto-approve
- Cron / `processExpiredMatches` konzistentnost
- Da li ruta ima odgovarajući role guard
- Da li push / chat / payments treba ažurirati uz novi match event

### Predloženi redosled popravki

1. Ukloniti ili usloviti auto-approve `courtApproval` u `applyFullStatus`
2. Opciono: filter push po `preferredSports`
3. Migracija `playersNeeded` → samo `minPlayers`
4. Ukloniti legacy `client/`, `server/`
5. Paginacija na Home
6. Ekstrakcija dupliranih helpera
7. Ukloniti JWT iz response body / `?user=` iz OAuth URL

---

## 16. Brzi pregled fajlova

### Backend

| Fajl | Uloga |
|------|--------|
| `server.js` | Entry, MongoDB, cron, Socket.IO, CORS |
| `middleware/auth.js` | JWT |
| `models/*` | User, Match, Field |
| `constants/games.js` | Katalog igara |
| `routes/auth.js` | Auth + OAuth |
| `routes/matches.js` | Mečevi, waitlist, payments, chat, ocene, push trigger |
| `routes/players.js` | Profili, analitika, push, block |
| `routes/fields.js` | Javni tereni |
| `routes/courts.js` | Court dashboard |
| `utils/*` | Push, distance, reliability, matchStatus, quickMessages, cloudinary |

### Frontend (`src/`)

| Kategorija | Fajlovi |
|------------|---------|
| Pages (13) | Home, CreateMatch, MatchDetails, Login, Register, AuthCallback, ManageFields, MojTermine, PlayerProfile, PublicPlayerProfile, MojiMecevi, MojiIgraci, NotificationSettings |
| Components | Navbar, RoleSelectionModal, InstallButton, PlejkoLogo, BrandHero, MatchQuickChat, PreferredGamesPicker, SingleGamePreferencePicker |
| Context | AuthContext, ThemeContext |
| Lib | api, socket, notifications, reliability |
| Constants | games.ts |
| Other | App.tsx, main.tsx, types.ts, theme.ts, sw.js |

---

## 17. Lokalni setup

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

## 18. Changelog specifikacije (avgust 2026)

U odnosu na prethodnu reviziju dokumenta, usklađeno sa kodom:

- **Brend Plejko** + multi-category `GAME_TYPES` (sport / tabletop / pub / esports)
- **Waitlist**, **cost splitter**, **brzi chat** (`quickMessages` + Socket `match_message`)
- Tačna **reliability** tabela + trust badge
- **Preferirane igre** na registraciji / create / Home filter
- Ispravljen opis cron-a → `processExpiredMatches` (failed | otkazano)
- Push: **nema** preferredSports filter (ranije pogrešno dokumentovano)
- Field `registrationDeadlineHours` default **0**
- CreateMatch = **2 koraka**; role guardi; `/profil/:id`
- NotificationSettings / Home banner subscribe — bugovi zatvoreni
- Novi utiliti i komponente u inventaru fajlova

---

*Dokument usklađen auditom aktivnog `backend/` i `frontend/` koda. Za kratku AI referencu vidi i `CLAUDE.md` (može biti stariji od ovog fajla).*

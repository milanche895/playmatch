# Testiranje Push Notifikacija

## 1. Provera VAPID Keys

### Backend provera:
```bash
cd backend
# Proveri da li postoje VAPID keys u .env fajlu
cat .env | grep VAPID
```

Trebalo bi da vidiš:
```
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

### Generisanje VAPID keys (ako nisu postavljeni):
```bash
cd backend
npx web-push generate-vapid-keys
```

Kopiraj generisane ključeve u `.env` fajl.

---

## 2. Provera Push Subscription Status

### U Browser-u (Chrome DevTools):

1. **Otvori Developer Tools** (F12)
2. **Application tab** → **Service Workers**
   - Proveri da li je service worker aktivan
   - Status bi trebao biti "activated and is running"
   
3. **Application** → **Service Workers** → **Push**
   - Klikni na "Push" dugme da testiraš push notifikaciju direktno iz browser-a
   - Ovo će poslati test push sa tekstom (ne JSON)

### U Console-u:

Otvori Console u DevTools i pokreni:
```javascript
// Proveri da li postoji service worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg ? 'Registered' : 'Not registered');
  
  if (reg) {
    reg.pushManager.getSubscription().then(sub => {
      console.log('Push Subscription:', sub ? 'Active' : 'Not subscribed');
      if (sub) {
        console.log('Subscription endpoint:', sub.endpoint);
      }
    });
  }
});

// Proveri dozvolu za notifikacije
Notification.requestPermission().then(permission => {
  console.log('Notification permission:', permission);
});
```

---

## 3. Testiranje kroz Backend API

### Korak 1: Login i dobijanje token-a
Uloguj se u aplikaciju da dobiješ session cookie.

### Korak 2: Subscription kroz profil
1. Otvori `/profil` stranicu
2. Aplikacija će automatski:
   - Tražiti dozvolu za notifikacije (klikni "Allow")
   - Tražiti geolokaciju (klikni "Allow")
   - Subscribovati se na push notifikacije

### Korak 3: Test push endpoint
Posle subscription-a, možeš testirati kroz backend:

**Sa Postman/Thunder Client:**
```
POST http://localhost:5050/api/players/test-push
Headers:
  Cookie: token=your_token_here (ili Authorization header ako koristiš)
```

**Ili kroz browser console (nakon login-a):**
```javascript
// Test push endpoint
fetch('/api/players/test-push', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('Test push result:', data))
.catch(err => console.error('Error:', err));
```

Ako je sve OK, dobijaćeš:
```json
{
  "message": "Test push notifikacija je poslata!",
  "success": true
}
```

---

## 4. Testiranje kroz Kreiranje Meča

### Full flow test:

1. **Korisnik A (Court)**: Kreira novi meč
2. **Korisnik B (Player)**: 
   - Ima omogućene notifikacije na profilu
   - Postavljen radius (npr. 10 km)
   - Ima push subscription
   - Njegova lokacija je unutar radiusa od terena

3. **Očekivani rezultat**: Korisnik B dobija push notifikaciju sa:
   - Naslov: "Novi meč u blizini! ⚽"
   - Tekst: "Ime terena - datum i vreme"
   - Klik na notifikaciju vodi na `/matches/{matchId}`

---

## 5. Debugging Problema

### Problem: "No notification permission"
**Rešenje**: 
- Otvori PlayerProfile stranicu
- Klikni "Allow" kada browser traži dozvolu
- Ili: Browser Settings → Site Settings → Notifications → Allow

### Problem: "VAPID keys not configured"
**Rešenje**:
```bash
cd backend
npx web-push generate-vapid-keys
# Dodaj ključeve u backend/.env
```

### Problem: "Invalid subscription" ili 410 Gone
**Rešenje**:
- Subscription je istekao
- Otvori ponovo profil stranicu da se re-subscribe
- Backend automatski uklanja istekle subscriptions

### Problem: Service worker ne radi
**Rešenje**:
1. Chrome DevTools → Application → Service Workers
2. Klikni "Unregister" pa "Update"
3. Refresh stranicu
4. Proveri Console za greške

### Problem: Push notifikacije ne stižu
**Checklist**:
- [ ] VAPID keys su postavljeni u `.env`
- [ ] Notification permission je "granted"
- [ ] Push subscription postoji u bazi
- [ ] Service worker je aktivan
- [ ] Korisnik ima `notificationEnabled: true`
- [ ] Korisnik ima validnu `lastKnownLocation`
- [ ] Distance je unutar `notificationRadius`

---

## 6. Browser DevTools - Manual Test

### Chrome DevTools Push Test:
1. Application → Service Workers
2. Nađi svoj service worker
3. Klikni "Push" dugme
4. Ovo će poslati test push (tekst, ne JSON)
5. Service worker će parsirati tekst i prikazati notifikaciju

---

## 7. Provera u Database

```javascript
// MongoDB shell ili Compass
db.users.findOne(
  { email: "test@example.com" },
  { 
    pushSubscription: 1,
    notificationEnabled: 1,
    notificationRadius: 1,
    lastKnownLocation: 1
  }
)
```

Trebalo bi da vidiš:
```json
{
  "pushSubscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "notificationEnabled": true,
  "notificationRadius": 10,
  "lastKnownLocation": {
    "lat": 44.7866,
    "lng": 20.4489,
    "updatedAt": "..."
  }
}
```

---

## 8. Test Scenarios

### Scenario 1: Direct Test Push
```
1. Login kao player
2. Otvori profil → subscription se dešava automatski
3. Test push kroz API: POST /api/players/test-push
4. Očekivano: Push notifikacija se pojavljuje
```

### Scenario 2: Match Creation Test
```
1. Player A postavi lokaciju (Beograd centar)
2. Player A omogući notifikacije (radius: 5 km)
3. Court kreira meč na terenu koji je 3 km od Player A lokacije
4. Očekivano: Player A dobija push notifikaciju
```

### Scenario 3: Distance Test
```
1. Player A postavi lokaciju (Beograd)
2. Player A postavi radius: 2 km
3. Court kreira meč na terenu koji je 5 km daleko
4. Očekivano: Player A NE dobija notifikaciju (prevelika distance)
```

---

## Troubleshooting Command

Kreiraj test skriptu za brzu proveru:

```bash
# backend/test-push.js
const { getVapidPublicKey } = require('./src/utils/pushNotifications');
console.log('VAPID Public Key:', getVapidPublicKey() ? '✅ Set' : '❌ Missing');
```

```bash
node backend/test-push.js
```

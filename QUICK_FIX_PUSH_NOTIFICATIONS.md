# Brza Pomoć: Push Notifikacije Ne Rade

## ⚡ Brza Provera (5 minuta)

### 1. Proverite Da Li Ste Pretplaćeni

**Otvorite aplikaciju na telefonu:**
1. Idite na `/notification-settings`
2. Proverite status:
   - ✅ Status: "Omogućeno" 
   - ✅ Dozvola: "Dozvoljeno"
   - ✅ Provider prikazan (OneSignal ili FCM)

**Ako niste pretplaćeni:**
- Kliknite "Omogući Obaveštenja"
- Dozvolite kada browser zatraži
- Čekajte poruku "Obaveštenja su uspešno omogućena!"

### 2. Test Notifikacija

**Idite na `/notification-settings`:**
- Kliknite "Pošalji Test Notifikaciju"
- **Ako test stigne** → Vaša pretplata radi! Problem je verovatno u slanju notifikacija za meč
- **Ako test NE stigne** → Problem je u pretplati (vidi korak 3)

### 3. Proverite Backend Logove

**Kada kreiramo novi meč, u backend logovima treba da vidite:**

```
[Push Notifications] Found X players with notifications enabled
[Push Notifications] Found Y nearby players within radius
[Push Notifications] Prepared Z subscriptions to send
✅ Sent X push notifications, Y failed
```

**Ako vidite:**
- `No players to notify` → Nema igrača sa omogućenim notifikacijama
- `No nearby players to notify` → Svi igrači su van radijusa
- `No valid subscriptions` → Igrači nisu pretplaćeni
- Greške → Proverite konfiguraciju (vidi korak 4)

### 4. Proverite Konfiguraciju

**Backend .env na serveru mora imati:**

```env
# Za OneSignal:
PUSH_NOTIFICATION_PROVIDER=onesignal
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_REST_API_KEY=your_rest_api_key

# ILI za FCM:
PUSH_NOTIFICATION_PROVIDER=fcm
FIREBASE_ADMIN_CREDENTIALS_PATH=/path/to/service-account.json
```

**Proverite:**
- Da li su environment varijable postavljene?
- Da li je backend restart-ovan posle promene .env?
- Da li backend logovi pri startu pokazuju "✅ OneSignal initialized" ili "✅ Firebase Admin SDK initialized"?

### 5. Proverite Da Li Imate Lokaciju

**Notifikacije se šalju samo ako:**
- ✅ Imaš `notificationEnabled: true`
- ✅ Imaš `lastKnownLocation` (lat, lng)
- ✅ Si pretplaćen
- ✅ Si unutar radijusa meča (default 10km)

**Kako proveriti:**
- Idite na `/profil` stranicu
- Aplikacija će zatražiti lokaciju
- Proverite da li je lokacija sačuvana

## 🔍 Česti Problemi

### Problem 1: "Test notifikacija radi, ali ne stižu notifikacije za meč"

**Provera:**
1. **Da li ste vi kreator meča?** 
   - Kreatori NE dobijaju notifikacije (samo drugi igrači)

2. **Da li ste unutar radijusa?**
   - Default radijus je 10km
   - Proverite u `/profil` → "Radius obaveštenja"

3. **Proverite backend logove:**
   - Kada kreiramo meč, treba da vidite poruke o broju igrača

### Problem 2: "Notifikacije ne rade na iOS"

**iOS Safari:**
- ✅ Podržava web push (iOS 16.4+)
- ❌ Starije verzije NE podržavaju
- Proverite iOS verziju: Settings → General → About → iOS Version

### Problem 3: "Service Worker nije aktivan"

**Rešenje:**
1. Otvorite browser DevTools (Remote Debugging na telefonu)
2. Application → Service Workers
3. Unregister sve service worker-e
4. Osvježite stranicu
5. Pokušajte ponovo da se pretplatite

### Problem 4: "Permission denied"

**Rešenje:**
- **Android Chrome:** Settings → Site Settings → Notifications → Allow
- **iOS Safari:** Settings → Safari → Notifications → Allow

## 📱 Mobilni Browser Support

| Browser | Web Push Support | Notes |
|---------|------------------|-------|
| Android Chrome | ✅ Da | Potrebna dozvola |
| iOS Safari | ✅ Da (16.4+) | Starije verzije ne |
| Firefox Mobile | ⚠️ Ograničeno | Može raditi, ali nije pouzdano |

## ✅ Finalni Checklist

Pre nego što kažete "ne radi", proverite:

- [ ] Pretplaćen na notifikacije (`/notification-settings` → "Omogućeno")
- [ ] Browser dozvola data
- [ ] Test notifikacija radi
- [ ] Lokacija sačuvana (idite na `/profil`)
- [ ] Backend environment varijable postavljene
- [ ] Backend restart-ovan posle promene .env
- [ ] Nisi kreator meča (kreatori ne dobijaju notifikacije)
- [ ] Unutar radijusa meča
- [ ] Backend logovi pokazuju "Sent X notifications"

## 🚨 Ako Ništa Ne Pomaže

1. **Proverite backend logove na serveru:**
   - Šta se dešava kada kreiramo meč?
   - Ima li grešaka?

2. **Proverite browser console (Remote Debugging):**
   - Otvorite DevTools na telefonu
   - Console tab
   - Ima li grešaka?

3. **Kontaktirajte podršku sa:**
   - Backend logovima
   - Browser console logovima
   - Statusom pretplate (`/notification-settings`)
   - Verzijom iOS/Android i browser-a

# Debug Push Notifikacija - Vodič za Rešavanje Problema

## Čest Problem: Push Notifikacije Ne Rade na Mobilnom Uređaju

### Korak 1: Proverite Da Li Ste Pretplaćeni

1. **Otvorite aplikaciju u browser-u na telefonu**
2. **Idite na `/notification-settings` stranicu**
3. **Proverite status:**
   - Da li piše "Omogućeno" ili "Onemogućeno"?
   - Da li je dozvola pretraživača "Dozvoljeno"?
   - Da li je prikazan provider (OneSignal ili FCM)?

4. **Ako niste pretplaćeni:**
   - Kliknite "Omogući Obaveštenja"
   - Dozvolite notifikacije kada browser zatraži
   - Čekajte potvrdu "Obaveštenja su uspešno omogućena!"

### Korak 2: Proverite Backend Konfiguraciju

**Proverite backend logove kada kreiramo novi meč:**

```bash
# Na serveru, proverite logove
# Trebalo bi da vidite:
# "✅ Sent X push notifications, Y failed"
# ili
# "No players to notify"
# ili greške
```

**Proverite environment varijable na serveru:**

```bash
# Backend .env mora imati:
PUSH_NOTIFICATION_PROVIDER=onesignal  # ili 'fcm'
ONESIGNAL_APP_ID=your_app_id          # za OneSignal
ONESIGNAL_REST_API_KEY=your_key       # za OneSignal
# ILI
FIREBASE_ADMIN_CREDENTIALS_PATH=...   # za FCM
```

### Korak 3: Proverite Service Worker-e

**Za OneSignal:**
- Service worker mora biti dostupan na: `https://yourdomain.com/OneSignalSDKWorker.js`
- Proverite u browser DevTools → Application → Service Workers

**Za FCM:**
- Service worker mora biti dostupan na: `https://yourdomain.com/firebase-messaging-sw.js`

**Proverite:**
1. Otvorite browser DevTools na telefonu (Remote Debugging)
2. Application → Service Workers
3. Da li su service worker-i registrovani i aktivni?

### Korak 4: Proverite Mobilni Browser

**Android Chrome:**
- ✅ Podržava web push notifikacije
- Potrebna je dozvola za notifikacije
- Aplikacija mora biti instalirana kao PWA

**iOS Safari:**
- ✅ Podržava web push notifikacije (iOS 16.4+)
- ⚠️ Starije verzije iOS-a NE podržavaju web push
- Potrebna je dozvola za notifikacije

**Firefox Mobile:**
- ⚠️ Ograničena podrška za web push

### Korak 5: Test Notifikacije

1. **Idite na `/notification-settings`**
2. **Kliknite "Pošalji Test Notifikaciju"**
3. **Ako test notifikacija stigne:**
   - Vaša pretplata radi!
   - Problem je verovatno u slanju notifikacija kada se kreira meč
4. **Ako test notifikacija NE stigne:**
   - Problem je u pretplati ili konfiguraciji

### Korak 6: Proverite Backend Logove

Kada se kreira novi meč, backend logovi treba da pokažu:

```
✅ Sent X push notifications, Y failed
```

Ako vidite:
- `No players to notify` - Nema igrača sa omogućenim notifikacijama u radijusu
- `No nearby players to notify` - Igrači su van radijusa
- Greške - Proverite OneSignal/FCM konfiguraciju

### Korak 7: Proverite Da Li Imate Lokaciju

Push notifikacije se šalju samo igračima koji:
1. ✅ Ima `notificationEnabled: true`
2. ✅ Ima `lastKnownLocation` (lat, lng)
3. ✅ Je pretplaćen (ima `oneSignalUserId` ili `fcmTokens`)
4. ✅ Je unutar `notificationRadius` od meča

**Proverite:**
- Idite na `/profil` stranicu
- Aplikacija će automatski zatražiti vašu lokaciju
- Proverite da li je lokacija sačuvana

### Korak 8: Common Issues

#### Issue 1: "Service Worker nije aktivan"
**Rešenje:**
- Obrišite service worker u DevTools → Application → Service Workers → Unregister
- Osvježite stranicu
- Pokušajte ponovo da se pretplatite

#### Issue 2: "Permission denied"
**Rešenje:**
- Idite u browser Settings → Site Settings → Notifications
- Omogućite notifikacije za vašu aplikaciju
- Pokušajte ponovo

#### Issue 3: "OneSignal/FCM nije inicijalizovan"
**Rešenje:**
- Proverite environment varijable na serveru
- Proverite da li su service worker-i dostupni na root domenu
- Proverite backend logove za greške inicijalizacije

#### Issue 4: "Notifikacije ne stižu kada se kreira meč"
**Proverite:**
1. Da li ste vi kreator meča? (Kreatori ne dobijaju notifikacije)
2. Da li ste unutar radijusa meča?
3. Da li imate `notificationEnabled: true`?
4. Backend logove za greške

## Debug Checklist

- [ ] Pretplaćen na notifikacije (`/notification-settings` → "Omogućeno")
- [ ] Browser dozvola data (Settings → Notifications → Allowed)
- [ ] Service worker aktivan (DevTools → Service Workers)
- [ ] Backend environment varijable postavljene
- [ ] Lokacija sačuvana (idite na `/profil`)
- [ ] Test notifikacija radi
- [ ] Niste kreator meča (kreatori ne dobijaju notifikacije)
- [ ] Unutar radijusa meča (`notificationRadius`)
- [ ] Backend logovi pokazuju "Sent X notifications"

## Kako Testirati Lokalno

1. **Start backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Otvorite u browser-u:**
   - `http://localhost:3000`
   - Idite na `/notification-settings`
   - Omogućite notifikacije
   - Pošaljite test notifikaciju

4. **Kreirajte test meč:**
   - Idite na `/create`
   - Kreirajte novi meč
   - Proverite backend logove

## Kako Testirati na Produkciji

1. **Otvorite aplikaciju na telefonu**
2. **Idite na `/notification-settings`**
3. **Proverite status pretplate**
4. **Pošaljite test notifikaciju**
5. **Proverite backend logove na serveru**

## Kontakt za Pomoć

Ako ništa od navedenog ne pomaže:
1. Proverite backend logove za detaljne greške
2. Proverite browser console na telefonu (Remote Debugging)
3. Proverite da li service worker-i rade
4. Proverite OneSignal/FCM dashboard za status notifikacija

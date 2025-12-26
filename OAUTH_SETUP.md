# OAuth Setup Guide

Ova aplikacija sada podržava prijavu i registraciju preko Gmail-a (Google), Facebook-a i Instagrama.

## Backend Environment Variables

Dodajte sledeće varijable u vaš `.env` fajl u `backend` folderu:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5050/api/auth/google/callback
# Za produkciju: https://yourdomain.com/api/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5050/api/auth/facebook/callback
# Za produkciju: https://yourdomain.com/api/auth/facebook/callback

# Backend URL (za callback)
BACKEND_URL=http://localhost:5050
# Za produkciju: https://yourdomain.com

# Frontend URL (za redirect nakon OAuth)
CLIENT_URL=http://localhost:5173
# Za produkciju: https://yourdomain.com

# Session Secret (za OAuth sesije)
SESSION_SECRET=your_random_session_secret
```

## Frontend Environment Variables

Dodajte u vaš `.env` fajl u `frontend` folderu:

```env
VITE_API_URL=http://localhost:5050
```

**Napomena**: Više nije potrebno `VITE_FACEBOOK_APP_ID` jer koristimo server-side OAuth redirect flow umesto Facebook SDK.

## Kako dobiti OAuth credentials

### Google OAuth

1. Idite na [Google Cloud Console](https://console.cloud.google.com/)
2. Kreirajte novi projekat ili izaberite postojeći
3. Idite na "APIs & Services" > "Credentials"
4. Kliknite "Create Credentials" > "OAuth client ID"
5. Izaberite "Web application"
6. Dodajte "Authorized redirect URIs":
   - Development: `http://localhost:5050/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
7. Kopirajte Client ID i Client Secret u `.env` fajl

### Facebook OAuth

1. Idite na [Facebook Developers](https://developers.facebook.com/)
2. Kreirajte novu aplikaciju
3. Dodajte "Facebook Login" proizvod
4. U Settings > Basic, kopirajte App ID i App Secret
5. U Settings > Facebook Login > Settings, dodajte:
   - Valid OAuth Redirect URIs: `http://localhost:5050/api/auth/facebook/callback` (ili vaš production callback URL)
   - Note: Ne treba više `VITE_FACEBOOK_APP_ID` u frontend `.env` jer koristimo server-side redirect flow umesto `FB.login()` metode

### Instagram OAuth

Instagram OAuth trenutno nije dostupan jer zahteva HTTPS i Facebook SDK (`FB.login()` metoda). Korisnici mogu koristiti Facebook login umesto Instagram-a.

## Funkcionalnosti

- **Gmail (Google)**: Korisnici mogu da se prijave/registruju klikom na "Prijavi se sa Gmail-om" (koristi server-side OAuth redirect flow)
- **Facebook**: Korisnici mogu da se prijave/registruju klikom na "Prijavi se sa Facebook-om" (koristi server-side OAuth redirect flow, radi sa HTTP u development-u)
- **Instagram**: Trenutno nije dostupan (zahteva HTTPS i Facebook SDK)

## Napomene

- OAuth korisnici ne moraju da imaju lozinku
- Ako korisnik već ima nalog sa istim email-om, OAuth će povezati nalog
- OAuth korisnici ne mogu da se prijave sa email/lozinkom - moraju koristiti OAuth dugme

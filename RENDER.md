# Render Deployment Guide

Ovaj vodič objašnjava kako da deployujete PlayMatch aplikaciju na Render.

## Preduslovi

1. GitHub nalog sa vašim kodom u repository-ju
2. Render nalog (besplatan na [render.com](https://render.com))
3. MongoDB Atlas nalog (besplatna opcija je dovoljna)

## Korak 1: MongoDB Atlas Setup

1. Idite na [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) i kreirajte nalog
2. Kreirajte novi **Free** cluster
3. Konfigurišite:
   - **Username**: korisničko ime za bazu
   - **Password**: sigurna lozinka (sačuvajte je!)
   - **Network Access**: Dodajte `0.0.0.0/0` (ili Render IPs) za pristup
4. Kliknite "Connect" → "Connect your application"
5. Kopirajte connection string (izgleda ovako):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/playmatch?retryWrites=true&w=majority
   ```

## Korak 2: Render Setup - Backend

1. Idite na [Render Dashboard](https://dashboard.render.com)
2. Kliknite **"New +"** → **"Web Service"**
3. Povežite svoj GitHub repository
4. Konfigurišite servis:
   - **Name**: `playmatch-backend`
   - **Region**: `Frankfurt` (ili bliži vama)
   - **Branch**: `main` (ili vaša glavna grana)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. Dodajte **Environment Variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render automatski dodeljuje port)
   - `MONGO_URI` = Vaš MongoDB Atlas connection string (sačuvajte iz Koraka 1)
   - `JWT_SECRET` = Generišite sigurnu random vrednost (npr. koristite `openssl rand -hex 32`)
   - `CLIENT_URL` = Ne postavljajte još, dodajte nakon što frontend bude deployovan

6. Kliknite **"Create Web Service"**

## Korak 3: Render Setup - Frontend

1. Nakon što backend počne da radi, idite na **"New +"** → **"Web Service"**
2. Povežite isti GitHub repository
3. Konfigurišite servis:
   - **Name**: `playmatch-frontend`
   - **Region**: `Frankfurt` (isti kao backend)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx vite preview --port $PORT --host`
   - **Instance Type**: `Free`

4. Dodajte **Environment Variables**:
   - `VITE_API_URL` = URL vašeg backend servisa (npr. `https://playmatch-backend.onrender.com`)
   - `VITE_SOCKET_URL` = Isti kao `VITE_API_URL` (npr. `https://playmatch-backend.onrender.com`)

5. Kliknite **"Create Web Service"**

## Korak 4: Ažuriranje Backend CLIENT_URL

1. Idite nazad na backend servis u Render Dashboard-u
2. Idite na **"Environment"** tab
3. Ažurirajte `CLIENT_URL` na URL vašeg frontend servisa (npr. `https://playmatch-frontend.onrender.com`)
4. Kliknite **"Save Changes"** - servis će se automatski restartovati

## Korak 5: Ažuriranje CORS-a i Socket.IO

Backend već ima podešen CORS i Socket.IO sa `CLIENT_URL` varijablom, tako da bi trebalo da radi automatski nakon što postavite `CLIENT_URL`.

**VAŽNO**: 
- `CLIENT_URL` u backend-u mora biti tačan URL frontend servisa (npr. `https://playmatch-frontend.onrender.com`)
- Ne dodavajte trailing slash na kraju URL-a
- Socket.IO će raditi samo ako su oba servisa (frontend i backend) na Render-u

## Alternativa: Korišćenje render.yaml

Umesto ručnog kreiranja servisa, možete koristiti `render.yaml` fajl:

1. Idite na Render Dashboard
2. Kliknite **"New +"** → **"Blueprint"**
3. Povežite repository i odaberite branch
4. Render će automatski pronaći `render.yaml` fajl
5. Odobrite kreiranje servisa
6. **VAŽNO**: Postavite environment variables ručno u Render Dashboard-u:
   - Backend: `MONGO_URI`, `CLIENT_URL` (nakon frontend deploya)
   - Frontend: `VITE_API_URL` (URL backend servisa)

## Provera Deployment-a

1. **Backend**: Idite na `https://your-backend-name.onrender.com/api/fields` - trebalo bi da dobijete response
2. **Frontend**: Idite na `https://your-frontend-name.onrender.com` - trebalo bi da se aplikacija učita

## Troubleshooting

### Backend se ne pokreće
- Proverite da li je `MONGO_URI` ispravno postavljen
- Proverite logs u Render Dashboard-u
- Proverite da li je MongoDB Atlas network access dozvoljen za Render IPs

### Frontend ne može da se poveže sa backend-om
- Proverite da li je `VITE_API_URL` ispravno postavljen
- Proverite da li backend radi (idite na backend URL u browseru)
- Proverite CORS postavke u backend-u

### Socket.IO ne radi
- Proverite da li je `CLIENT_URL` ispravno postavljen u backend-u
- Socket.IO zahteva WebSocket podršku (Render Free plan to podržava)
- Proverite da li frontend koristi ispravan Socket.IO URL
- U produkciji, Socket.IO URL mora biti isti kao backend URL (npr. `wss://playmatch-backend.onrender.com`)

## Napomene

- Render Free plan stavlja servise u "sleep" nakon neaktivnosti, što znači da prvo učitavanje može biti sporije (~30 sekundi)
- Za produkciju, razmotrite upgrade na Starter plan ($7/mesec) da izbegnete sleep mode
- MongoDB Atlas Free tier ima 512MB storage - dovoljno za MVP

## Korisni linkovi

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)


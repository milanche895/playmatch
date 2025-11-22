# PlayMatch Global

MVP web aplikacija za pronalaženje sportskih terena i organizovanje mečeva.

## Tehnologije

- **Frontend**: React + Vite + TypeScript + Material-UI + Leaflet
- **Backend**: Node.js + Express + MongoDB + Socket.IO
- **Autentikacija**: JWT (HttpOnly cookies)

## Preduslovi

- Node.js 18+
- MongoDB (lokalno ili MongoDB Atlas)

## Instalacija i pokretanje

### 1. MongoDB Setup

**Opcija A: Lokalni MongoDB**
- Instalirajte MongoDB Community Edition
- Pokrenite MongoDB servis:
  ```powershell
  # Na Windows-u, MongoDB se obično pokreće kao Windows servis automatski
  # Proverite u Services (services.msc) da li je "MongoDB" pokrenut
  ```

**Opcija B: MongoDB Atlas (Cloud - Preporučeno)**
- Kreirajte besplatan nalog na [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Kreirajte novi cluster
- Kopirajte connection string
- Zamenite `<password>` i `<dbname>` u stringu

### 2. Backend Setup

```powershell
cd backend
npm install
```

Kreirajte `.env` fajl u `backend/` direktorijumu:
```
PORT=5050
MONGO_URI=mongodb://localhost:27017/playmatch
# Ili za MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/playmatch
JWT_SECRET=your_secret_key_here
CLIENT_URL=http://localhost:3000
```

Pokrenite backend:
```powershell
npm run dev
```

Backend će biti dostupan na `http://localhost:5050`

### 3. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend će biti dostupan na `http://localhost:3000`

## Struktura projekta

```
playmatch/
├── backend/
│   ├── src/
│   │   ├── models/      # Mongoose modeli
│   │   ├── routes/      # API rute
│   │   ├── middleware/  # Auth middleware
│   │   └── server.js    # Glavni server fajl
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # React komponente
│   │   ├── pages/       # Stranice
│   │   ├── context/     # Auth context
│   │   ├── lib/         # API i Socket.IO klijent
│   │   └── types.ts     # TypeScript tipovi
│   └── package.json
└── README.md
```

## Funkcionalnosti

- ✅ Registracija i prijava korisnika
- ✅ Pregled sportskih terena na mapi (Leaflet)
- ✅ Kreiranje meča
- ✅ Pridruživanje meču
- ✅ Real-time ažuriranje broja igrača (Socket.IO)

## API Endpoints

- `POST /api/auth/register` - Registracija
- `POST /api/auth/login` - Prijava
- `POST /api/auth/logout` - Odjava
- `GET /api/fields` - Lista terena
- `POST /api/fields` - Dodavanje terena (auth)
- `GET /api/matches` - Lista mečeva
- `POST /api/matches` - Kreiranje meča (auth)
- `GET /api/matches/:id` - Detalji meča
- `POST /api/matches/:id/join` - Pridruživanje meču (auth)


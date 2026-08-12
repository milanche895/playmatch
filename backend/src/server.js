const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cron = require('node-cron');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Debug: Check if .env is loaded
console.log('MONGO_URI:', process.env.MONGO_URI ? 'Loaded' : 'Not found');

const authRoutes = require('./routes/auth');
const fieldRoutes = require('./routes/fields');
const matchRoutesFactory = require('./routes/matches');
const courtRoutes = require('./routes/courts');
const playerRoutes = require('./routes/players');
const { processExpiredMatches } = require('./utils/matchStatus');

const app = express();
const server = http.createServer(app);

// Allow both frontend ports (3000 for frontend folder, 5173 for client folder)
const allowedOrigins = process.env.CLIENT_URL 
  ? [process.env.CLIENT_URL] 
  : ['http://localhost:3000', 'http://localhost:5173', 'https://playmatch-1.onrender.com'];

const CLIENT_URL = allowedOrigins[0];

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

app.set('io', io);

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      callback(null, true); // Allow all origins in development only
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Handle Chrome DevTools .well-known requests to avoid CSP warnings
app.get('/.well-known/*', (req, res) => {
  // Set CORS headers to allow the request
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

// Also handle the specific Chrome DevTools path
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

// Handle OPTIONS preflight for .well-known
app.options('/.well-known/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

app.use('/api/auth', authRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/matches', matchRoutesFactory(io));
app.use('/api/courts', courtRoutes);
app.use('/api/players', playerRoutes);

io.on('connection', (socket) => {
  socket.on('join_match_room', (matchId) => { if (matchId) socket.join(`match:${matchId}`); });
  socket.on('leave_match_room', (matchId) => { if (matchId) socket.leave(`match:${matchId}`); });
});

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/playmatch';

// Function to check and mark expired matches (failed / otkazano)
async function checkCancelledMatches() {
  try {
    const { failedCount, cancelledCount, total } = await processExpiredMatches(io);
    if (total > 0) {
      console.log(`✅ ${failedCount} meč(ev)a označeno kao failed, ${cancelledCount} kao otkazano`);
    } else {
      console.log('ℹ️  Nema mečeva sa isteklim rokom za prijavu');
    }
  } catch (error) {
    console.error('❌ Greška pri proveri isteklih mečeva:', error);
  }
}

console.log(`Attempting to connect to MongoDB...`);
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(async () => {
  console.log('✅ MongoDB connected successfully');
  
  // Fix user index if needed (recreate with correct partialFilterExpression)
  try {
    const collection = mongoose.connection.db.collection('users');
    const indexes = await collection.indexes();
    const providerIndex = indexes.find(idx => idx.name === 'provider_1_providerId_1');
    
    if (providerIndex) {
      // Check if index has correct partialFilterExpression
      const hasCorrectFilter = providerIndex.partialFilterExpression && 
                                providerIndex.partialFilterExpression.provider && 
                                providerIndex.partialFilterExpression.provider.$ne === 'local';
      
      if (!hasCorrectFilter) {
        console.log('🔧 Recreating user index with correct partialFilterExpression...');
        try {
          await collection.dropIndex('provider_1_providerId_1');
          console.log('✅ Dropped old index');
        } catch (err) {
          if (err.code !== 27) { // 27 = IndexNotFound
            console.error('⚠️  Error dropping index:', err.message);
          }
        }
        
        await collection.createIndex(
          { provider: 1, providerId: 1 },
          {
            unique: true,
            sparse: true,
            partialFilterExpression: {
              providerId: { $exists: true, $ne: null },
              provider: { $ne: 'local' }
            },
            name: 'provider_1_providerId_1'
          }
        );
        console.log('✅ Created new index with correct partialFilterExpression');
      }
    }
  } catch (err) {
    console.error('⚠️  Warning: Could not fix user index:', err.message);
    console.error('   You may need to run: npm run fix-index');
  }
  
  // Check cancelled matches on startup
  checkCancelledMatches();
  
  // Cron job: check for cancelled matches every hour (at minute 0)
  // Cron expression '0 * * * *' = svakog sata u 0 minuta
  cron.schedule('0 * * * *', () => {
    console.log('🕐 Pokretanje cron job-a za proveru otkazanih mečeva...');
    checkCancelledMatches();
  });
  console.log('⏰ Cron job postavljen: provera otkazanih mečeva svakog sata');
  
  server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('Please check your MONGO_URI in .env file');
  process.exit(1);
});



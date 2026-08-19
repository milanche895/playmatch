const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cron = require('node-cron');
const next = require('next');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const dev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/playmatch';

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const authRoutes = require('./src/server/routes/auth');
const fieldRoutes = require('./src/server/routes/fields');
const matchRoutesFactory = require('./src/server/routes/matches');
const courtRoutes = require('./src/server/routes/courts');
const playerRoutes = require('./src/server/routes/players');
const { processExpiredMatches } = require('./src/server/utils/matchStatus');

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ['http://localhost:3000', 'http://localhost:5173', 'https://playmatch-1.onrender.com'];

async function checkCancelledMatches(io) {
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

async function start() {
  await nextApp.prepare();

  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true }
  });

  app.set('io', io);

  app.use(morgan('dev'));
  app.use(cookieParser());

  app.use('/api', express.json({ limit: '10mb' }));
  app.use('/api', session({
    secret: process.env.SESSION_SECRET || 'dev_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
  }));
  app.use('/api', passport.initialize());
  app.use('/api', passport.session());

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.get('/.well-known/*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
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

  app.all('*', (req, res) => {
    if (req.url.startsWith('/socket.io') || res.headersSent) return;
    return handle(req, res);
  });

  console.log('Attempting to connect to MongoDB...');
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ MongoDB connected successfully');

  try {
    const collection = mongoose.connection.db.collection('users');
    const indexes = await collection.indexes();
    const providerIndex = indexes.find((idx) => idx.name === 'provider_1_providerId_1');

    if (providerIndex) {
      const hasCorrectFilter = providerIndex.partialFilterExpression &&
        providerIndex.partialFilterExpression.provider &&
        providerIndex.partialFilterExpression.provider.$ne === 'local';

      if (!hasCorrectFilter) {
        console.log('🔧 Recreating user index with correct partialFilterExpression...');
        try {
          await collection.dropIndex('provider_1_providerId_1');
          console.log('✅ Dropped old index');
        } catch (err) {
          if (err.code !== 27) {
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

  await checkCancelledMatches(io);

  cron.schedule('0 * * * *', () => {
    console.log('🕐 Pokretanje cron job-a za proveru otkazanih mečeva...');
    checkCancelledMatches(io);
  });
  console.log('⏰ Cron job postavljen: provera otkazanih mečeva svakog sata');

  server.listen(PORT, () => {
    console.log(`🚀 Plejko running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

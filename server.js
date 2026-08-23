const path = require('path');
const http = require('http');
const express = require('express');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cron = require('node-cron');
const next = require('next');

dotenv.config({ path: path.join(__dirname, '.env') });

const dev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const { attachApi } = require('./src/server/createApp');
const { connectDb } = require('./src/server/db');
const { processExpiredMatches } = require('./src/server/utils/matchStatus');
const { getPublicUrl } = require('./src/server/publicUrl');

const allowedOrigins = [getPublicUrl()];

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

  attachApi(app, io);

  io.on('connection', (socket) => {
    socket.on('join_match_room', (matchId) => { if (matchId) socket.join(`match:${matchId}`); });
    socket.on('leave_match_room', (matchId) => { if (matchId) socket.leave(`match:${matchId}`); });
  });

  app.all('*', (req, res) => {
    if (req.url.startsWith('/socket.io') || res.headersSent) return;
    return handle(req, res);
  });

  console.log('Attempting to connect to MongoDB...');
  await connectDb();
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

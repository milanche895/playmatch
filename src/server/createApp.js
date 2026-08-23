const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const fieldRoutes = require('./routes/fields');
const matchRoutesFactory = require('./routes/matches');
const courtRoutes = require('./routes/courts');
const playerRoutes = require('./routes/players');
const { connectDb } = require('./db');
const { processExpiredMatches } = require('./utils/matchStatus');

function createNoopIo() {
  return {
    to() {
      return { emit() {} };
    },
    emit() {},
  };
}

function attachApi(app, io = createNoopIo()) {
  app.set('io', io);

  app.use(async (req, res, next) => {
    if (!req.url.startsWith('/api') || req.url.startsWith('/api/health')) return next();
    try {
      await connectDb();
      next();
    } catch (err) {
      console.error('MongoDB connection failed:', err);
      res.status(503).json({ message: 'Baza nije dostupna' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }
  app.use(cookieParser());

  app.use('/api', express.json({ limit: '10mb' }));
  app.use('/api', session({
    secret: process.env.SESSION_SECRET || 'dev_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
  app.use('/api', passport.initialize());
  app.use('/api', passport.session());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/cron/expired-matches', async (req, res) => {
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const secret = process.env.CRON_SECRET;
    const hasSecret = secret && req.headers.authorization === `Bearer ${secret}`;
    const allowDev = !secret && process.env.NODE_ENV !== 'production';
    if (!isVercelCron && !hasSecret && !allowDev) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const result = await processExpiredMatches(io);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('Cron expired-matches failed:', err);
      res.status(500).json({ message: 'Cron failed' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/fields', fieldRoutes);
  app.use('/api/matches', matchRoutesFactory(io));
  app.use('/api/courts', courtRoutes);
  app.use('/api/players', playerRoutes);

  return app;
}

function createApp(io) {
  return attachApi(express(), io);
}

module.exports = {
  attachApi,
  createApp,
  createNoopIo,
};

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const fieldRoutes = require('./routes/fields');
const matchRoutesFactory = require('./routes/matches');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
});

// Attach io to request for routes needing it
app.set('io', io);

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/matches', matchRoutesFactory(io));

// Socket.IO
io.on('connection', (socket) => {
  socket.on('join_match_room', (matchId) => {
    if (matchId) socket.join(`match:${matchId}`);
  });
  socket.on('leave_match_room', (matchId) => {
    if (matchId) socket.leave(`match:${matchId}`);
  });
});

// DB + Server start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/playmatch';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });



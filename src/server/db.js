const mongoose = require('mongoose');

let cached = global.__plejkoMongoose;
if (!cached) {
  cached = global.__plejkoMongoose = { conn: null, promise: null };
}

function getMongoUri() {
  return process.env.MONGO_URI || '';
}

function hasMongoUri() {
  return Boolean(getMongoUri());
}

async function connectDb() {
  if (cached.conn) return cached.conn;

  const uri = getMongoUri();
  if (!uri) {
    const err = new Error('MONGO_URI is not set');
    err.code = 'NO_MONGO_URI';
    throw err;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
}

module.exports = { connectDb, hasMongoUri };

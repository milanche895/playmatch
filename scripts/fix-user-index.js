const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const mongoose = require('mongoose');
const User = require('../src/server/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/playmatch';

async function fixIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.db.collection('users');
    
    // Drop existing index if it exists
    try {
      await collection.dropIndex('provider_1_providerId_1');
      console.log('✅ Dropped old index');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index does not exist, creating new one...');
      } else {
        throw err;
      }
    }

    // Recreate index with new definition
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

    await mongoose.connection.close();
    console.log('✅ Done! Index has been recreated.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndex();

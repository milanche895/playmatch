const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../src/server/models/User');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/playmatch';
  await mongoose.connect(uri);

  const result = await User.updateMany(
    {
      role: 'player',
      $or: [
        { ratingAvg: { $exists: false } },
        { ratingsCount: { $exists: false } },
        { reliabilityScore: { $exists: false } },
        { sportSkillLevels: { $exists: false } }
      ]
    },
    {
      $set: {
        ratingAvg: 0,
        ratingsCount: 0,
        reliabilityScore: 100,
        sportSkillLevels: []
      }
    }
  );

  console.log(`Updated ${result.modifiedCount} users`);
  await mongoose.disconnect();
}

run()
  .then(() => {
    console.log('Backfill completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });

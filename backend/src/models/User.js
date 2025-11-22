const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    avatarUrl: { type: String },
    role: { 
      type: String, 
      enum: ['player', 'court'], 
      default: 'player' 
    },
    // Court-specific fields
    workingHours: {
      monday: { start: String, end: String, closed: { type: Boolean, default: false } },
      tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
      wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
      thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
      friday: { start: String, end: String, closed: { type: Boolean, default: false } },
      saturday: { start: String, end: String, closed: { type: Boolean, default: false } },
      sunday: { start: String, end: String, closed: { type: Boolean, default: false } }
    },
    defaultPrice: { type: Number, default: 0 }, // Default price per appointment
    defaultRegistrationDeadlineHours: { type: Number, default: 24 } // Default deadline in hours before match
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);



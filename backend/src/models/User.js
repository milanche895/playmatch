const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String }, // Made optional for OAuth users
    avatarUrl: { type: String },
    // OAuth provider information
    provider: { 
      type: String, 
      enum: ['local', 'google', 'facebook', 'instagram'], 
      default: 'local' 
    },
    providerId: { type: String }, // ID from OAuth provider
    providerData: { type: mongoose.Schema.Types.Mixed }, // Store additional provider data
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
    defaultRegistrationDeadlineHours: { type: Number, default: 24 }, // Default deadline in hours before match
    // Player-specific fields
    bio: { type: String, default: '' }, // Biografija igrača
    skills: { type: String, default: '' }, // Veštine igrača
    phone: { type: String, default: '' }, // Telefon
    location: { type: String, default: '' }, // Lokacija
    preferredSports: [{ type: String }], // Omiljeni sportovi
    experience: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'professional'], default: 'beginner' } // Nivo iskustva
  },
  { timestamps: true }
);

// Add index for OAuth provider lookups
userSchema.index({ provider: 1, providerId: 1 }, { unique: true, sparse: true });

// Validate password is required for local users
userSchema.pre('validate', function(next) {
  if (this.provider === 'local' && !this.password) {
    this.invalidate('password', 'Password is required for local accounts');
  }
  next();
});

module.exports = mongoose.model('User', userSchema);



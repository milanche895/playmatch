const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true },
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' }, // Optional for informal matches
    isInformal: { type: Boolean, default: false },
    informalLocation: {
      name: { type: String },
      lat: { type: Number },
      lng: { type: Number }
    },
    informalRegistrationDeadlineHours: { type: Number, min: 1, max: 48 },
    dateTime: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    minPlayers: { type: Number, required: true },
    maxPlayers: { type: Number }, // Optional
    playersNeeded: { type: Number, required: true }, // Keep for backward compatibility, will be set to minPlayers
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['open', 'full', 'completed', 'failed', 'otkazano'], default: 'open' },
    courtApproval: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'approved' 
    },
    courtApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    courtApprovedAt: { type: Date },
    description: { type: String }, // Opis rezervacije (npr. za koga je rezervisan termin)
    // Player cancellations - track when players cancel their attendance with comments
    playerCancellations: [{
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      comment: { type: String, default: '' },
      cancelledAt: { type: Date, default: Date.now },
      penalizedReliability: { type: Boolean, default: false }
    }],
    noShows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ratings: [{
      raterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      ratedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      stars: { type: Number, required: true, min: 1, max: 5 },
      fairPlay: { type: Boolean, default: true },
      sport: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

// Formal matches require a field; informal matches require name + coordinates
matchSchema.pre('validate', function(next) {
  if (this.isInformal) {
    if (this.fieldId) {
      this.invalidate('fieldId', 'Neformalni meč ne sme imati teren iz baze');
    }
    const loc = this.informalLocation;
    const nameOk = loc && String(loc.name || '').trim().length > 0;
    const coordsOk = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' &&
      !Number.isNaN(loc.lat) && !Number.isNaN(loc.lng);
    if (!nameOk || !coordsOk) {
      this.invalidate('informalLocation', 'Neformalni meč zahteva naziv lokacije i validne koordinate');
    }
    if (this.informalRegistrationDeadlineHours != null) {
      const h = Number(this.informalRegistrationDeadlineHours);
      if (Number.isNaN(h) || h < 1 || h > 48) {
        this.invalidate('informalRegistrationDeadlineHours', 'Rok za prijavu mora biti između 1 i 48 sati');
      }
    }
  } else if (!this.fieldId) {
    this.invalidate('fieldId', 'Teren je obavezan za formalne mečeve');
  }
  next();
});

// Pre-save hook to ensure backward compatibility with old matches
matchSchema.pre('save', function(next) {
  // If minPlayers is missing, set it from playersNeeded
  if (!this.minPlayers && this.playersNeeded) {
    this.minPlayers = this.playersNeeded;
  }
  // If playersNeeded is missing, set it from minPlayers
  if (!this.playersNeeded && this.minPlayers) {
    this.playersNeeded = this.minPlayers;
  }
  // Ensure both are set (default to 1 if neither exists)
  if (!this.minPlayers && !this.playersNeeded) {
    this.minPlayers = 1;
    this.playersNeeded = 1;
  }
  next();
});

module.exports = mongoose.model('Match', matchSchema);



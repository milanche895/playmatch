const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true },
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
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
      cancelledAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

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



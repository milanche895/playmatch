const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true },
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    dateTime: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    playersNeeded: { type: Number, required: true },
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
    description: { type: String } // Opis rezervacije (npr. za koga je rezervisan termin)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);



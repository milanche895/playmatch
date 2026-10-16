const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'player_joined',
  'match_full',
  'time_changed',
  'player_left',
  'reminder',
  'court_approved',
  'court_rejected',
  'team_ready',
  'slot_reserved',
];

// In-app notification feed ("Obaveštenja" screen). Titles are derived from `type` on the client.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    sport: { type: String },
    locationName: { type: String },
    matchDateTime: { type: Date },
    playerCount: { type: Number },
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, matchId: 1, type: 1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
